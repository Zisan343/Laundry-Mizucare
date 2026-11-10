// Layanan module state
let allLayanan = [];
let allKategori = [];
let activeKatFilter = 'all';
let searchDebounceTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    initModalHandlers();
    initEventListeners();
    await loadLayanan();
});

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

function initEventListeners() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                applyFilterAndRender();
            }, 300);
        });
    }

    const btnTambah = document.getElementById('btn-tambah-layanan');
    if (btnTambah) {
        btnTambah.addEventListener('click', () => {
            openLayananModal(null);
        });
    }

    const form = document.getElementById('form-layanan');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveLayanan();
        });
    }
}

async function loadLayanan() {
    const loadingEl = document.getElementById('table-loading');
    const tbody = document.getElementById('layanan-tbody');
    if (loadingEl) loadingEl.style.display = 'flex';

    try {
        const res = await api.get('layanan.php');
        const data = res.data || {};
        allKategori = data.kategori || [];
        allLayanan = data.layanan || [];

        renderKategoriTabs(allKategori);
        populateKategoriSelect(allKategori);
        applyFilterAndRender();
    } catch (err) {
        showToast('Gagal memuat layanan: ' + err.message, 'error');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--danger)">Gagal memuat data</td></tr>`;
        }
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

function renderKategoriTabs(kategoriList) {
    const container = document.getElementById('kategori-tabs');
    if (!container) return;

    let html = `<button class="page-btn ${activeKatFilter === 'all' ? 'active' : ''}" data-kat="all" style="padding: 8px 16px; font-weight: 500;">Semua Layanan</button>`;
    
    kategoriList.forEach(k => {
        const isActive = activeKatFilter === String(k.id_kategori);
        html += `<button class="page-btn ${isActive ? 'active' : ''}" data-kat="${k.id_kategori}" style="padding: 8px 16px; font-weight: 500;">${k.nama_kategori}</button>`;
    });

    container.innerHTML = html;

    container.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeKatFilter = btn.getAttribute('data-kat');
            applyFilterAndRender();
        });
    });
}

function populateKategoriSelect(kategoriList) {
    const sel = document.getElementById('layanan-kategori');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Pilih Kategori --</option>' + 
        kategoriList.map(k => `<option value="${k.id_kategori}">${k.nama_kategori}</option>`).join('');
}

function applyFilterAndRender() {
    const searchVal = document.getElementById('search-input')?.value.toLowerCase().trim() || '';

    let filtered = allLayanan;

    if (activeKatFilter !== 'all') {
        filtered = filtered.filter(l => String(l.id_kategori) === activeKatFilter);
    }

    if (searchVal) {
        filtered = filtered.filter(l => 
            (l.nama_layanan && l.nama_layanan.toLowerCase().includes(searchVal)) ||
            (l.nama_kategori && l.nama_kategori.toLowerCase().includes(searchVal)) ||
            (l.deskripsi && l.deskripsi.toLowerCase().includes(searchVal))
        );
    }

    renderLayananTable(filtered);
}

function renderLayananTable(list) {
    const tbody = document.getElementById('layanan-tbody');
    if (!tbody) return;

    if (!list || list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <div class="empty-state-icon">🧺</div>
                        <div class="empty-state-text">Tidak ada layanan ditemukan</div>
                        <div class="empty-state-sub">Ubah filter kategori atau tambahkan layanan baru.</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = list.map(l => {
        const isAktif = (l.is_aktif == 1 || l.is_aktif === true);
        const statusBadge = isAktif ? createBadge('aktif', 'Aktif') : createBadge('nonaktif', 'Nonaktif');

        return `
            <tr>
                <td>
                    <div style="font-weight:600; color:var(--text-primary);">${l.nama_layanan}</div>
                    ${l.deskripsi ? `<div style="font-size:12px; color:var(--text-muted); max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${l.deskripsi}">${l.deskripsi}</div>` : ''}
                </td>
                <td><span style="font-size:12px; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border); padding:4px 8px; border-radius:6px;">${l.nama_kategori || 'Umum'}</span></td>
                <td><span style="font-weight:500; font-family:monospace;">${l.satuan}</span></td>
                <td><strong style="color:var(--accent-light);">${formatRupiah(l.harga_satuan)}</strong></td>
                <td><span>⏳ ${l.estimasi_jam} Jam</span></td>
                <td>
                    <button class="btn btn-sm" onclick="toggleAktif(${l.id_layanan}, ${isAktif ? 1 : 0})" title="Klik untuk mengubah status aktif" style="background:transparent; border:none; padding:0; cursor:pointer;">
                        ${statusBadge}
                    </button>
                </td>
                <td style="text-align: right;">
                    <div class="actions" style="justify-content: flex-end;">
                        <button class="btn btn-secondary btn-sm" onclick="editLayanan(${l.id_layanan})" title="Edit Layanan">✏️ Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteLayanan(${l.id_layanan}, '${l.nama_layanan}')" title="Hapus Layanan">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function toggleAktif(id, currentStatus) {
    const newStatus = currentStatus === 1 ? 0 : 1;
    try {
        const res = await api.put('layanan.php', {
            id_layanan: id,
            is_aktif: newStatus
        });
        showToast(res.message || 'Status layanan diperbarui!', 'success');
        await loadLayanan();
    } catch (err) {
        showToast('Gagal mengubah status layanan: ' + err.message, 'error');
    }
}

function openLayananModal(layanan = null) {
    const titleEl = document.getElementById('modal-layanan-title');
    const form = document.getElementById('form-layanan');
    if (form) form.reset();

    if (layanan) {
        if (titleEl) titleEl.textContent = '✏️ Edit Jenis Layanan';
        document.getElementById('layanan-id').value = layanan.id_layanan;
        document.getElementById('layanan-kategori').value = layanan.id_kategori || '';
        document.getElementById('layanan-nama').value = layanan.nama_layanan || '';
        document.getElementById('layanan-satuan').value = layanan.satuan || 'kg';
        document.getElementById('layanan-harga').value = layanan.harga_satuan || 0;
        document.getElementById('layanan-estimasi').value = layanan.estimasi_jam || 24;
        document.getElementById('layanan-deskripsi').value = layanan.deskripsi || '';
    } else {
        if (titleEl) titleEl.textContent = '➕ Tambah Layanan Baru';
        document.getElementById('layanan-id').value = '';
        document.getElementById('layanan-satuan').value = 'kg';
        document.getElementById('layanan-estimasi').value = 24;
    }

    openModal('modal-layanan');
}

function editLayanan(id) {
    const l = allLayanan.find(item => item.id_layanan == id);
    if (l) {
        openLayananModal(l);
    }
}

async function saveLayanan() {
    const id = document.getElementById('layanan-id').value;
    const kategori = document.getElementById('layanan-kategori').value;
    const nama = document.getElementById('layanan-nama').value.trim();
    const satuan = document.getElementById('layanan-satuan').value;
    const harga = parseFloat(document.getElementById('layanan-harga').value);
    const estimasi = parseInt(document.getElementById('layanan-estimasi').value, 10);
    const deskripsi = document.getElementById('layanan-deskripsi').value.trim();

    if (!kategori) {
        showToast('Kategori layanan wajib dipilih', 'warning');
        return;
    }
    if (!nama) {
        showToast('Nama layanan wajib diisi', 'warning');
        return;
    }
    if (isNaN(harga) || harga <= 0) {
        showToast('Harga satuan harus lebih besar dari 0', 'warning');
        return;
    }
    if (isNaN(estimasi) || estimasi < 1) {
        showToast('Estimasi jam harus minimal 1 jam', 'warning');
        return;
    }

    const btnSubmit = document.getElementById('btn-simpan-layanan');
    if (btnSubmit) btnSubmit.disabled = true;

    try {
        const payload = {
            id_kategori: parseInt(kategori, 10),
            nama_layanan: nama,
            satuan: satuan,
            harga_satuan: harga,
            estimasi_jam: estimasi,
            deskripsi: deskripsi
        };

        if (id) {
            payload.id_layanan = parseInt(id, 10);
            const res = await api.put('layanan.php', payload);
            showToast(res.message || 'Layanan berhasil diperbarui!', 'success');
        } else {
            const res = await api.post('layanan.php', payload);
            showToast(res.message || 'Layanan baru berhasil ditambahkan!', 'success');
        }

        closeModal('modal-layanan');
        await loadLayanan();
    } catch (err) {
        showToast('Gagal menyimpan layanan: ' + err.message, 'error');
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

async function deleteLayanan(id, nama) {
    if (!confirm(`Apakah Anda yakin ingin menghapus layanan "${nama}"?\nJika layanan ini telah digunakan dalam pesanan, penghapusan mungkin ditolak atau lebih disarankan untuk menonaktifkannya.`)) {
        return;
    }

    try {
        const res = await api.delete(`layanan.php?id=${id}`);
        showToast(res.message || 'Layanan berhasil dihapus', 'success');
        await loadLayanan();
    } catch (err) {
        showToast('Gagal menghapus layanan: ' + err.message, 'error');
    }
}
