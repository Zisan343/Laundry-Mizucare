<?php
header('Content-Type: application/json; charset=UTF-8');
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header('Access-Control-Allow-Credentials: true');
} else {
    header('Access-Control-Allow-Origin: http://localhost');
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$host    = '127.0.0.1';
$port    = '3307';
$db      = 'laundry_db';
$user    = 'root';
$pass    = '';
$charset = 'utf8mb4';

try {
    try {
        $pdo = new PDO("mysql:host=$host;port=$port;dbname=$db;charset=$charset", $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $eFallback) {
        $pdo = new PDO("mysql:host=$host;port=3306;dbname=$db;charset=$charset", $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'data'    => null,
        'message' => 'Koneksi database gagal: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

function respond($data = null, $message = 'OK', $success = true, $code = 200) {
    http_response_code($code);
    echo json_encode([
        'success' => $success,
        'data'    => $data,
        'message' => $message
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

function respondError($message, $code = 400) {
    respond(null, $message, false, $code);
}

function getBody() {
    $input = file_get_contents('php://input');
    if (empty($input)) {
        return [];
    }
    $decoded = json_decode($input, true);
    return is_array($decoded) ? $decoded : [];
}

function requireAuth() {
    if (empty($_SESSION['karyawan_id'])) {
        respondError('Sesi habis, silakan login kembali', 401);
    }
}

function requireAdmin() {
    requireAuth();
    if (empty($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
        respondError('Akses ditolak - Hanya Admin', 403);
    }
}

function sanitize($val) {
    return htmlspecialchars(strip_tags(trim((string)($val ?? ''))), ENT_QUOTES, 'UTF-8');
}
