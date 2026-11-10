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
    default:
        respondError('Metode tidak diizinkan. Gunakan GET atau POST.', 405);
        break;
}

function handleGet($pdo) {
    $idPesanan = (int)($_GET['id_pesanan'] ?? 0);
    if ($idPesanan <= 0) {
        respondError('Parameter id_pesanan wajib diisi', 400);
    }

    try {
        $stmt = $pdo->prepare('
            SELECT pb.*, k.nama_lengkap AS nama_kasir, p.kode_pesanan, p.total_bayar
            FROM pembayaran pb
            JOIN pesanan p ON pb.id_pesanan = p.id_pesanan
            LEFT JOIN karyawan k ON pb.id_karyawan = k.id_karyawan
            WHERE pb.id_pesanan = ?
            ORDER BY pb.id_pembayaran DESC
        ');
        $stmt->execute([$idPesanan]);
        $rows = $stmt->fetchAll();

        respond($rows, 'Data pembayaran berhasil diambil');
    } catch (PDOException $e) {
        respondError('Gagal mengambil data pembayaran: ' . $e->getMessage(), 500);
    }
}

function handlePost($pdo) {
    $body = getBody();

    $idPesanan    = (int)($body['id_pesanan'] ?? 0);
    $metodeBayar  = sanitize($body['metode_bayar'] ?? '');
    $jumlahBayar  = (float)($body['jumlah_bayar'] ?? 0);
    $referensi    = sanitize($body['referensi'] ?? '');
    $catatan      = sanitize($body['catatan'] ?? '');
    $idKaryawan   = (int)($_SESSION['karyawan_id'] ?? 0);

    if ($idPesanan <= 0) {
        respondError('ID Pesanan wajib diisi', 400);
    }

    $allowedMetode = ['tunai', 'transfer', 'qris', 'debit', 'kredit'];
    if (!in_array($metodeBayar, $allowedMetode, true)) {
        respondError('Metode pembayaran tidak valid. Pilih: ' . implode(', ', $allowedMetode), 400);
    }

    try {
        $pdo->beginTransaction();

        // Check pesanan & total_bayar
        $stmtPesanan = $pdo->prepare('SELECT id_pesanan, kode_pesanan, total_bayar, status_pesanan FROM pesanan WHERE id_pesanan = ?');
        $stmtPesanan->execute([$idPesanan]);
        $pesanan = $stmtPesanan->fetch();

        if (!$pesanan) {
            $pdo->rollBack();
            respondError('Pesanan tidak ditemukan', 404);
        }

        $totalBayar = (float)$pesanan['total_bayar'];
        if ($jumlahBayar < $totalBayar) {
            $pdo->rollBack();
            respondError('Jumlah pembayaran kurang dari total bayar: Rp ' . number_format($totalBayar, 0, ',', '.'), 400);
        }

        $jumlahKembali = max(0, $jumlahBayar - $totalBayar);

        // Check if existing pembayaran for this pesanan exists
        $stmtCheckBayar = $pdo->prepare('SELECT id_pembayaran FROM pembayaran WHERE id_pesanan = ? LIMIT 1');
        $stmtCheckBayar->execute([$idPesanan]);
        $existingBayar = $stmtCheckBayar->fetch();

        if ($existingBayar) {
            $stmtUpdateBayar = $pdo->prepare('
                UPDATE pembayaran
                SET id_karyawan    = ?,
                    metode_bayar   = ?,
                    jumlah_bayar   = ?,
                    jumlah_kembali = ?,
                    status_bayar   = "lunas",
                    referensi      = ?,
                    catatan        = ?,
                    tanggal_bayar  = NOW(),
                    updated_at     = NOW()
                WHERE id_pembayaran = ?
            ');
            $stmtUpdateBayar->execute([
                $idKaryawan,
                $metodeBayar,
                $jumlahBayar,
                $jumlahKembali,
                $referensi,
                $catatan,
                $existingBayar['id_pembayaran']
            ]);
            $idPembayaran = (int)$existingBayar['id_pembayaran'];
        } else {
            $stmtInsertBayar = $pdo->prepare('
                INSERT INTO pembayaran (
                    id_pesanan, id_karyawan, metode_bayar,
                    jumlah_bayar, jumlah_kembali, status_bayar,
                    referensi, tanggal_bayar, catatan
                ) VALUES (
                    ?, ?, ?,
                    ?, ?, "lunas",
                    ?, NOW(), ?
                )
            ');
            $stmtInsertBayar->execute([
                $idPesanan,
                $idKaryawan,
                $metodeBayar,
                $jumlahBayar,
                $jumlahKembali,
                $referensi,
                $catatan
            ]);
            $idPembayaran = (int)$pdo->lastInsertId();
        }

        // If status_pesanan was 'selesai', update status to 'diambil' and set tanggal_ambil
        if ($pesanan['status_pesanan'] === 'selesai') {
            $stmtUpdateStatus = $pdo->prepare('
                UPDATE pesanan
                SET status_pesanan = "diambil",
                    tanggal_ambil   = NOW(),
                    updated_at      = NOW()
                WHERE id_pesanan    = ?
            ');
            $stmtUpdateStatus->execute([$idPesanan]);
        }

        $pdo->commit();

        $stmtResult = $pdo->prepare('
            SELECT pb.*, k.nama_lengkap AS nama_kasir, p.kode_pesanan, p.status_pesanan
            FROM pembayaran pb
            JOIN pesanan p ON pb.id_pesanan = p.id_pesanan
            LEFT JOIN karyawan k ON pb.id_karyawan = k.id_karyawan
            WHERE pb.id_pembayaran = ?
        ');
        $stmtResult->execute([$idPembayaran]);
        $result = $stmtResult->fetch();

        respond($result, 'Pembayaran berhasil diproses', true, 201);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        respondError('Gagal memproses pembayaran: ' . $e->getMessage(), 500);
    }
}
