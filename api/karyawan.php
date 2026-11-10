<?php
require_once 'config.php';

requireAdmin();

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
            $idKaryawan = (int)$_GET['id'];
            $stmt = $pdo->prepare('
                SELECT id_karyawan, nama_lengkap, username, email, no_telepon,
                       role, alamat, tanggal_masuk, status, created_at, updated_at
                FROM karyawan
                WHERE id_karyawan = ?
                LIMIT 1
            ');
            $stmt->execute([$idKaryawan]);
            $karyawan = $stmt->fetch();

            if (!$karyawan) {
                respondError('Karyawan tidak ditemukan', 404);
            }

            respond($karyawan, 'Data karyawan ditemukan');
        } else {
            $stmt = $pdo->query('
                SELECT id_karyawan, nama_lengkap, username, email, no_telepon,
                       role, alamat, tanggal_masuk, status, created_at, updated_at
                FROM karyawan
                ORDER BY id_karyawan ASC
            ');
            $list = $stmt->fetchAll();

            respond($list, 'Daftar karyawan berhasil diambil');
        }
    } catch (PDOException $e) {
        respondError('Gagal mengambil data karyawan: ' . $e->getMessage(), 500);
    }
}

function handlePost($pdo) {
    $body = getBody();

    $namaLengkap  = sanitize($body['nama_lengkap'] ?? '');
    $username     = sanitize($body['username'] ?? '');
    $password     = (string)($body['password'] ?? '');
    $email        = sanitize($body['email'] ?? '');
    $noTelepon    = sanitize($body['no_telepon'] ?? '');
    $role         = sanitize($body['role'] ?? 'kasir');
    $alamat       = sanitize($body['alamat'] ?? '');
    $tanggalMasuk = !empty($body['tanggal_masuk']) ? sanitize($body['tanggal_masuk']) : date('Y-m-d');
    $status       = sanitize($body['status'] ?? 'aktif');

    if (empty($namaLengkap) || empty($username) || empty($password)) {
        respondError('Nama lengkap, username, dan password wajib diisi', 400);
    }

    $allowedRoles = ['admin', 'kasir', 'operator'];
    if (!in_array($role, $allowedRoles, true)) {
        respondError('Role tidak valid. Pilihan: ' . implode(', ', $allowedRoles), 400);
    }

    if (!in_array($status, ['aktif', 'nonaktif'], true)) {
        $status = 'aktif';
    }

    try {
        // Check username uniqueness
        $stmtCheck = $pdo->prepare('SELECT COUNT(*) FROM karyawan WHERE username = ?');
        $stmtCheck->execute([$username]);
        if ((int)$stmtCheck->fetchColumn() > 0) {
            respondError('Username sudah digunakan', 400);
        }

        $passwordHash = password_hash($password, PASSWORD_BCRYPT);

        $stmt = $pdo->prepare('
            INSERT INTO karyawan (
                nama_lengkap, username, password_hash, email,
                no_telepon, role, alamat, tanggal_masuk, status
            ) VALUES (
                ?, ?, ?, ?,
                ?, ?, ?, ?, ?
            )
        ');
        $stmt->execute([
            $namaLengkap,
            $username,
            $passwordHash,
            $email,
            $noTelepon,
            $role,
            $alamat,
            $tanggalMasuk,
            $status
        ]);
        $newId = (int)$pdo->lastInsertId();

        $stmtGet = $pdo->prepare('
            SELECT id_karyawan, nama_lengkap, username, email, no_telepon,
                   role, alamat, tanggal_masuk, status, created_at, updated_at
            FROM karyawan
            WHERE id_karyawan = ?
        ');
        $stmtGet->execute([$newId]);
        $data = $stmtGet->fetch();

        respond($data, 'Karyawan berhasil ditambahkan', true, 201);
    } catch (PDOException $e) {
        respondError('Gagal menambahkan karyawan: ' . $e->getMessage(), 500);
    }
}

function handlePut($pdo) {
    $body = getBody();
    $idKaryawan = (int)($body['id_karyawan'] ?? 0);

    if ($idKaryawan <= 0) {
        respondError('ID Karyawan wajib diisi', 400);
    }

    try {
        $stmtCheck = $pdo->prepare('SELECT * FROM karyawan WHERE id_karyawan = ?');
        $stmtCheck->execute([$idKaryawan]);
        $existing = $stmtCheck->fetch();

        if (!$existing) {
            respondError('Karyawan tidak ditemukan', 404);
        }

        $namaLengkap  = isset($body['nama_lengkap']) ? sanitize($body['nama_lengkap']) : $existing['nama_lengkap'];
        $username     = isset($body['username']) ? sanitize($body['username']) : $existing['username'];
        $email        = isset($body['email']) ? sanitize($body['email']) : $existing['email'];
        $noTelepon    = isset($body['no_telepon']) ? sanitize($body['no_telepon']) : $existing['no_telepon'];
        $role         = isset($body['role']) ? sanitize($body['role']) : $existing['role'];
        $alamat       = isset($body['alamat']) ? sanitize($body['alamat']) : $existing['alamat'];
        $tanggalMasuk = isset($body['tanggal_masuk']) ? sanitize($body['tanggal_masuk']) : $existing['tanggal_masuk'];
        $status       = isset($body['status']) ? sanitize($body['status']) : $existing['status'];

        $allowedRoles = ['admin', 'kasir', 'operator'];
        if (!in_array($role, $allowedRoles, true)) {
            $role = $existing['role'];
        }

        if (!in_array($status, ['aktif', 'nonaktif'], true)) {
            $status = $existing['status'];
        }

        // Check if username was modified and is unique
        if ($username !== $existing['username']) {
            $stmtUnique = $pdo->prepare('SELECT COUNT(*) FROM karyawan WHERE username = ? AND id_karyawan != ?');
            $stmtUnique->execute([$username, $idKaryawan]);
            if ((int)$stmtUnique->fetchColumn() > 0) {
                respondError('Username sudah digunakan oleh karyawan lain', 400);
            }
        }

        // Handle password hashing if provided
        $passwordHash = $existing['password_hash'];
        if (!empty($body['password'])) {
            $passwordHash = password_hash((string)$body['password'], PASSWORD_BCRYPT);
        }

        $stmtUpdate = $pdo->prepare('
            UPDATE karyawan
            SET nama_lengkap  = ?,
                username      = ?,
                password_hash = ?,
                email         = ?,
                no_telepon    = ?,
                role          = ?,
                alamat        = ?,
                tanggal_masuk = ?,
                status        = ?,
                updated_at    = NOW()
            WHERE id_karyawan = ?
        ');
        $stmtUpdate->execute([
            $namaLengkap,
            $username,
            $passwordHash,
            $email,
            $noTelepon,
            $role,
            $alamat,
            $tanggalMasuk,
            $status,
            $idKaryawan
        ]);

        $stmtGet = $pdo->prepare('
            SELECT id_karyawan, nama_lengkap, username, email, no_telepon,
                   role, alamat, tanggal_masuk, status, created_at, updated_at
            FROM karyawan
            WHERE id_karyawan = ?
        ');
        $stmtGet->execute([$idKaryawan]);
        $updated = $stmtGet->fetch();

        respond($updated, 'Data karyawan berhasil diperbarui');
    } catch (PDOException $e) {
        respondError('Gagal memperbarui karyawan: ' . $e->getMessage(), 500);
    }
}

function handleDelete($pdo) {
    $idKaryawan = (int)($_GET['id'] ?? 0);

    if ($idKaryawan <= 0) {
        respondError('ID Karyawan wajib diisi', 400);
    }

    // Cannot delete own account
    if ($idKaryawan === (int)($_SESSION['karyawan_id'] ?? 0)) {
        respondError('Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif', 400);
    }

    try {
        $stmtCheck = $pdo->prepare('SELECT id_karyawan FROM karyawan WHERE id_karyawan = ?');
        $stmtCheck->execute([$idKaryawan]);
        if (!$stmtCheck->fetch()) {
            respondError('Karyawan tidak ditemukan', 404);
        }

        // Check if assigned in orders or payments
        $stmtCheckPesanan = $pdo->prepare('SELECT COUNT(*) FROM pesanan WHERE id_karyawan = ?');
        $stmtCheckPesanan->execute([$idKaryawan]);
        $orderCount = (int)$stmtCheckPesanan->fetchColumn();

        if ($orderCount > 0) {
            // Deactivate instead
            $stmtDeact = $pdo->prepare('UPDATE karyawan SET status = "nonaktif", updated_at = NOW() WHERE id_karyawan = ?');
            $stmtDeact->execute([$idKaryawan]);
            respond(['id_karyawan' => $idKaryawan, 'status' => 'nonaktif'], 'Karyawan memiliki riwayat transaksi, status diubah menjadi nonaktif');
        }

        $stmtDelete = $pdo->prepare('DELETE FROM karyawan WHERE id_karyawan = ?');
        $stmtDelete->execute([$idKaryawan]);

        respond(['id_karyawan' => $idKaryawan], 'Karyawan berhasil dihapus');
    } catch (PDOException $e) {
        respondError('Gagal menghapus karyawan: ' . $e->getMessage(), 500);
    }
}
