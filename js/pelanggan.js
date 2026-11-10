// Pelanggan module state
let pelangganList = [];
let searchDebounceTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    initModalHandlers();
    initEventListeners();
    await loadPelanggan();
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
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                loadPelanggan(e.target.value.trim());
            }, 300);
        });
    }

    const btnTambah = document.getElementById('btn-tambah-pelanggan');
    if (btnTambah) {
        btnTambah.addEventListener('click', () => {
            openPelangganModal(null);
        });
    }

    const form = document.getElementById('form-pelanggan');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await savePelanggan();
        });
    }
}

async function loadPelanggan(search = '') {
    const loadingEl = document.getElementById('table-loading');
    const tbody = document.getElementById('pelanggan-tbody');
    if (loadingEl) loadingEl.style.display = 'flex';

    try {
        let endpoint = 'pelanggan.php';
        if (search) {
            endpoint += `?search=${encodeURIComponent(search)}`;
        }

        const res = await api.get(endpoint);
        pelangganList = res.data || [];

        updateStats(pelangganList);
        renderPelangganTable(pelangganList);
    } catch (err) {
        showToast('Gagal memuat data pelanggan: ' + err.message, 'error');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--danger)">Gagal memuat data</td></tr>`;
        }
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

function updateStats(list) {
    const totalEl = document.getElementById('stat-total-pelanggan');
    const topBelanjaEl = document.getElementById('stat-top-pelanggan');
    const topPoinEl = document.getElementById('stat-top-poin');

    if (totalEl) totalEl.textContent = list.length;

    if (!list || list.length === 0) {
        if (topBelanjaEl) topBelanjaEl.textContent = '-';
        if (topPoinEl) topPoinEl.textContent = '-';
        return;
    }

    // Top belanja
    const sortedBelanja = [...list].sort((a, b) => (parseFloat(b.total_belanja) || 0) - (parseFloat(a.total_belanja) || 0));
    const topB = sortedBelanja[0];
    if (topBelanjaEl && topB) {
        const val = parseFloat(topB.total_belanja) || 0;
        topBelanjaEl.innerHTML = `<strong>${topB.nama_lengkap}</strong><br><span style="font-size:13px; color:var(--accent-light); font-weight:normal;">${formatRupiah(val)}</span>`;
    }

    // Top poin
    const sortedPoin = [...list].sort((a, b) => (parseInt(b.poin_loyalitas, 10) || 0) - (parseInt(a.poin_loyalitas, 10) || 0));
    const topP = sortedPoin[0];
    if (topPoinEl && topP) {
        const val = parseInt(topP.poin_loyalitas, 10) || 0;
        topPoinEl.innerHTML = `<strong>${topP.nama_lengkap}</strong><br><span style="font-size:13px; color:var(--warning); font-weight:normal;">${val} Poin</span>`;
    }
}

function renderPelangganTable(list) {
    const tbody = document.getElementById('pelanggan-tbody');
    if (!tbody) return;

    if (!list || list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        <div class="empty-state-icon">👥</div>
                        <div class="empty-state-text">Belum ada data pelanggan</div>
                        <div class="empty-state-sub">Tambah pelanggan baru untuk memulai.</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = list.map((p, idx) => `
        <tr>
            <td style="color:var(--text-muted); font-size:13px;">${idx + 1}</td>
            <td>
                <div style="font-weight:600; color:var(--text-primary);">${p.nama_lengkap}</div>
                <div style="font-size:11px; color:var(--text-muted);">${p.jenis_kelamin === 'P' ? 'Perempuan' : (p.jenis_kelamin === 'L' ? 'Laki-laki' : 'Lainnya')}</div>
            </td>
            <td>${p.no_telepon || '-'}</td>
            <td>${p.email || '-'}</td>
            <td><span style="font-size:13px; color:var(--text-secondary); max-width:180px; display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${p.alamat || ''}">${p.alamat || '-'}</span></td>
            <td>
                <span class="badge" style="background:rgba(212,154,48,0.10); color:#9e6e1a; border:1px solid rgba(212,154,48,0.22);">
                    ⭐ ${p.poin_loyalitas || 0}
                </span>
            </td>
            <td><strong>${p.total_pesanan || 0}</strong></td>
            <td><strong style="color:var(--accent-light);">${formatRupiah(p.total_belanja || 0)}</strong></td>
            <td style="text-align: right;">
                <div class="actions" style="justify-content: flex-end;">
                    <button class="btn btn-secondary btn-sm" onclick="editPelanggan(${p.id_pelanggan})" title="Edit Data">✏️ Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deletePelanggan(${p.id_pelanggan}, '${p.nama_lengkap}')" title="Hapus Pelanggan">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function openPelangganModal(pelanggan = null) {
    const titleEl = document.getElementById('modal-pelanggan-title');
    const form = document.getElementById('form-pelanggan');
    const groupPoin = document.getElementById('group-poin');
    if (form) form.reset();

    if (pelanggan) {
        if (titleEl) titleEl.textContent = '✏️ Edit Data Pelanggan';
        document.getElementById('pelanggan-id').value = pelanggan.id_pelanggan;
        document.getElementById('pelanggan-nama').value = pelanggan.nama_lengkap || '';
        document.getElementById('pelanggan-telepon').value = pelanggan.no_telepon || '';
        document.getElementById('pelanggan-email').value = pelanggan.email || '';
        document.getElementById('pelanggan-gender').value = pelanggan.jenis_kelamin || 'L';
        document.getElementById('pelanggan-alamat').value = pelanggan.alamat || '';
        document.getElementById('pelanggan-catatan').value = pelanggan.catatan || '';
        
        if (groupPoin) {
            groupPoin.style.display = 'block';
            document.getElementById('pelanggan-poin').value = pelanggan.poin_loyalitas || 0;
        }
    } else {
        if (titleEl) titleEl.textContent = '➕ Tambah Pelanggan Baru';
        document.getElementById('pelanggan-id').value = '';
        if (groupPoin) groupPoin.style.display = 'none';
    }

    openModal('modal-pelanggan');
}

function editPelanggan(id) {
    const p = pelangganList.find(item => item.id_pelanggan == id);
    if (p) {
        openPelangganModal(p);
    }
}

async function savePelanggan() {
    const id = document.getElementById('pelanggan-id').value;
    const nama = document.getElementById('pelanggan-nama').value.trim();
    const telepon = document.getElementById('pelanggan-telepon').value.trim();
    const email = document.getElementById('pelanggan-email').value.trim();
    const gender = document.getElementById('pelanggan-gender').value;
    const alamat = document.getElementById('pelanggan-alamat').value.trim();
    const catatan = document.getElementById('pelanggan-catatan').value.trim();
    const poinInput = document.getElementById('pelanggan-poin');

    if (!nama) {
        showToast('Nama lengkap wajib diisi', 'warning');
        return;
    }

    const btnSubmit = document.getElementById('btn-simpan-pelanggan');
    if (btnSubmit) btnSubmit.disabled = true;

    try {
        const payload = {
            nama_lengkap: nama,
            no_telepon: telepon,
            email: email,
            jenis_kelamin: gender,
            alamat: alamat,
            catatan: catatan
        };

        if (id) {
            payload.id_pelanggan = parseInt(id, 10);
            if (poinInput) {
                payload.poin_loyalitas = parseInt(poinInput.value, 10) || 0;
            }
            const res = await api.put('pelanggan.php', payload);
            showToast(res.message || 'Data pelanggan berhasil diperbarui!', 'success');
        } else {
            const res = await api.post('pelanggan.php', payload);
            showToast(res.message || 'Pelanggan baru berhasil ditambahkan!', 'success');
        }

        closeModal('modal-pelanggan');
        const searchVal = document.getElementById('search-input')?.value.trim() || '';
        await loadPelanggan(searchVal);
    } catch (err) {
        showToast('Gagal menyimpan pelanggan: ' + err.message, 'error');
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

async function deletePelanggan(id, nama) {
    if (!confirm(`Apakah Anda yakin ingin menghapus pelanggan "${nama}"?\nJika pelanggan memiliki riwayat pesanan, penghapusan mungkin ditolak oleh sistem.`)) {
        return;
    }

    try {
        const res = await api.delete(`pelanggan.php?id=${id}`);
        showToast(res.message || 'Pelanggan berhasil dihapus', 'success');
        const searchVal = document.getElementById('search-input')?.value.trim() || '';
        await loadPelanggan(searchVal);
    } catch (err) {
        showToast('Gagal menghapus pelanggan: ' + err.message, 'error');
    }
}
