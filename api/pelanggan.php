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
            $idPelanggan = (int)$_GET['id'];
            $stmt = $pdo->prepare('
                SELECT p.*,
                       COUNT(DISTINCT ps.id_pesanan) AS total_pesanan,
                       COALESCE(SUM(ps.total_bayar), 0) AS total_belanja
                FROM pelanggan p
                LEFT JOIN pesanan ps ON p.id_pelanggan = ps.id_pelanggan
                WHERE p.id_pelanggan = ?
                GROUP BY p.id_pelanggan
                LIMIT 1
            ');
            $stmt->execute([$idPelanggan]);
            $pelanggan = $stmt->fetch();

            if (!$pelanggan) {
                respondError('Pelanggan tidak ditemukan', 404);
            }

            respond($pelanggan, 'Data pelanggan ditemukan');
        } else {
            $sql = '
                SELECT p.*,
                       COUNT(DISTINCT ps.id_pesanan) AS total_pesanan,
                       COALESCE(SUM(ps.total_bayar), 0) AS total_belanja
                FROM pelanggan p
                LEFT JOIN pesanan ps ON p.id_pelanggan = ps.id_pelanggan
                WHERE 1=1
            ';
            $params = [];

            if (!empty($_GET['search'])) {
                $search = '%' . sanitize($_GET['search']) . '%';
                $sql .= ' AND (p.nama_lengkap LIKE ? OR p.no_telepon LIKE ? OR p.email LIKE ?)';
                $params[] = $search;
                $params[] = $search;
                $params[] = $search;
            }

            $sql .= ' GROUP BY p.id_pelanggan ORDER BY p.id_pelanggan DESC';

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $list = $stmt->fetchAll();

            respond($list, 'Daftar pelanggan berhasil diambil');
        }
    } catch (PDOException $e) {
        respondError('Gagal mengambil data pelanggan: ' . $e->getMessage(), 500);
    }
}

function handlePost($pdo) {
    $body = getBody();

    $namaLengkap  = sanitize($body['nama_lengkap'] ?? '');
    $noTelepon    = sanitize($body['no_telepon'] ?? '');
    $email        = sanitize($body['email'] ?? '');
    $alamat       = sanitize($body['alamat'] ?? '');
    $jenisKelamin = sanitize($body['jenis_kelamin'] ?? 'L');
    $catatan      = sanitize($body['catatan'] ?? '');

    if (empty($namaLengkap)) {
        respondError('Nama lengkap pelanggan wajib diisi', 400);
    }

    if (!in_array($jenisKelamin, ['L', 'P', 'Lainnya'], true)) {
        $jenisKelamin = 'L';
    }

    try {
        $stmt = $pdo->prepare('
            INSERT INTO pelanggan (
                nama_lengkap, no_telepon, email, alamat,
                jenis_kelamin, tanggal_daftar, poin_loyalitas, catatan
            ) VALUES (
                ?, ?, ?, ?,
                ?, CURDATE(), 0, ?
            )
        ');
        $stmt->execute([$namaLengkap, $noTelepon, $email, $alamat, $jenisKelamin, $catatan]);
        $newId = (int)$pdo->lastInsertId();

        $stmtGet = $pdo->prepare('SELECT * FROM pelanggan WHERE id_pelanggan = ?');
        $stmtGet->execute([$newId]);
        $data = $stmtGet->fetch();

        respond($data, 'Pelanggan berhasil ditambahkan', true, 201);
    } catch (PDOException $e) {
        respondError('Gagal menambahkan pelanggan: ' . $e->getMessage(), 500);
    }
}

function handlePut($pdo) {
    $body = getBody();
    $idPelanggan = (int)($body['id_pelanggan'] ?? 0);

    if ($idPelanggan <= 0) {
        respondError('ID Pelanggan wajib diisi', 400);
    }

    try {
        $stmtCheck = $pdo->prepare('SELECT * FROM pelanggan WHERE id_pelanggan = ?');
        $stmtCheck->execute([$idPelanggan]);
        $existing = $stmtCheck->fetch();

        if (!$existing) {
            respondError('Pelanggan tidak ditemukan', 404);
        }

        $namaLengkap  = isset($body['nama_lengkap']) ? sanitize($body['nama_lengkap']) : $existing['nama_lengkap'];
        $noTelepon    = isset($body['no_telepon']) ? sanitize($body['no_telepon']) : $existing['no_telepon'];
        $email        = isset($body['email']) ? sanitize($body['email']) : $existing['email'];
        $alamat       = isset($body['alamat']) ? sanitize($body['alamat']) : $existing['alamat'];
        $jenisKelamin = isset($body['jenis_kelamin']) ? sanitize($body['jenis_kelamin']) : $existing['jenis_kelamin'];
        $catatan      = isset($body['catatan']) ? sanitize($body['catatan']) : $existing['catatan'];
        $poin         = isset($body['poin_loyalitas']) ? (int)$body['poin_loyalitas'] : $existing['poin_loyalitas'];

        if (!in_array($jenisKelamin, ['L', 'P', 'Lainnya'], true)) {
            $jenisKelamin = $existing['jenis_kelamin'];
        }

        $stmtUpdate = $pdo->prepare('
            UPDATE pelanggan
            SET nama_lengkap   = ?,
                no_telepon     = ?,
                email          = ?,
                alamat         = ?,
                jenis_kelamin  = ?,
                poin_loyalitas = ?,
                catatan        = ?,
                updated_at     = NOW()
            WHERE id_pelanggan = ?
        ');
        $stmtUpdate->execute([
            $namaLengkap,
            $noTelepon,
            $email,
            $alamat,
            $jenisKelamin,
            $poin,
            $catatan,
            $idPelanggan
        ]);

        $stmtGet = $pdo->prepare('SELECT * FROM pelanggan WHERE id_pelanggan = ?');
        $stmtGet->execute([$idPelanggan]);
        $updated = $stmtGet->fetch();

        respond($updated, 'Data pelanggan berhasil diperbarui');
    } catch (PDOException $e) {
        respondError('Gagal memperbarui pelanggan: ' . $e->getMessage(), 500);
    }
}

function handleDelete($pdo) {
    $idPelanggan = (int)($_GET['id'] ?? 0);

    if ($idPelanggan <= 0) {
        respondError('ID Pelanggan wajib diisi', 400);
    }

    try {
        $stmtCheck = $pdo->prepare('SELECT id_pelanggan FROM pelanggan WHERE id_pelanggan = ?');
        $stmtCheck->execute([$idPelanggan]);
        if (!$stmtCheck->fetch()) {
            respondError('Pelanggan tidak ditemukan', 404);
        }

        // Check if customer has active orders
        $stmtCheckOrders = $pdo->prepare('SELECT COUNT(*) FROM pesanan WHERE id_pelanggan = ?');
        $stmtCheckOrders->execute([$idPelanggan]);
        $orderCount = (int)$stmtCheckOrders->fetchColumn();

        if ($orderCount > 0) {
            respondError("Pelanggan tidak dapat dihapus karena memiliki $orderCount riwayat pesanan", 400);
        }

        $stmtDelete = $pdo->prepare('DELETE FROM pelanggan WHERE id_pelanggan = ?');
        $stmtDelete->execute([$idPelanggan]);

        respond(['id_pelanggan' => $idPelanggan], 'Pelanggan berhasil dihapus');
    } catch (PDOException $e) {
        respondError('Gagal menghapus pelanggan: ' . $e->getMessage(), 500);
    }
}
