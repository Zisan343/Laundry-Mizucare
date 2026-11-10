// API base URL - adjust if your XAMPP folder name is different
const API_BASE = '/laundry/api';

async function apiFetch(endpoint, options = {}) {
    try {
        const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}/${endpoint}`;
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            credentials: 'include',
            ...options,
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            const error = new Error(data.message || `HTTP ${res.status}`);
            error.status = res.status;
            throw error;
        }
        return data;
    } catch (err) {
        if (err.status === 401 || (err.message && err.message.includes('401'))) {
            try { localStorage.removeItem('laundry_user'); } catch (e) {}
            if (!window.location.pathname.endsWith('index.html')) {
                window.location.href = '/laundry/index.html';
            }
        }
        throw err;
    }
}

const api = {
    get: (endpoint) => apiFetch(endpoint),
    post: (endpoint, body) => apiFetch(endpoint, { method: 'POST', body: JSON.stringify(body) }),
    put: (endpoint, body) => apiFetch(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (endpoint) => apiFetch(endpoint, { method: 'DELETE' }),
};

function formatRupiah(amount) {
    if (amount == null) return 'Rp 0';
    return 'Rp ' + Number(amount).toLocaleString('id-ID');
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function getBadgeClass(status) {
    const map = {
        menunggu: 'badge-menunggu', diproses: 'badge-diproses',
        selesai: 'badge-selesai', diambil: 'badge-diambil',
        dibatalkan: 'badge-dibatalkan', lunas: 'badge-lunas',
        belum_bayar: 'badge-belum_bayar', dp: 'badge-dp',
        admin: 'badge-admin', kasir: 'badge-kasir', operator: 'badge-operator',
        aktif: 'badge-aktif', nonaktif: 'badge-nonaktif',
    };
    return map[status] || 'badge-diambil';
}

function createBadge(status, label) {
    const cls = getBadgeClass(status);
    const labelMap = {
        menunggu: 'Menunggu', diproses: 'Diproses',
        selesai: 'Selesai', diambil: 'Diambil',
        dibatalkan: 'Dibatalkan', lunas: 'Lunas',
        belum_bayar: 'Belum Bayar', dp: 'DP',
        admin: 'Admin', kasir: 'Kasir', operator: 'Operator',
        aktif: 'Aktif', nonaktif: 'Nonaktif',
    };
    const displayLabel = label || labelMap[status] || status;
    return `<span class="badge ${cls}">${displayLabel}</span>`;
}
