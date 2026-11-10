<?php
require_once 'config.php';

requireAuth();

$method = $_SERVER['REQUEST_METHOD'];
$resource = $_GET['resource'] ?? '';

// Handle resource=kategori
if ($resource === 'kategori') {
    if ($method === 'GET') {
        try {
            $stmt = $pdo->query('SELECT * FROM kategori_layanan ORDER BY nama_kategori ASC');
            respond($stmt->fetchAll(), 'Daftar kategori layanan berhasil diambil');
        } catch (PDOException $e) {
            respondError('Gagal mengambil kategori layanan: ' . $e->getMessage(), 500);
        }
    } else {
        respondError('Metode tidak diizinkan untuk resource kategori', 405);
    }
}

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
            $idLayanan = (int)$_GET['id'];
            $stmt = $pdo->prepare('
                SELECT jl.*, kl.nama_kategori, kl.deskripsi AS deskripsi_kategori
                FROM jenis_layanan jl
                LEFT JOIN kategori_layanan kl ON jl.id_kategori = kl.id_kategori
                WHERE jl.id_layanan = ?
                LIMIT 1
            ');
            $stmt->execute([$idLayanan]);
            $layanan = $stmt->fetch();

            if (!$layanan) {
                respondError('Layanan tidak ditemukan', 404);
            }

            respond($layanan, 'Data layanan ditemukan');
        } else {
            // Get all kategori
            $stmtKat = $pdo->query('SELECT * FROM kategori_layanan ORDER BY nama_kategori ASC');
            $kategoriList = $stmtKat->fetchAll();

            // Get all jenis_layanan joined with kategori_layanan
            $stmtLay = $pdo->query('
                SELECT jl.*, kl.nama_kategori
                FROM jenis_layanan jl
                LEFT JOIN kategori_layanan kl ON jl.id_kategori = kl.id_kategori
                ORDER BY kl.nama_kategori ASC, jl.nama_layanan ASC
            ');
            $layananList = $stmtLay->fetchAll();

            // Group by kategori
            $grouped = [];
            foreach ($layananList as $item) {
                $katName = $item['nama_kategori'] ?? 'Lain-lain';
                if (!isset($grouped[$katName])) {
                    $grouped[$katName] = [];
                }
                $grouped[$katName][] = $item;
            }

            respond([
                'kategori'   => $kategoriList,
                'layanan'    => $layananList,
                'grouped'    => $grouped
            ], 'Daftar layanan berhasil diambil');
        }
    } catch (PDOException $e) {
        respondError('Gagal mengambil data layanan: ' . $e->getMessage(), 500);
    }
}

function handlePost($pdo) {
    $body = getBody();

    $idKategori   = (int)($body['id_kategori'] ?? 0);
    $namaLayanan  = sanitize($body['nama_layanan'] ?? '');
    $satuan       = sanitize($body['satuan'] ?? 'kg');
    $hargaSatuan  = (float)($body['harga_satuan'] ?? 0);
    $estimasiJam  = (int)($body['estimasi_jam'] ?? 24);
    $deskripsi    = sanitize($body['deskripsi'] ?? '');
    $isAktif      = isset($body['is_aktif']) ? (int)(bool)$body['is_aktif'] : 1;

    if ($idKategori <= 0 || empty($namaLayanan) || $hargaSatuan <= 0) {
        respondError('Kategori, nama layanan, dan harga satuan wajib diisi', 400);
    }

    $allowedSatuan = ['kg', 'pcs', 'pasang', 'set'];
    if (!in_array($satuan, $allowedSatuan, true)) {
        respondError('Satuan tidak valid. Pilihan: ' . implode(', ', $allowedSatuan), 400);
    }

    try {
        $stmt = $pdo->prepare('
            INSERT INTO jenis_layanan (
                id_kategori, nama_layanan, satuan,
                harga_satuan, estimasi_jam, deskripsi, is_aktif
            ) VALUES (
                ?, ?, ?,
                ?, ?, ?, ?
            )
        ');
        $stmt->execute([
            $idKategori,
            $namaLayanan,
            $satuan,
            $hargaSatuan,
            $estimasiJam,
            $deskripsi,
            $isAktif
        ]);
        $newId = (int)$pdo->lastInsertId();

        $stmtGet = $pdo->prepare('
            SELECT jl.*, kl.nama_kategori
            FROM jenis_layanan jl
            LEFT JOIN kategori_layanan kl ON jl.id_kategori = kl.id_kategori
            WHERE jl.id_layanan = ?
        ');
        $stmtGet->execute([$newId]);
        $data = $stmtGet->fetch();

        respond($data, 'Layanan berhasil ditambahkan', true, 201);
    } catch (PDOException $e) {
        respondError('Gagal menambahkan layanan: ' . $e->getMessage(), 500);
    }
}

function handlePut($pdo) {
    $body = getBody();
    $idLayanan = (int)($body['id_layanan'] ?? 0);

    if ($idLayanan <= 0) {
        respondError('ID Layanan wajib diisi', 400);
    }

    try {
        $stmtCheck = $pdo->prepare('SELECT * FROM jenis_layanan WHERE id_layanan = ?');
        $stmtCheck->execute([$idLayanan]);
        $existing = $stmtCheck->fetch();

        if (!$existing) {
            respondError('Layanan tidak ditemukan', 404);
        }

        // Support toggle is_aktif or full update
        $idKategori  = isset($body['id_kategori']) ? (int)$body['id_kategori'] : (int)$existing['id_kategori'];
        $namaLayanan = isset($body['nama_layanan']) ? sanitize($body['nama_layanan']) : $existing['nama_layanan'];
        $satuan      = isset($body['satuan']) ? sanitize($body['satuan']) : $existing['satuan'];
        $hargaSatuan = isset($body['harga_satuan']) ? (float)$body['harga_satuan'] : (float)$existing['harga_satuan'];
        $estimasiJam = isset($body['estimasi_jam']) ? (int)$body['estimasi_jam'] : (int)$existing['estimasi_jam'];
        $deskripsi   = isset($body['deskripsi']) ? sanitize($body['deskripsi']) : $existing['deskripsi'];
        $isAktif     = isset($body['is_aktif']) ? (int)(bool)$body['is_aktif'] : (int)$existing['is_aktif'];

        $allowedSatuan = ['kg', 'pcs', 'pasang', 'set'];
        if (!in_array($satuan, $allowedSatuan, true)) {
            $satuan = $existing['satuan'];
        }

        $stmtUpdate = $pdo->prepare('
            UPDATE jenis_layanan
            SET id_kategori  = ?,
                nama_layanan = ?,
                satuan       = ?,
                harga_satuan = ?,
                estimasi_jam = ?,
                deskripsi    = ?,
                is_aktif     = ?,
                updated_at   = NOW()
            WHERE id_layanan = ?
        ');
        $stmtUpdate->execute([
            $idKategori,
            $namaLayanan,
            $satuan,
            $hargaSatuan,
            $estimasiJam,
            $deskripsi,
            $isAktif,
            $idLayanan
        ]);

        $stmtGet = $pdo->prepare('
            SELECT jl.*, kl.nama_kategori
            FROM jenis_layanan jl
            LEFT JOIN kategori_layanan kl ON jl.id_kategori = kl.id_kategori
            WHERE jl.id_layanan = ?
        ');
        $stmtGet->execute([$idLayanan]);
        $updated = $stmtGet->fetch();

        respond($updated, 'Layanan berhasil diperbarui');
    } catch (PDOException $e) {
        respondError('Gagal memperbarui layanan: ' . $e->getMessage(), 500);
    }
}

function handleDelete($pdo) {
    $idLayanan = (int)($_GET['id'] ?? 0);

    if ($idLayanan <= 0) {
        respondError('ID Layanan wajib diisi', 400);
    }

    try {
        $stmtCheck = $pdo->prepare('SELECT id_layanan FROM jenis_layanan WHERE id_layanan = ?');
        $stmtCheck->execute([$idLayanan]);
        if (!$stmtCheck->fetch()) {
            respondError('Layanan tidak ditemukan', 404);
        }

        // Check if referenced in detail_pesanan
        $stmtRef = $pdo->prepare('SELECT COUNT(*) FROM detail_pesanan WHERE id_layanan = ?');
        $stmtRef->execute([$idLayanan]);
        $countRef = (int)$stmtRef->fetchColumn();

        if ($countRef > 0) {
            // Soft delete / set inactive if referenced in transactions
            $stmtDeactivate = $pdo->prepare('UPDATE jenis_layanan SET is_aktif = 0 WHERE id_layanan = ?');
            $stmtDeactivate->execute([$idLayanan]);
            respond(['id_layanan' => $idLayanan, 'is_aktif' => 0], 'Layanan digunakan pada pesanan, status dinonaktifkan alih-alih dihapus permanen');
        }

        $stmtDelete = $pdo->prepare('DELETE FROM jenis_layanan WHERE id_layanan = ?');
        $stmtDelete->execute([$idLayanan]);

        respond(['id_layanan' => $idLayanan], 'Layanan berhasil dihapus');
    } catch (PDOException $e) {
        respondError('Gagal menghapus layanan: ' . $e->getMessage(), 500);
    }
}
