// Sidebar menyusu rola görə. Yeni səhifə əlavə edəndə yalnız bura bir sətir yaz.
// icon: Material Symbols adı (Icon.jsx köhnə adları da başa düşür)
export const NAV_ITEMS = {
    CLIENT: [
        { to: '/client/dashboard', label: 'Dashboard', icon: 'dashboard' },
        { to: '/client/jobs', label: 'My jobs', icon: 'work' },
        { to: '/contracts', label: 'Contracts', icon: 'verified_user' },
        { to: '/messages', label: 'Messages', icon: 'chat' },
        { to: '/settings', label: 'Settings', icon: 'settings' },
    ],
    FREELANCER: [
        { to: '/freelancer/dashboard', label: 'Dashboard', icon: 'dashboard' },
        { to: '/jobs', label: 'Find work', icon: 'search' },
        { to: '/freelancer/proposals', label: 'My proposals', icon: 'description' },
        { to: '/contracts', label: 'Contracts', icon: 'verified_user' },
        { to: '/messages', label: 'Messages', icon: 'chat' },
        { to: '/settings', label: 'Settings', icon: 'settings' },
    ],
    ADMIN: [
        { to: '/admin/disputes', label: 'Disputes', icon: 'gavel' },
        { to: '/admin/reports', label: 'Reports', icon: 'flag' },
        { to: '/admin/users', label: 'Users', icon: 'group' },
        { to: '/contracts', label: 'Contracts', icon: 'verified_user' },
        { to: '/messages', label: 'Messages', icon: 'chat' },
        { to: '/settings', label: 'Settings', icon: 'settings' },
    ],
};

// Rola görə əsas səhifə (login-dən sonra və /dashboard üçün)
export const getDashboardPath = (role) => {
    if (role === 'ADMIN') return '/admin/disputes';
    return role === 'FREELANCER' ? '/freelancer/dashboard' : '/client/dashboard';
};
