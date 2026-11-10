// Karyawan module state
let karyawanList = [];
let searchDebounceTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;

    // Check admin permission
    const role = (user.role || '').toLowerCase();
    if (role !== 'admin') {
        showToast('Halaman ini khusus untuk administrator', 'error');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1200);
        return;
    }

    initModalHandlers();
    initEventListeners();
    await loadKaryawan();
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

    const filterRole = document.getElementById('filter-role');
    if (filterRole) {
        filterRole.addEventListener('change', applyFilterAndRender);
    }

    const filterStatus = document.getElementById('filter-status');
    if (filterStatus) {
        filterStatus.addEventListener('change', applyFilterAndRender);
    }

    const btnTambah = document.getElementById('btn-tambah-karyawan');
    if (btnTambah) {
        btnTambah.addEventListener('click', () => {
            openKaryawanModal(null);
        });
    }

    const form = document.getElementById('form-karyawan');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveKaryawan();
        });
    }
}

async function loadKaryawan() {
    const loadingEl = document.getElementById('table-loading');
    const tbody = document.getElementById('karyawan-tbody');
    if (loadingEl) loadingEl.style.display = 'flex';

    try {
        const res = await api.get('karyawan.php');
        karyawanList = res.data || [];
        applyFilterAndRender();
    } catch (err) {
        showToast('Gagal memuat data karyawan: ' + err.message, 'error');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--danger)">Gagal memuat data</td></tr>`;
        }
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

function applyFilterAndRender() {
    const searchVal = document.getElementById('search-input')?.value.toLowerCase().trim() || '';
    const roleVal = document.getElementById('filter-role')?.value || '';
    const statusVal = document.getElementById('filter-status')?.value || '';

    let filtered = karyawanList;

    if (roleVal) {
        filtered = filtered.filter(k => k.role === roleVal);
    }

    if (statusVal) {
        filtered = filtered.filter(k => k.status === statusVal);
    }

    if (searchVal) {
        filtered = filtered.filter(k => 
            (k.nama_lengkap && k.nama_lengkap.toLowerCase().includes(searchVal)) ||
            (k.username && k.username.toLowerCase().includes(searchVal)) ||
            (k.email && k.email.toLowerCase().includes(searchVal)) ||
            (k.no_telepon && k.no_telepon.toLowerCase().includes(searchVal))
        );
    }

    renderKaryawanTable(filtered);
}

function renderKaryawanTable(list) {
    const tbody = document.getElementById('karyawan-tbody');
    if (!tbody) return;

    if (!list || list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <div class="empty-state-icon">👷</div>
                        <div class="empty-state-text">Tidak ada karyawan ditemukan</div>
                        <div class="empty-state-sub">Ubah filter atau tambahkan staf baru.</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = list.map(k => {
        const initial = k.nama_lengkap ? k.nama_lengkap.charAt(0).toUpperCase() : 'U';
        const isSelf = currentUser && currentUser.id_karyawan == k.id_karyawan;

        // Dynamic avatar bg color based on role (calm beige-friendly green/blue tones)
        let avatarBg = 'var(--accent-gradient)';
        if (k.role === 'admin') avatarBg = 'linear-gradient(135deg, #367d6c 0%, #25584b 100%)';
        else if (k.role === 'kasir') avatarBg = 'linear-gradient(135deg, #369b6e 0%, #3e7f9e 100%)';
        else if (k.role === 'operator') avatarBg = 'linear-gradient(135deg, #3e7f9e 0%, #576059 100%)';

        return `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="width:36px; height:36px; border-radius:50%; background:${avatarBg}; display:flex; align-items:center; justify-content:center; font-weight:700; color:white; font-size:15px; flex-shrink:0;">
                            ${initial}
                        </div>
                        <div>
                            <div style="font-weight:600; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
                                ${k.nama_lengkap}
                                ${isSelf ? '<span style="font-size:11px; color:var(--accent-light); font-weight:normal;">(Anda)</span>' : ''}
                            </div>
                            <div style="font-size:12px; color:var(--text-muted);">${k.alamat || '-'}</div>
                        </div>
                    </div>
                </td>
                <td><strong style="font-family:monospace; color:var(--accent-light);">@${k.username}</strong></td>
                <td>
                    <div style="font-size:13px; color:var(--text-primary);">${k.no_telepon || '-'}</div>
                    <div style="font-size:12px; color:var(--text-muted);">${k.email || '-'}</div>
                </td>
                <td>${createBadge(k.role, k.role.toUpperCase())}</td>
                <td>${formatDate(k.tanggal_masuk)}</td>
                <td>
                    <button class="btn btn-sm" onclick="toggleStatus(${k.id_karyawan}, '${k.status}')" title="Klik untuk mengubah status" style="background:transparent; border:none; padding:0; cursor:pointer;" ${isSelf ? 'disabled' : ''}>
                        ${createBadge(k.status, k.status === 'aktif' ? 'Aktif' : 'Nonaktif')}
                    </button>
                </td>
                <td style="text-align: right;">
                    <div class="actions" style="justify-content: flex-end;">
                        <button class="btn btn-secondary btn-sm" onclick="editKaryawan(${k.id_karyawan})" title="Edit Staf">✏️ Edit</button>
                        ${!isSelf ? `<button class="btn btn-danger btn-sm" onclick="deleteKaryawan(${k.id_karyawan}, '${k.nama_lengkap}')" title="Hapus Staf">🗑️</button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openKaryawanModal(karyawan = null) {
    const titleEl = document.getElementById('modal-karyawan-title');
    const form = document.getElementById('form-karyawan');
    const pwdInput = document.getElementById('karyawan-password');
    const pwdIndicator = document.getElementById('pwd-required-indicator');
    const pwdHint = document.getElementById('pwd-hint');
    const groupStatus = document.getElementById('group-status');

    if (form) form.reset();

    if (karyawan) {
        if (titleEl) titleEl.textContent = '✏️ Edit Data Karyawan';
        document.getElementById('karyawan-id').value = karyawan.id_karyawan;
        document.getElementById('karyawan-nama').value = karyawan.nama_lengkap || '';
        document.getElementById('karyawan-username').value = karyawan.username || '';
        document.getElementById('karyawan-role').value = karyawan.role || 'kasir';
        document.getElementById('karyawan-email').value = karyawan.email || '';
        document.getElementById('karyawan-telepon').value = karyawan.no_telepon || '';
        document.getElementById('karyawan-tgl-masuk').value = karyawan.tanggal_masuk ? karyawan.tanggal_masuk.split(' ')[0] : '';
        document.getElementById('karyawan-alamat').value = karyawan.alamat || '';

        if (pwdInput) pwdInput.removeAttribute('required');
        if (pwdIndicator) pwdIndicator.style.display = 'none';
        if (pwdHint) pwdHint.style.display = 'block';

        if (groupStatus) {
            groupStatus.style.display = 'block';
            document.getElementById('karyawan-status').value = karyawan.status || 'aktif';
        }
    } else {
        if (titleEl) titleEl.textContent = '➕ Tambah Karyawan Baru';
        document.getElementById('karyawan-id').value = '';
        document.getElementById('karyawan-tgl-masuk').value = new Date().toISOString().split('T')[0];

        if (pwdInput) pwdInput.setAttribute('required', 'required');
        if (pwdIndicator) pwdIndicator.style.display = 'inline';
        if (pwdHint) pwdHint.style.display = 'none';

        if (groupStatus) groupStatus.style.display = 'none';
    }

    openModal('modal-karyawan');
}

function editKaryawan(id) {
    const k = karyawanList.find(item => item.id_karyawan == id);
    if (k) {
        openKaryawanModal(k);
    }
}

async function saveKaryawan() {
    const id = document.getElementById('karyawan-id').value;
    const nama = document.getElementById('karyawan-nama').value.trim();
    const username = document.getElementById('karyawan-username').value.trim();
    const role = document.getElementById('karyawan-role').value;
    const password = document.getElementById('karyawan-password').value;
    const email = document.getElementById('karyawan-email').value.trim();
    const telepon = document.getElementById('karyawan-telepon').value.trim();
    const tglMasuk = document.getElementById('karyawan-tgl-masuk').value;
    const alamat = document.getElementById('karyawan-alamat').value.trim();
    const statusSelect = document.getElementById('karyawan-status');

    if (!nama || !username || !role) {
        showToast('Nama, username, dan peran wajib diisi', 'warning');
        return;
    }

    if (!id && !password) {
        showToast('Password wajib diisi untuk karyawan baru', 'warning');
        return;
    }

    if (password && password.length < 6) {
        showToast('Password minimal 6 karakter', 'warning');
        return;
    }

    const btnSubmit = document.getElementById('btn-simpan-karyawan');
    if (btnSubmit) btnSubmit.disabled = true;

    try {
        const payload = {
            nama_lengkap: nama,
            username: username,
            role: role,
            email: email,
            no_telepon: telepon,
            tanggal_masuk: tglMasuk || null,
            alamat: alamat
        };

        if (password) {
            payload.password = password;
        }

        if (id) {
            payload.id_karyawan = parseInt(id, 10);
            if (statusSelect) payload.status = statusSelect.value;
            const res = await api.put('karyawan.php', payload);
            showToast(res.message || 'Data karyawan berhasil diperbarui!', 'success');
        } else {
            const res = await api.post('karyawan.php', payload);
            showToast(res.message || 'Karyawan baru berhasil ditambahkan!', 'success');
        }

        closeModal('modal-karyawan');
        await loadKaryawan();
    } catch (err) {
        showToast('Gagal menyimpan karyawan: ' + err.message, 'error');
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

async function toggleStatus(id, currentStatus) {
    if (currentUser && currentUser.id_karyawan == id) {
        showToast('Anda tidak dapat menonaktifkan akun sendiri', 'warning');
        return;
    }

    const newStatus = currentStatus === 'aktif' ? 'nonaktif' : 'aktif';
    try {
        const res = await api.put('karyawan.php', {
            id_karyawan: id,
            status: newStatus
        });
        showToast(res.message || `Status karyawan diubah menjadi ${newStatus}!`, 'success');
        await loadKaryawan();
    } catch (err) {
        showToast('Gagal mengubah status: ' + err.message, 'error');
    }
}

async function deleteKaryawan(id, nama) {
    if (currentUser && currentUser.id_karyawan == id) {
        showToast('Anda tidak dapat menghapus akun sendiri', 'warning');
        return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus staf "${nama}"?\nTindakan ini tidak dapat dibatalkan.`)) {
        return;
    }

    try {
        const res = await api.delete(`karyawan.php?id=${id}`);
        showToast(res.message || 'Karyawan berhasil dihapus', 'success');
        await loadKaryawan();
    } catch (err) {
        showToast('Gagal menghapus karyawan: ' + err.message, 'error');
    }
}
