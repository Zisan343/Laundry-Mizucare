<?php
require_once 'config.php';

requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGet($pdo);
        break;
    case 'POST':
        handlePost($pdo);
        break;
    case 'PUT':
        handlePut($pdo);
        break;
    case 'DELETE':
        handleDelete($pdo);
        break;
    default:
        respondError('Metode tidak diizinkan', 405);
        break;
}

function handleGet($pdo) {
    try {
        if (!empty($_GET['id'])) {
            $idPesanan = (int)$_GET['id'];

            // Fetch pesanan with pelanggan and karyawan info
            $stmt = $pdo->prepare('
                SELECT p.*,
                       pel.nama_lengkap AS nama_pelanggan,
                       pel.no_telepon AS telp_pelanggan,
                       pel.alamat AS alamat_pelanggan,
                       k.nama_lengkap AS nama_karyawan
                FROM pesanan p
                LEFT JOIN pelanggan pel ON p.id_pelanggan = pel.id_pelanggan
                LEFT JOIN karyawan k ON p.id_karyawan = k.id_karyawan
                WHERE p.id_pesanan = ?
                LIMIT 1
            ');
            $stmt->execute([$idPesanan]);
            $pesanan = $stmt->fetch();

            if (!$pesanan) {
                respondError('Pesanan tidak ditemukan', 404);
            }

            // Fetch detail_pesanan joined with jenis_layanan
            $stmtDetail = $pdo->prepare('
                SELECT dp.*, jl.nama_layanan, jl.satuan, kl.nama_kategori
                FROM detail_pesanan dp
                JOIN jenis_layanan jl ON dp.id_layanan = jl.id_layanan
                LEFT JOIN kategori_layanan kl ON jl.id_kategori = kl.id_kategori
                WHERE dp.id_pesanan = ?
                ORDER BY dp.id_detail ASC
            ');
            $stmtDetail->execute([$idPesanan]);
            $pesanan['detail_pesanan'] = $stmtDetail->fetchAll();

            // Fetch pembayaran info
            $stmtBayar = $pdo->prepare('
                SELECT pb.*, k.nama_lengkap AS nama_kasir
                FROM pembayaran pb
                LEFT JOIN karyawan k ON pb.id_karyawan = k.id_karyawan
                WHERE pb.id_pesanan = ?
                ORDER BY pb.id_pembayaran DESC
            ');
            $stmtBayar->execute([$idPesanan]);
            $pesanan['pembayaran'] = $stmtBayar->fetchAll();

            respond($pesanan, 'Detail pesanan ditemukan');
        } else {
            // List pesanan with optional filters
            $sql = '
                SELECT p.*,
                       pel.nama_lengkap AS nama_pelanggan,
                       pel.no_telepon AS telp_pelanggan,
                       k.nama_lengkap AS nama_karyawan,
                       pb.status_bayar AS status_pembayaran,
                       pb.metode_bayar,
                       pb.jumlah_bayar
                FROM pesanan p
                LEFT JOIN pelanggan pel ON p.id_pelanggan = pel.id_pelanggan
                LEFT JOIN karyawan k ON p.id_karyawan = k.id_karyawan
                LEFT JOIN pembayaran pb ON pb.id_pesanan = p.id_pesanan
                WHERE 1=1
            ';
            $params = [];

            if (!empty($_GET['status'])) {
                $sql .= ' AND p.status_pesanan = ?';
                $params[] = sanitize($_GET['status']);
            }

            if (!empty($_GET['search'])) {
                $search = '%' . sanitize($_GET['search']) . '%';
                $sql .= ' AND (p.kode_pesanan LIKE ? OR pel.nama_lengkap LIKE ?)';
                $params[] = $search;
                $params[] = $search;
            }

            $sql .= ' ORDER BY p.tanggal_masuk DESC';

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $list = $stmt->fetchAll();

            respond($list, 'Daftar pesanan berhasil diambil');
        }
    } catch (PDOException $e) {
        respondError('Gagal mengambil data pesanan: ' . $e->getMessage(), 500);
    }
}

function handlePost($pdo) {
    $body = getBody();

    $idPelanggan    = (int)($body['id_pelanggan'] ?? 0);
    $idKaryawan     = (int)($body['id_karyawan'] ?? ($_SESSION['karyawan_id'] ?? 0));
    $catatanPesanan = sanitize($body['catatan_pesanan'] ?? '');
    $items          = $body['items'] ?? [];

    if ($idPelanggan <= 0) {
        respondError('Pelanggan wajib dipilih', 400);
    }

    if (empty($items) || !is_array($items)) {
        respondError('Item pesanan tidak boleh kosong', 400);
    }

    try {
        $pdo->beginTransaction();

        // 1. Generate kode_pesanan: 'LND-' + YYYYMMDD + '-' + sequence (COUNT + 1 LPAD 3 digits)
        $dateStr = date('Ymd');
        $stmtCount = $pdo->prepare('SELECT COUNT(*) FROM pesanan WHERE DATE(tanggal_masuk) = CURDATE()');
        $stmtCount->execute();
        $countToday = (int)$stmtCount->fetchColumn();
        $seq = str_pad((string)($countToday + 1), 3, '0', STR_PAD_LEFT);
        $kodePesanan = 'LND-' . $dateStr . '-' . $seq;

        // Double check uniqueness in case of rapid additions
        $stmtCheck = $pdo->prepare('SELECT COUNT(*) FROM pesanan WHERE kode_pesanan = ?');
        $stmtCheck->execute([$kodePesanan]);
        if ((int)$stmtCheck->fetchColumn() > 0) {
            $kodePesanan = 'LND-' . $dateStr . '-' . str_pad((string)($countToday + 2), 3, '0', STR_PAD_LEFT);
        }

        // 2. Insert pesanan default: tanggal_estimasi = DATE_ADD(NOW(), INTERVAL 48 HOUR)
        $stmtPesanan = $pdo->prepare('
            INSERT INTO pesanan (
                kode_pesanan, id_pelanggan, id_karyawan, tanggal_masuk,
                tanggal_estimasi, status_pesanan, catatan_pesanan,
                total_berat, subtotal, diskon, total_bayar
            ) VALUES (
                ?, ?, ?, NOW(),
                DATE_ADD(NOW(), INTERVAL 48 HOUR), "menunggu", ?,
                0, 0, 0, 0
            )
        ');
        $stmtPesanan->execute([$kodePesanan, $idPelanggan, $idKaryawan, $catatanPesanan]);
        $idPesanan = (int)$pdo->lastInsertId();

        // 3. Insert each item into detail_pesanan with harga_satuan from jenis_layanan
        $stmtLayanan = $pdo->prepare('SELECT id_layanan, harga_satuan, satuan FROM jenis_layanan WHERE id_layanan = ? AND is_aktif = 1 LIMIT 1');
        $stmtItem = $pdo->prepare('
            INSERT INTO detail_pesanan (id_pesanan, id_layanan, jumlah, harga_satuan, subtotal, catatan_item)
            VALUES (?, ?, ?, ?, ?, ?)
        ');

        $calcSubtotal = 0;
        $calcBerat = 0;

        foreach ($items as $item) {
            $idLayanan = (int)($item['id_layanan'] ?? 0);
            $jumlah    = (float)($item['jumlah'] ?? 0);
            $catItem   = sanitize($item['catatan_item'] ?? '');

            if ($idLayanan <= 0 || $jumlah <= 0) {
                $pdo->rollBack();
                respondError('Data item layanan atau jumlah tidak valid', 400);
            }

            $stmtLayanan->execute([$idLayanan]);
            $layanan = $stmtLayanan->fetch();
            if (!$layanan) {
                $pdo->rollBack();
                respondError("Layanan dengan ID $idLayanan tidak ditemukan atau tidak aktif", 404);
            }

            $hargaSatuan = (float)$layanan['harga_satuan'];
            $subtotalItem = $jumlah * $hargaSatuan;

            $stmtItem->execute([$idPesanan, $idLayanan, $jumlah, $hargaSatuan, $subtotalItem, $catItem]);

            $calcSubtotal += $subtotalItem;
            if (strtolower($layanan['satuan']) === 'kg') {
                $calcBerat += $jumlah;
            }
        }

        // Triggers in database may update pesanan, or we make sure values are properly populated
        $stmtSync = $pdo->prepare('
            UPDATE pesanan
            SET subtotal = ?,
                total_berat = ?,
                total_bayar = (? - diskon)
            WHERE id_pesanan = ? AND (subtotal = 0 OR subtotal IS NULL)
        ');
        $stmtSync->execute([$calcSubtotal, $calcBerat, $calcSubtotal, $idPesanan]);

        $pdo->commit();

        // Fetch newly created pesanan
        $stmtGet = $pdo->prepare('
            SELECT p.*, pel.nama_lengkap AS nama_pelanggan, k.nama_lengkap AS nama_karyawan
            FROM pesanan p
            LEFT JOIN pelanggan pel ON p.id_pelanggan = pel.id_pelanggan
            LEFT JOIN karyawan k ON p.id_karyawan = k.id_karyawan
            WHERE p.id_pesanan = ?
        ');
        $stmtGet->execute([$idPesanan]);
        $created = $stmtGet->fetch();

        respond($created, 'Pesanan berhasil dibuat', true, 201);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        respondError('Gagal membuat pesanan: ' . $e->getMessage(), 500);
    }
}

function handlePut($pdo) {
    $body = getBody();
    $idPesanan = (int)($body['id_pesanan'] ?? 0);

    if ($idPesanan <= 0) {
        respondError('ID Pesanan wajib diisi', 400);
    }

    try {
        $stmtCheck = $pdo->prepare('SELECT * FROM pesanan WHERE id_pesanan = ?');
        $stmtCheck->execute([$idPesanan]);
        $existing = $stmtCheck->fetch();

        if (!$existing) {
            respondError('Pesanan tidak ditemukan', 404);
        }

        $fields = [];
        $params = [];

        if (isset($body['status_pesanan'])) {
            $status = sanitize($body['status_pesanan']);
            $allowedStatus = ['menunggu', 'diproses', 'selesai', 'diambil', 'dibatalkan'];
            if (!in_array($status, $allowedStatus, true)) {
                respondError('Status pesanan tidak valid: ' . $status, 400);
            }
            $fields[] = 'status_pesanan = ?';
            $params[] = $status;

            if ($status === 'selesai') {
                $fields[] = 'tanggal_selesai = NOW()';
            } elseif ($status === 'diambil') {
                $fields[] = 'tanggal_ambil = NOW()';
            }
        }

        if (isset($body['diskon'])) {
            $diskon = max(0, (float)$body['diskon']);
            $fields[] = 'diskon = ?';
            $params[] = $diskon;
            $fields[] = 'total_bayar = GREATEST(0, subtotal - ?)';
            $params[] = $diskon;
        }

        if (isset($body['catatan_pesanan'])) {
            $fields[] = 'catatan_pesanan = ?';
            $params[] = sanitize($body['catatan_pesanan']);
        }

        if (empty($fields)) {
            respondError('Tidak ada field yang diperbarui', 400);
        }

        $params[] = $idPesanan;
        $sql = 'UPDATE pesanan SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE id_pesanan = ?';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $stmtUpdated = $pdo->prepare('SELECT * FROM pesanan WHERE id_pesanan = ?');
        $stmtUpdated->execute([$idPesanan]);
        $updated = $stmtUpdated->fetch();

        respond($updated, 'Pesanan berhasil diperbarui');
    } catch (PDOException $e) {
        respondError('Gagal memperbarui pesanan: ' . $e->getMessage(), 500);
    }
}

function handleDelete($pdo) {
    $idPesanan = (int)($_GET['id'] ?? 0);
    if ($idPesanan <= 0) {
        respondError('ID Pesanan wajib diisi', 400);
    }

    try {
        $stmtCheck = $pdo->prepare('SELECT id_pesanan FROM pesanan WHERE id_pesanan = ?');
        $stmtCheck->execute([$idPesanan]);
        if (!$stmtCheck->fetch()) {
            respondError('Pesanan tidak ditemukan', 404);
        }

        // Delete pesanan (foreign key ON DELETE CASCADE will handle detail_pesanan & pembayaran if configured, otherwise clean explicitly)
        $pdo->beginTransaction();
        $pdo->prepare('DELETE FROM detail_pesanan WHERE id_pesanan = ?')->execute([$idPesanan]);
        $pdo->prepare('DELETE FROM pembayaran WHERE id_pesanan = ?')->execute([$idPesanan]);
        $pdo->prepare('DELETE FROM pesanan WHERE id_pesanan = ?')->execute([$idPesanan]);
        $pdo->commit();

        respond(['id_pesanan' => $idPesanan], 'Pesanan berhasil dihapus');
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        respondError('Gagal menghapus pesanan: ' . $e->getMessage(), 500);
    }
}
