<?php
require_once 'config.php';

requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respondError('Metode request tidak diizinkan. Gunakan GET.', 405);
}

$type = sanitize($_GET['type'] ?? '');

try {
    switch ($type) {
        case 'harian':
            $stmt = $pdo->query('SELECT * FROM v_pendapatan_harian LIMIT 30');
            $data = $stmt->fetchAll();
            respond($data, 'Laporan pendapatan harian berhasil diambil');
            break;

        case 'pelanggan':
            $stmt = $pdo->query('SELECT * FROM v_pelanggan_aktif LIMIT 20');
            $data = $stmt->fetchAll();
            respond($data, 'Laporan pelanggan teraktif berhasil diambil');
            break;

        case 'layanan':
            $sql = '
                SELECT jl.nama_layanan,
                       kl.nama_kategori,
                       SUM(dp.jumlah) AS total_qty,
                       SUM(dp.subtotal) AS total_pendapatan
                FROM detail_pesanan dp
                JOIN jenis_layanan jl ON jl.id_layanan = dp.id_layanan
                JOIN kategori_layanan kl ON kl.id_kategori = jl.id_kategori
                GROUP BY dp.id_layanan, jl.nama_layanan, kl.nama_kategori
                ORDER BY total_pendapatan DESC
            ';
            $stmt = $pdo->query($sql);
            $data = $stmt->fetchAll();
            respond($data, 'Laporan performa layanan berhasil diambil');
            break;

        default:
            respondError('Parameter type laporan tidak valid. Pilihan: harian, pelanggan, layanan', 400);
            break;
    }
} catch (PDOException $e) {
    respondError('Gagal memuat laporan: ' . $e->getMessage(), 500);
}
