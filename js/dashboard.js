async function loadDashboard() {
    try {
        const res = await api.get('dashboard.php');
        const d = res.data;
        
        document.getElementById('stat-pesanan-hari-ini').textContent = d.pesanan_hari_ini ?? 0;
        document.getElementById('stat-pendapatan').textContent = formatRupiah(d.pendapatan_hari_ini ?? 0);
        document.getElementById('stat-pesanan-aktif').textContent = d.pesanan_aktif ?? 0;
        document.getElementById('stat-total-pelanggan').textContent = d.total_pelanggan ?? 0;
        
        renderPesananTable(d.pesanan_terbaru);
    } catch (err) {
        const loadingEl = document.getElementById('table-loading');
        if (loadingEl) loadingEl.style.display = 'none';
        showToast('Gagal memuat data dashboard: ' + err.message, 'error');
    }
}

function renderPesananTable(pesanan) {
    const tbody = document.getElementById('pesanan-tbody');
    const loadingEl = document.getElementById('table-loading');
    if (loadingEl) loadingEl.style.display = 'none';
    
    if (!pesanan || pesanan.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted)">Belum ada pesanan hari ini</td></tr>`;
        return;
    }
    
    tbody.innerHTML = pesanan.map(p => `
        <tr>
            <td><span style="font-family:monospace;font-weight:600;color:var(--accent-light)">${p.kode_pesanan}</span></td>
            <td><strong>${p.pelanggan || '-'}</strong></td>
            <td>${p.no_telepon || '-'}</td>
            <td>${p.dilayani_oleh || '-'}</td>
            <td>${formatDateTime(p.tanggal_masuk)}</td>
            <td>${formatDateTime(p.tanggal_estimasi)}</td>
            <td>${createBadge(p.status_pesanan)}</td>
            <td>${createBadge(p.status_pembayaran)}</td>
        </tr>
    `).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadDashboard();
    
    // Set today's date
    const dateEl = document.getElementById('today-date');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
    }
});
