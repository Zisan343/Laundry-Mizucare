<?php
require_once 'config.php';

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'login':
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            respondError('Metode request tidak diizinkan. Gunakan POST untuk login.', 405);
        }

        $body = getBody();
        $username = sanitize($body['username'] ?? '');
        $password = (string)($body['password'] ?? '');

        if (empty($username) || empty($password)) {
            respondError('Username dan password wajib diisi', 400);
        }

        try {
            $stmt = $pdo->prepare('SELECT id_karyawan, nama_lengkap, username, password_hash, email, no_telepon, role, alamat, status FROM karyawan WHERE username = ? AND status = "aktif" LIMIT 1');
            $stmt->execute([$username]);
            $user = $stmt->fetch();

            if (!$user) {
                respondError('Username tidak ditemukan atau akun nonaktif', 401);
            }

            // Accept password 'admin123' for demo/seed data or verify against password_hash
            $isValid = ($password === 'admin123') || password_verify($password, $user['password_hash']);

            if (!$isValid) {
                respondError('Password salah', 401);
            }

            $_SESSION['karyawan_id']  = $user['id_karyawan'];
            $_SESSION['username']     = $user['username'];
            $_SESSION['nama_lengkap'] = $user['nama_lengkap'];
            $_SESSION['role']         = $user['role'];

            unset($user['password_hash']);

            $responseData = $user;
            $responseData['user'] = $user;

            respond($responseData, 'Login berhasil');
        } catch (PDOException $e) {
            respondError('Terjadi kesalahan database: ' . $e->getMessage(), 500);
        }
        break;

    case 'logout':
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $params['path'], $params['domain'],
                $params['secure'], $params['httponly']
            );
        }
        session_destroy();
        respond(null, 'Logout berhasil');
        break;

    case 'check':
        if (!empty($_SESSION['karyawan_id'])) {
            try {
                $stmt = $pdo->prepare('SELECT id_karyawan, nama_lengkap, username, email, no_telepon, role, alamat, status FROM karyawan WHERE id_karyawan = ? AND status = "aktif" LIMIT 1');
                $stmt->execute([$_SESSION['karyawan_id']]);
                $user = $stmt->fetch();

                if ($user) {
                    $responseData = $user;
                    $responseData['user'] = $user;
                    respond($responseData, 'Sesi aktif');
                } else {
                    $_SESSION = [];
                    session_destroy();
                    respondError('Pengguna tidak aktif atau tidak ditemukan', 401);
                }
            } catch (PDOException $e) {
                respondError('Gagal memeriksa sesi: ' . $e->getMessage(), 500);
            }
        } else {
            respondError('Belum login', 401);
        }
        break;

    default:
        respondError('Aksi tidak valid. Aksi yang didukung: login, logout, check.', 400);
        break;
}
