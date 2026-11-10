let currentUser = null;

/**
 * Terapkan informasi user ke sidebar secara instan
 */
function applyUserInfo(user) {
    if (!user) return;
    currentUser = user;

    // Simpan ke localStorage agar tidak ada flicker atau loading saat reload
    try {
        localStorage.setItem('laundry_user', JSON.stringify(user));
    } catch (e) {}

    const nameEl   = document.getElementById('sidebar-user-name');
    const roleEl   = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-user-avatar');

    const nama = user.nama_lengkap || user.username || 'Pengguna';
    const role = (user.role || '').toLowerCase();

    if (nameEl)   nameEl.textContent   = nama;
    if (roleEl)   roleEl.textContent   = role ? (role.charAt(0).toUpperCase() + role.slice(1)) : '-';
    if (avatarEl) avatarEl.textContent = nama.charAt(0).toUpperCase();

    // Atur visibilitas menu admin
    const adminElements = document.querySelectorAll('.admin-only');
    if (role === 'admin') {
        adminElements.forEach(el => {
            el.style.removeProperty('display');
            if (el.style.display === 'none') {
                el.style.display = '';
            }
        });
    } else {
        adminElements.forEach(el => {
            el.style.display = 'none';
        });
    }
}

// Baca localStorage seawal mungkin untuk render instan tanpa jeda "Loading..."
(function initUserFromCache() {
    try {
        const cached = localStorage.getItem('laundry_user');
        if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed) {
                currentUser = parsed;
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', () => applyUserInfo(parsed));
                } else {
                    applyUserInfo(parsed);
                }
            }
        }
    } catch (e) {}
})();

/**
 * Verifikasi sesi ke backend PHP
 */
async function checkAuth() {
    try {
        const res = await api.get('auth.php?action=check');
        const user = (res.data && res.data.user) ? res.data.user : res.data;

        if (!user || (!user.id_karyawan && !user.username)) {
            throw new Error('Sesi tidak valid');
        }

        applyUserInfo(user);
        return currentUser;
    } catch (err) {
        console.warn('Sesi tidak aktif atau gagal diperiksa:', err);
        try { localStorage.removeItem('laundry_user'); } catch (e) {}
        window.location.href = '/laundry/index.html';
        return null;
    }
}

/**
 * Logout
 */
async function logout() {
    try {
        await api.get('auth.php?action=logout');
    } catch (e) {
        console.error('Logout error:', e);
    }
    try { localStorage.removeItem('laundry_user'); } catch (e) {}
    window.location.href = '/laundry/index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    // Pastikan user info dari cache atau session ter-apply saat DOM siap
    if (currentUser) {
        applyUserInfo(currentUser);
    }

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Mobile sidebar toggle
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const sidebar   = document.getElementById('sidebar');
    const overlay   = document.getElementById('mobile-overlay');
    if (mobileBtn && sidebar) {
        mobileBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            if (overlay) overlay.classList.toggle('active');
        });
    }
    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
        });
    }
});
