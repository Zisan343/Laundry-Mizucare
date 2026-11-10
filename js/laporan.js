// Laporan module state
let currentTab = 'harian';
let harianData = [];
let pelangganData = [];
let layananData = [];

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    initTabs();
    await loadPendapatan();
});

function initTabs() {
    const tabBtns = document.querySelectorAll('.report-tabs-nav button');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    currentTab = tabName;

    // Update button styles
    document.querySelectorAll('.report-tabs-nav button').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Toggle tab sections
    const tabs = ['harian', 'pelanggan', 'layanan'];
    tabs.forEach(t => {
        const el = document.getElementById(`tab-content-${t}`);
        if (el) {
            el.style.display = (t === tabName) ? 'block' : 'none';
        }
    });

    // Load data if not already loaded
    if (tabName === 'harian' && harianData.length === 0) {
        loadPendapatan();
    } else if (tabName === 'pelanggan' && pelangganData.length === 0) {
        loadPelangganAktif();
    } else if (tabName === 'layanan' && layananData.length === 0) {
        loadPerformaLayanan();
    }
}

// 1. PENDAPATAN HARIAN
async function loadPendapatan() {
    const loadingEl = document.getElementById('loading-harian');
    const tbody = document.getElementById('harian-tbody');
    const tfoot = document.getElementById('harian-tfoot');
    if (loadingEl) loadingEl.style.display = 'flex';

    try {
        const res = await api.get('laporan.php?type=harian');
        harianData = res.data || [];

        renderPendapatanTable(harianData);
        renderChart(harianData);
    } catch (err) {
        showToast('Gagal memuat laporan harian: ' + err.message, 'error');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--danger)">Gagal memuat data laporan</td></tr>`;
        }
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

function renderPendapatanTable(data) {
    const tbody = document.getElementById('harian-tbody');
    const tfoot = document.getElementById('harian-tfoot');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4">
                    <div class="empty-state">
                        <div class="empty-state-icon">📊</div>
                        <div class="empty-state-text">Belum ada data pendapatan</div>
                        <div class="empty-state-sub">Transaksi yang telah lunas akan otomatis tercatat di sini.</div>
                    </div>
                </td>
            </tr>
        `;
        if (tfoot) tfoot.innerHTML = '';
        return;
    }

    let totalTrx = 0;
    let totalOmset = 0;
    let totalDiskon = 0;

    tbody.innerHTML = data.map(row => {
        const trx = parseInt(row.jumlah_transaksi, 10) || 0;
        const omset = parseFloat(row.total_pendapatan) || 0;
        const diskon = parseFloat(row.total_diskon) || 0;

        totalTrx += trx;
        totalOmset += omset;
        totalDiskon += diskon;

        return `
            <tr>
                <td><strong>${formatDate(row.tanggal)}</strong></td>
                <td><span style="font-size:13px; background:var(--bg-secondary); border:1px solid var(--border); padding:4px 10px; border-radius:6px;">${trx} Transaksi</span></td>
                <td><strong style="color:var(--accent-light);">${formatRupiah(omset)}</strong></td>
                <td><span style="color:var(--text-muted);">${formatRupiah(diskon)}</span></td>
            </tr>
        `;
    }).join('');

    if (tfoot) {
        tfoot.innerHTML = `
            <tr>
                <td style="color:var(--text-primary); font-size:14px;">TOTAL SEMUA</td>
                <td style="color:var(--text-primary);">${totalTrx} Transaksi</td>
                <td style="color:var(--accent-light); font-size:15px;">${formatRupiah(totalOmset)}</td>
                <td style="color:var(--text-muted);">${formatRupiah(totalDiskon)}</td>
            </tr>
        `;
    }
}

// 2. CHART PENDAPATAN (Canvas API)
function renderChart(data) {
    const canvas = document.getElementById('chart-pendapatan');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Reset canvas with clear
    ctx.clearRect(0, 0, width, height);

    // Take up to 7 entries and reverse for chronological order (left to right)
    const chartItems = [...data].slice(0, 7).reverse();

    if (chartItems.length === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Belum ada transaksi dalam 7 hari terakhir', width / 2, height / 2);
        return;
    }

    const padding = { top: 30, right: 30, bottom: 45, left: 70 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const maxVal = Math.max(...chartItems.map(d => parseFloat(d.total_pendapatan) || 0), 100000);

    // Draw horizontal grid lines & Y-axis labels
    const gridLines = 4;
    ctx.strokeStyle = 'rgba(70, 85, 75, 0.15)';
    ctx.lineWidth = 1;
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = '#576059';
    ctx.textAlign = 'right';

    for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (chartHeight / gridLines) * i;
        const val = maxVal * (1 - i / gridLines);

        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();

        let labelVal = '';
        if (val >= 1000000) labelVal = (val / 1000000).toFixed(1) + 'M';
        else if (val >= 1000) labelVal = (val / 1000).toFixed(0) + 'k';
        else labelVal = val.toFixed(0);

        ctx.fillText('Rp ' + labelVal, padding.left - 10, y + 4);
    }

    // Bar dimensions
    const count = chartItems.length;
    const slotWidth = chartWidth / count;
    const barWidth = Math.min(slotWidth * 0.55, 48);

    chartItems.forEach((item, idx) => {
        const val = parseFloat(item.total_pendapatan) || 0;
        const barHeight = (val / maxVal) * chartHeight;
        const x = padding.left + (idx * slotWidth) + (slotWidth - barWidth) / 2;
        const y = padding.top + chartHeight - barHeight;

        // Gradient for bars (calm earthy sage to slate blue)
        const grad = ctx.createLinearGradient(x, y, x, padding.top + chartHeight);
        grad.addColorStop(0, '#367d6c');
        grad.addColorStop(1, '#3e7f9e');

        // Draw bar with rounded top
        ctx.fillStyle = grad;
        const radius = Math.min(6, barHeight / 2);
        
        ctx.beginPath();
        ctx.moveTo(x, padding.top + chartHeight);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, padding.top + chartHeight);
        ctx.closePath();
        ctx.fill();

        // Bar value on top if space permits
        if (val > 0) {
            ctx.fillStyle = '#252926';
            ctx.font = '600 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            let shortVal = val >= 1000000 ? (val / 1000000).toFixed(1) + 'M' : (val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val);
            ctx.fillText(shortVal, x + barWidth / 2, y - 6);
        }

        // X-axis label (date formatted)
        ctx.fillStyle = '#576059';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        const d = new Date(item.tanggal);
        const dayLabel = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
        ctx.fillText(dayLabel, x + barWidth / 2, height - 15);
    });
}

// 3. PELANGGAN AKTIF
async function loadPelangganAktif() {
    const loadingEl = document.getElementById('loading-pelanggan');
    const tbody = document.getElementById('pelanggan-tbody');
    if (loadingEl) loadingEl.style.display = 'flex';

    try {
        const res = await api.get('laporan.php?type=pelanggan');
        pelangganData = res.data || [];
        renderPelangganAktifTable(pelangganData);
    } catch (err) {
        showToast('Gagal memuat pelanggan aktif: ' + err.message, 'error');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--danger)">Gagal memuat data</td></tr>`;
        }
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

function renderPelangganAktifTable(data) {
    const tbody = document.getElementById('pelanggan-tbody');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state">
                        <div class="empty-state-icon">👥</div>
                        <div class="empty-state-text">Belum ada pelanggan aktif</div>
                        <div class="empty-state-sub">Data akan terisi seiring transaksi pelanggan.</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = data.map((p, idx) => {
        let medal = `#${idx + 1}`;
        if (idx === 0) medal = '🥇 #1';
        else if (idx === 1) medal = '🥈 #2';
        else if (idx === 2) medal = '🥉 #3';

        return `
            <tr>
                <td><strong style="font-size:14px; color:${idx < 3 ? 'var(--warning)' : 'var(--text-muted)'};">${medal}</strong></td>
                <td><strong style="color:var(--text-primary); font-size:14px;">${p.nama_lengkap}</strong></td>
                <td>${p.no_telepon || '-'}</td>
                <td>
                    <span class="badge" style="background:rgba(212,154,48,0.10); color:#9e6e1a; border:1px solid rgba(212,154,48,0.22);">
                        ⭐ ${p.poin_loyalitas || 0}
                    </span>
                </td>
                <td><strong>${p.total_pesanan || 0}</strong> Kali</td>
                <td><strong style="color:var(--accent-light); font-size:14px;">${formatRupiah(p.total_belanja || 0)}</strong></td>
            </tr>
        `;
    }).join('');
}

// 4. PERFORMA LAYANAN
async function loadPerformaLayanan() {
    const loadingEl = document.getElementById('loading-layanan');
    const tbody = document.getElementById('layanan-tbody');
    if (loadingEl) loadingEl.style.display = 'flex';

    try {
        const res = await api.get('laporan.php?type=layanan');
        layananData = res.data || [];
        renderPerformaLayananTable(layananData);
    } catch (err) {
        showToast('Gagal memuat performa layanan: ' + err.message, 'error');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--danger)">Gagal memuat data</td></tr>`;
        }
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

function renderPerformaLayananTable(data) {
    const tbody = document.getElementById('layanan-tbody');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <div class="empty-state-icon">🧺</div>
                        <div class="empty-state-text">Belum ada data performa layanan</div>
                        <div class="empty-state-sub">Data layanan akan terakumulasi dari pesanan selesai.</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const maxPendapatan = Math.max(...data.map(d => parseFloat(d.total_pendapatan) || 0), 1);

    tbody.innerHTML = data.map(item => {
        const omset = parseFloat(item.total_pendapatan) || 0;
        const percentage = ((omset / maxPendapatan) * 100).toFixed(1);

        return `
            <tr>
                <td><strong style="color:var(--text-primary);">${item.nama_layanan}</strong></td>
                <td><span style="font-size:12px; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border); padding:4px 8px; border-radius:6px;">${item.nama_kategori || 'Umum'}</span></td>
                <td><span style="font-weight:600;">${item.total_qty || 0}</span></td>
                <td><strong style="color:var(--accent-light);">${formatRupiah(omset)}</strong></td>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="flex:1; height:8px; background:var(--bg-secondary); border:1px solid var(--border); border-radius:999px; overflow:hidden;">
                            <div style="height:100%; width:${percentage}%; background:var(--accent-gradient); border-radius:999px;"></div>
                        </div>
                        <span style="font-size:12px; color:var(--text-muted); min-width:40px; text-align:right;">${percentage}%</span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}
