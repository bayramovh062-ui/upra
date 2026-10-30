// Sidebar menyusu rola görə. Yeni səhifə əlavə edəndə yalnız bura bir sətir yaz.
export const NAV_ITEMS = {
    CLIENT: [
        { to: '/client/dashboard', label: 'Dashboard', icon: 'home' },
        { to: '/client/jobs', label: 'My jobs', icon: 'briefcase' },
        { to: '/contracts', label: 'Contracts', icon: 'contract' },
        { to: '/settings', label: 'Settings', icon: 'settings' },
    ],
    FREELANCER: [
        { to: '/freelancer/dashboard', label: 'Dashboard', icon: 'home' },
        { to: '/jobs', label: 'Find work', icon: 'search' },
        { to: '/freelancer/proposals', label: 'My proposals', icon: 'document' },
        { to: '/contracts', label: 'Contracts', icon: 'contract' },
        { to: '/settings', label: 'Settings', icon: 'settings' },
    ],
};

// Rola görə əsas səhifə (login-dən sonra və /dashboard üçün)
export const getDashboardPath = (role) =>
    role === 'FREELANCER' ? '/freelancer/dashboard' : '/client/dashboard';
