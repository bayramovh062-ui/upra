import { NavLink, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { cn } from '../../lib/cn';
import { NAV_ITEMS } from '../../lib/navigation';
import Icon from '../ui/Icon';

// Mobil: açılıb-bağlanan panel, desktop (lg+): həmişə görünür
const Sidebar = ({ open, onClose }) => {
    const role = useSelector((state) => state.auth.user?.role);
    const items = NAV_ITEMS[role] || [];

    return (
        <>
            {open && (
                <div
                    className="fixed inset-0 z-30 bg-gray-900/40 lg:hidden"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-nav text-gray-300 transition-transform',
                    'lg:static lg:translate-x-0',
                    open ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <Link to="/" className="flex h-16 items-center px-6 text-xl font-bold text-white">
                    Upra
                </Link>

                <nav className="flex-1 space-y-1 px-3 py-4">
                    {items.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={onClose}
                            className={({ isActive }) =>
                                cn(
                                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                                    isActive
                                        ? 'bg-brand-600 text-white'
                                        : 'hover:bg-white/10 hover:text-white'
                                )
                            }
                        >
                            <Icon name={item.icon} />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
            </aside>
        </>
    );
};

export default Sidebar;
