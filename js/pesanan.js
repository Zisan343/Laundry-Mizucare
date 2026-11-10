// State variables
let pesananList = [];
let pelangganList = [];
let layananList = [];
let searchDebounceTimer = null;
let currentDetailPesanan = null;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    initModalHandlers();
    initEventListeners();
    await loadInitialData();
    await loadPesanan();
});

// Setup modal close listeners
function initModalHandlers() {
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-close');
            closeModal(modalId);
        });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal(overlay.id);
            }
        });
    });
}

function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
}

// Initial dropdown data
async function loadInitialData() {
    try {
        const [pelRes, layRes] = await Promise.all([
            api.get('pelanggan.php'),
            api.get('layanan.php')
        ]);
        pelangganList = pelRes.data || [];
        layananList = (layRes.data && layRes.data.layanan) ? layRes.data.layanan : [];
        
        populatePelangganSelect();
    } catch (err) {
        console.error('Error loading initial data:', err);
    }
}

function populatePelangganSelect() {
    const sel = document.getElementById('buat-pelanggan');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Pilih Pelanggan --</option>' + 
        pelangganList.map(p => `<option value="${p.id_pelanggan}">${p.nama_lengkap} (${p.no_telepon || '-'})</option>`).join('');
}

// Event listeners for filter, search, forms
function initEventListeners() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                loadPesanan();
            }, 300);
        });
    }

    const filterStatus = document.getElementById('filter-status');
    if (filterStatus) {
        filterStatus.addEventListener('change', () => {
            loadPesanan();
        });
    }

    const btnTambah = document.getElementById('btn-tambah-pesanan');
    if (btnTambah) {
        btnTambah.addEventListener('click', () => {
            openBuatPesanan();
        });
    }

    const btnAddItem = document.getElementById('btn-add-item');
    const btnAddItemDashed = document.getElementById('btn-add-item-dashed');
    if (btnAddItem) btnAddItem.addEventListener('click', addItemRow);
    if (btnAddItemDashed) btnAddItemDashed.addEventListener('click', addItemRow);

    const formBuat = document.getElementById('form-buat-pesanan');
    if (formBuat) {
        formBuat.addEventListener('submit', async (e) => {
            e.preventDefault();
            await savePesanan();
        });
    }

    const formBayar = document.getElementById('form-bayar');
    if (formBayar) {
        formBayar.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveBayar();
        });
    }

    const bayarJumlahInput = document.getElementById('bayar-jumlah');
    if (bayarJumlahInput) {
        bayarJumlahInput.addEventListener('input', calculateKembalian);
    }

    const formStatus = document.getElementById('form-update-status');
    if (formStatus) {
        formStatus.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('status-id-pesanan').value;
            const status = document.getElementById('status-pilihan').value;
            await saveUpdateStatus(id, status);
        });
    }
}

// Load pesanan with search and status filter
async function loadPesanan() {
    const loadingEl = document.getElementById('table-loading');
    const tbody = document.getElementById('pesanan-tbody');
    if (loadingEl) loadingEl.style.display = 'flex';

    try {
        const search = document.getElementById('search-input')?.value.trim() || '';
        const status = document.getElementById('filter-status')?.value || '';

        let endpoint = 'pesanan.php';
        const params = [];
        if (search) params.push(`search=${encodeURIComponent(search)}`);
        if (status) params.push(`status=${encodeURIComponent(status)}`);
        if (params.length > 0) endpoint += `?${params.join('&')}`;

        const res = await api.get(endpoint);
        pesananList = res.data || [];
        renderPesananTable(pesananList);
    } catch (err) {
        showToast('Gagal memuat daftar pesanan: ' + err.message, 'error');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--danger)">Gagal memuat data</td></tr>`;
        }
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

function renderPesananTable(list) {
    const tbody = document.getElementById('pesanan-tbody');
    if (!tbody) return;

    if (!list || list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        <div class="empty-state-icon">📦</div>
                        <div class="empty-state-text">Belum ada data pesanan</div>
                        <div class="empty-state-sub">Buat pesanan baru atau ubah kata kunci pencarian.</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = list.map(p => {
        const statusBayar = p.status_pembayaran || (p.total_bayar <= 0 ? 'lunas' : 'belum_bayar');
        return `
            <tr>
                <td><strong style="font-family:monospace; color:var(--accent-light);">${p.kode_pesanan}</strong></td>
                <td>
                    <div style="font-weight:600; color:var(--text-primary);">${p.nama_pelanggan || '-'}</div>
                    <div style="font-size:12px; color:var(--text-muted);">${p.telp_pelanggan || '-'}</div>
                </td>
                <td><span style="font-size:12px; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border); padding:4px 8px; border-radius:6px;">${p.total_berat ? p.total_berat + ' kg' : 'Detail'}</span></td>
                <td>${formatDateTime(p.tanggal_masuk)}</td>
                <td>${formatDateTime(p.tanggal_estimasi)}</td>
                <td><strong style="color:var(--accent-light);">${formatRupiah(p.total_bayar)}</strong></td>
                <td>${createBadge(p.status_pesanan)}</td>
                <td>${createBadge(statusBayar)}</td>
                <td style="text-align: right;">
                    <div class="actions" style="justify-content: flex-end;">
                        <button class="btn btn-secondary btn-sm" onclick="openDetail(${p.id_pesanan})" title="Lihat Detail">🔍 Detail</button>
                        <button class="btn btn-secondary btn-sm" onclick="openQuickStatus(${p.id_pesanan}, '${p.kode_pesanan}', '${p.status_pesanan}')" title="Ubah Status">🔄</button>
                        ${statusBayar !== 'lunas' ? `<button class="btn btn-success btn-sm" onclick="openBayar(${p.id_pesanan}, '${p.kode_pesanan}', ${p.total_bayar})" title="Bayar">💳 Bayar</button>` : ''}
                        <button class="btn btn-danger btn-sm" onclick="deletePesanan(${p.id_pesanan}, '${p.kode_pesanan}')" title="Hapus">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Detail Modal
async function openDetail(id) {
    try {
        const res = await api.get(`pesanan.php?id=${id}`);
        const p = res.data;
        currentDetailPesanan = p;

        const modalTitle = document.getElementById('detail-modal-title');
        if (modalTitle) modalTitle.textContent = `📦 Detail Pesanan: ${p.kode_pesanan}`;

        const isLunas = p.pembayaran && p.pembayaran.length > 0 && p.pembayaran.some(b => b.status_bayar === 'lunas');
        const statusBayarStr = isLunas ? 'lunas' : 'belum_bayar';

        const bodyEl = document.getElementById('detail-modal-body');
        bodyEl.innerHTML = `
            <div class="detail-grid" style="margin-bottom:20px;">
                <div class="detail-item">
                    <span class="detail-label">Pelanggan</span>
                    <span class="detail-value">${p.nama_pelanggan || '-'} (${p.telp_pelanggan || '-'})</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Alamat Pelanggan</span>
                    <span class="detail-value">${p.alamat_pelanggan || '-'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Petugas Penerima</span>
                    <span class="detail-value">${p.nama_karyawan || '-'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Status Pengerjaan</span>
                    <span class="detail-value">${createBadge(p.status_pesanan)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Tanggal Masuk</span>
                    <span class="detail-value">${formatDateTime(p.tanggal_masuk)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Estimasi Selesai</span>
                    <span class="detail-value">${formatDateTime(p.tanggal_estimasi)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Catatan Pesanan</span>
                    <span class="detail-value">${p.catatan_pesanan || '-'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Status Pembayaran</span>
                    <span class="detail-value">${createBadge(statusBayarStr)}</span>
                </div>
            </div>

            <h4 style="font-size:14px; margin-bottom:10px; color:var(--text-primary); font-weight:600;">Daftar Item Layanan:</h4>
            <div class="items-list" style="margin-bottom:20px;">
                ${(p.detail_pesanan || []).map(item => `
                    <div class="item-row">
                        <div class="item-name">
                            <div style="font-weight:600;">${item.nama_layanan}</div>
                            <div style="font-size:12px; color:var(--text-muted);">${item.nama_kategori || 'Reguler'} ${item.catatan_item ? '• Catatan: ' + item.catatan_item : ''}</div>
                        </div>
                        <div class="item-qty">${item.jumlah} ${item.satuan} &times; ${formatRupiah(item.harga_satuan)}</div>
                        <div class="item-price">${formatRupiah(item.subtotal)}</div>
                    </div>
                `).join('')}
            </div>

            <div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px; color:var(--text-secondary);">
                    <span>Subtotal:</span>
                    <span>${formatRupiah(p.subtotal)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:13px; color:var(--text-secondary);">
                    <span>Diskon:</span>
                    <span>${formatRupiah(p.diskon || 0)}</span>
                </div>
                <div class="divider" style="margin:8px 0;"></div>
                <div style="display:flex; justify-content:space-between; font-size:16px; font-weight:700;">
                    <span style="color:var(--text-primary);">Total Tagihan:</span>
                    <span style="color:var(--accent-light);">${formatRupiah(p.total_bayar)}</span>
                </div>
            </div>

            <h4 style="font-size:14px; margin-bottom:10px; color:var(--text-primary); font-weight:600;">Riwayat Pembayaran:</h4>
            ${(p.pembayaran && p.pembayaran.length > 0) ? `
                <div class="table-responsive">
                    <table class="data-table" style="font-size:13px;">
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>Metode</th>
                                <th>Kasir</th>
                                <th>Jumlah Bayar</th>
                                <th>Kembali</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${p.pembayaran.map(b => `
                                <tr>
                                    <td>${formatDateTime(b.tanggal_bayar)}</td>
                                    <td><span style="text-transform:uppercase;">${b.metode_bayar}</span></td>
                                    <td>${b.nama_kasir || '-'}</td>
                                    <td>${formatRupiah(b.jumlah_bayar)}</td>
                                    <td>${formatRupiah(b.jumlah_kembali)}</td>
                                    <td>${createBadge(b.status_bayar)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : '<p style="color:var(--text-muted); font-size:13px;">Belum ada riwayat pembayaran.</p>'}
        `;

        const footerEl = document.getElementById('detail-modal-footer');
        footerEl.innerHTML = `
            <button class="btn btn-secondary" data-close="modal-detail">Tutup</button>
            ${!isLunas ? `<button class="btn btn-success" onclick="closeModal('modal-detail'); openBayar(${p.id_pesanan}, '${p.kode_pesanan}', ${p.total_bayar})">💳 Bayar Sekarang</button>` : ''}
        `;
        initModalHandlers();

        openModal('modal-detail');
    } catch (err) {
        showToast('Gagal memuat detail pesanan: ' + err.message, 'error');
    }
}

// Buat Pesanan
function openBuatPesanan() {
    const form = document.getElementById('form-buat-pesanan');
    if (form) form.reset();

    const container = document.getElementById('items-container');
    if (container) {
        container.innerHTML = '';
        addItemRow(); // Start with 1 item
    }

    calculateTotal();
    openModal('modal-buat');
}

function addItemRow() {
    const container = document.getElementById('items-container');
    if (!container) return;

    const rowId = 'item-row-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const row = document.createElement('div');
    row.className = 'item-row';
    row.id = rowId;
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr auto';
    row.style.gap = '10px';
    row.style.alignItems = 'center';

    const optionsHtml = layananList.map(l => 
        `<option value="${l.id_layanan}" data-harga="${l.harga_satuan}" data-satuan="${l.satuan}">
            ${l.nama_layanan} (${formatRupiah(l.harga_satuan)} / ${l.satuan})
        </option>`
    ).join('');

    row.innerHTML = `
        <div>
            <select class="form-select select-layanan" required style="font-size:13px; padding:8px 12px;">
                <option value="">-- Pilih Layanan --</option>
                ${optionsHtml}
            </select>
        </div>
        <div>
            <input type="number" class="form-input input-jumlah" placeholder="Jumlah" min="0.1" step="0.1" value="1" required style="font-size:13px; padding:8px 12px;">
        </div>
        <div>
            <input type="text" class="form-input input-catatan" placeholder="Catatan item..." style="font-size:13px; padding:8px 12px;">
        </div>
        <div style="font-size:13px; font-weight:600; color:var(--accent-light); text-align:right;" class="item-subtotal-display">
            Rp 0
        </div>
        <div>
            <button type="button" class="btn btn-danger btn-sm" style="padding:6px 10px;" title="Hapus Item" onclick="removeItemRow('${rowId}')">✕</button>
        </div>
    `;

    container.appendChild(row);

    const select = row.querySelector('.select-layanan');
    const inputJumlah = row.querySelector('.input-jumlah');

    select.addEventListener('change', calculateTotal);
    inputJumlah.addEventListener('input', calculateTotal);

    calculateTotal();
}

function removeItemRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        const container = document.getElementById('items-container');
        if (container.children.length > 1) {
            row.remove();
            calculateTotal();
        } else {
            showToast('Minimal harus ada 1 item layanan', 'warning');
        }
    }
}

function calculateTotal() {
    let grandTotal = 0;
    const rows = document.querySelectorAll('#items-container .item-row');

    rows.forEach(row => {
        const sel = row.querySelector('.select-layanan');
        const qtyInput = row.querySelector('.input-jumlah');
        const subtotalEl = row.querySelector('.item-subtotal-display');

        const opt = sel.options[sel.selectedIndex];
        const harga = opt && opt.getAttribute('data-harga') ? parseFloat(opt.getAttribute('data-harga')) : 0;
        const qty = parseFloat(qtyInput.value) || 0;
        const subtotal = harga * qty;

        if (subtotalEl) {
            subtotalEl.textContent = formatRupiah(subtotal);
        }
        grandTotal += subtotal;
    });

    const display = document.getElementById('buat-total-display');
    if (display) {
        display.textContent = formatRupiah(grandTotal);
    }
}

async function savePesanan() {
    const idPelanggan = document.getElementById('buat-pelanggan').value;
    const catatan = document.getElementById('buat-catatan').value;

    if (!idPelanggan) {
        showToast('Pilih pelanggan terlebih dahulu', 'warning');
        return;
    }

    const rows = document.querySelectorAll('#items-container .item-row');
    const items = [];

    for (const row of rows) {
        const sel = row.querySelector('.select-layanan');
        const qtyInput = row.querySelector('.input-jumlah');
        const catInput = row.querySelector('.input-catatan');

        const idLayanan = parseInt(sel.value, 10);
        const jumlah = parseFloat(qtyInput.value);
        const catatanItem = catInput.value.trim();

        if (!idLayanan || isNaN(idLayanan)) {
            showToast('Semua item layanan wajib dipilih', 'warning');
            return;
        }

        if (!jumlah || isNaN(jumlah) || jumlah <= 0) {
            showToast('Jumlah setiap item harus lebih besar dari 0', 'warning');
            return;
        }

        items.push({
            id_layanan: idLayanan,
            jumlah: jumlah,
            catatan_item: catatanItem
        });
    }

    if (items.length === 0) {
        showToast('Tambahkan minimal 1 item layanan', 'warning');
        return;
    }

    const btnSimpan = document.getElementById('btn-simpan-pesanan');
    if (btnSimpan) btnSimpan.disabled = true;

    try {
        const payload = {
            id_pelanggan: parseInt(idPelanggan, 10),
            catatan_pesanan: catatan,
            items: items
        };

        const res = await api.post('pesanan.php', payload);
        showToast(res.message || 'Pesanan berhasil dibuat!', 'success');
        closeModal('modal-buat');
        await loadPesanan();
    } catch (err) {
        showToast('Gagal menyimpan pesanan: ' + err.message, 'error');
    } finally {
        if (btnSimpan) btnSimpan.disabled = false;
    }
}

// Quick Status Update
function openQuickStatus(id, kode, currentStatus) {
    document.getElementById('status-id-pesanan').value = id;
    document.getElementById('status-kode').textContent = kode;
    document.getElementById('status-pilihan').value = currentStatus;
    openModal('modal-status');
}

async function saveUpdateStatus(id, status) {
    try {
        const res = await api.put('pesanan.php', {
            id_pesanan: parseInt(id, 10),
            status_pesanan: status
        });
        showToast(res.message || 'Status pesanan berhasil diperbarui!', 'success');
        closeModal('modal-status');
        await loadPesanan();
    } catch (err) {
        showToast('Gagal update status: ' + err.message, 'error');
    }
}

// Pembayaran
let currentBayarTotal = 0;

function openBayar(id, kode, total) {
    currentBayarTotal = parseFloat(total) || 0;
    document.getElementById('bayar-id-pesanan').value = id;
    document.getElementById('bayar-kode').textContent = kode;
    document.getElementById('bayar-tagihan').textContent = formatRupiah(currentBayarTotal);
    
    const bayarInput = document.getElementById('bayar-jumlah');
    bayarInput.value = currentBayarTotal;
    calculateKembalian();

    document.getElementById('bayar-referensi').value = '';
    document.getElementById('bayar-catatan').value = '';
    document.getElementById('bayar-metode').value = 'tunai';

    openModal('modal-bayar');
}

function calculateKembalian() {
    const bayarInput = document.getElementById('bayar-jumlah');
    const displayKembali = document.getElementById('bayar-kembali');
    const jumlahBayar = parseFloat(bayarInput.value) || 0;
    const kembali = jumlahBayar - currentBayarTotal;

    if (kembali >= 0) {
        displayKembali.textContent = formatRupiah(kembali);
        displayKembali.style.color = 'var(--success)';
    } else {
        displayKembali.textContent = `Kurang ${formatRupiah(Math.abs(kembali))}`;
        displayKembali.style.color = 'var(--danger)';
    }
}

async function saveBayar() {
    const idPesanan = parseInt(document.getElementById('bayar-id-pesanan').value, 10);
    const metode = document.getElementById('bayar-metode').value;
    const jumlah = parseFloat(document.getElementById('bayar-jumlah').value) || 0;
    const referensi = document.getElementById('bayar-referensi').value.trim();
    const catatan = document.getElementById('bayar-catatan').value.trim();

    if (jumlah < currentBayarTotal) {
        showToast('Jumlah uang yang dibayarkan kurang dari total tagihan', 'warning');
        return;
    }

    const btnSubmit = document.getElementById('btn-submit-bayar');
    if (btnSubmit) btnSubmit.disabled = true;

    try {
        const payload = {
            id_pesanan: idPesanan,
            metode_bayar: metode,
            jumlah_bayar: jumlah,
            referensi: referensi,
            catatan: catatan
        };

        const res = await api.post('pembayaran.php', payload);
        showToast(res.message || 'Pembayaran berhasil diproses!', 'success');
        closeModal('modal-bayar');
        await loadPesanan();
    } catch (err) {
        showToast('Gagal memproses pembayaran: ' + err.message, 'error');
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

// Delete Pesanan
async function deletePesanan(id, kode) {
    if (!confirm(`Apakah Anda yakin ingin menghapus pesanan ${kode}?\nData pesanan ini tidak dapat dikembalikan.`)) {
        return;
    }

    try {
        const res = await api.delete(`pesanan.php?id=${id}`);
        showToast(res.message || 'Pesanan berhasil dihapus', 'success');
        await loadPesanan();
    } catch (err) {
        showToast('Gagal menghapus pesanan: ' + err.message, 'error');
    }
}
