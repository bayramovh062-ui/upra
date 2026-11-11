// Sidebar menyusu rola görə. Yeni səhifə əlavə edəndə yalnız bura bir sətir yaz.
// labelKey i18n açarıdır; yazı `navItems` ilə aktiv dilə çevrilir.
import { translate } from '../i18n';

const NAV_ITEM_DEFS = {
    CLIENT: [
        { to: '/client/dashboard', labelKey: 'nav.items.dashboard', icon: 'dashboard' },
        { to: '/client/jobs', labelKey: 'nav.items.myJobs', icon: 'work' },
        { to: '/contracts', labelKey: 'nav.items.contracts', icon: 'verified_user' },
        { to: '/messages', labelKey: 'nav.items.messages', icon: 'chat' },
        { to: '/settings', labelKey: 'nav.items.settings', icon: 'settings' },
    ],
    FREELANCER: [
        { to: '/freelancer/dashboard', labelKey: 'nav.items.dashboard', icon: 'dashboard' },
        { to: '/jobs', labelKey: 'nav.items.findWork', icon: 'search' },
        { to: '/freelancer/proposals', labelKey: 'nav.items.myProposals', icon: 'description' },
        { to: '/contracts', labelKey: 'nav.items.contracts', icon: 'verified_user' },
        { to: '/messages', labelKey: 'nav.items.messages', icon: 'chat' },
        { to: '/settings', labelKey: 'nav.items.settings', icon: 'settings' },
    ],
    ADMIN: [
        { to: '/admin/disputes', labelKey: 'nav.items.disputes', icon: 'report_problem' },
        { to: '/admin/reports', labelKey: 'nav.items.reports', icon: 'flag' },
        { to: '/admin/users', labelKey: 'nav.items.users', icon: 'group' },
        { to: '/contracts', labelKey: 'nav.items.contracts', icon: 'verified_user' },
        { to: '/messages', labelKey: 'nav.items.messages', icon: 'chat' },
        { to: '/settings', labelKey: 'nav.items.settings', icon: 'settings' },
    ],
};

export const navItems = (role) =>
    (NAV_ITEM_DEFS[role] || []).map(({ labelKey, ...item }) => ({
        ...item,
        label: translate(labelKey),
    }));

// Rola görə əsas səhifə (login-dən sonra və /dashboard üçün)
export const getDashboardPath = (role) => {
    if (role === 'ADMIN') return '/admin/disputes';
    return role === 'FREELANCER' ? '/freelancer/dashboard' : '/client/dashboard';
};
