<?php
require_once 'config.php';

requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respondError('Metode request tidak diizinkan. Gunakan GET.', 405);
}

try {
    // 1. Pesanan Hari Ini
    $stmtPesananHariIni = $pdo->query('SELECT COUNT(*) AS total FROM pesanan WHERE DATE(tanggal_masuk) = CURDATE()');
    $pesananHariIni = (int)($stmtPesananHariIni->fetchColumn() ?? 0);

    // 2. Pendapatan Hari Ini
    $stmtPendapatanHariIni = $pdo->query("SELECT COALESCE(SUM(jumlah_bayar), 0) AS total FROM pembayaran WHERE DATE(tanggal_bayar) = CURDATE() AND status_bayar = 'lunas'");
    $pendapatanHariIni = (float)($stmtPendapatanHariIni->fetchColumn() ?? 0);

    // 3. Pesanan Aktif
    $stmtPesananAktif = $pdo->query("SELECT COUNT(*) AS total FROM pesanan WHERE status_pesanan IN ('menunggu', 'diproses', 'selesai')");
    $pesananAktif = (int)($stmtPesananAktif->fetchColumn() ?? 0);

    // 4. Total Pelanggan
    $stmtTotalPelanggan = $pdo->query('SELECT COUNT(*) AS total FROM pelanggan');
    $totalPelanggan = (int)($stmtTotalPelanggan->fetchColumn() ?? 0);

    // 5. Pesanan Terbaru dari v_pesanan_aktif
    $stmtPesananTerbaru = $pdo->query('SELECT * FROM v_pesanan_aktif LIMIT 8');
    $pesananTerbaru = $stmtPesananTerbaru->fetchAll();

    respond([
        'pesanan_hari_ini'    => $pesananHariIni,
        'pendapatan_hari_ini' => $pendapatanHariIni,
        'pesanan_aktif'       => $pesananAktif,
        'total_pelanggan'     => $totalPelanggan,
        'pesanan_terbaru'     => $pesananTerbaru
    ], 'Data dashboard berhasil dimuat');
} catch (PDOException $e) {
    respondError('Gagal memuat data dashboard: ' . $e->getMessage(), 500);
}
