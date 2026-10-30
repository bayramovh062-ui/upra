import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { cn } from '../../lib/cn';
import { NAV_ITEMS } from '../../lib/navigation';
import Icon from '../ui/Icon';

// Üst panelin altında: ağ panel, w-64. Mobil: açılıb-bağlanan, desktop (lg+): həmişə görünür
const Sidebar = ({ open, onClose }) => {
    const role = useSelector((state) => state.auth.user?.role);
    const items = NAV_ITEMS[role] || [];

    return (
        <>
            {open && (
                <div
                    className="fixed inset-0 z-30 bg-inverse-surface/40 lg:hidden"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}
            <aside
                className={cn(
                    'fixed bottom-0 left-0 top-16 z-40 flex w-64 flex-col border-r border-line bg-surface-container-lowest px-4 py-6 transition-transform',
                    'lg:translate-x-0',
                    open ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <p className="mb-3 px-4 text-caption uppercase tracking-wider text-on-surface-variant">
                    Workspace
                </p>
                <nav className="flex flex-col gap-1.5">
                    {items.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={onClose}
                            className={({ isActive }) =>
                                cn(
                                    'flex items-center gap-4 rounded-xl px-4 py-2 text-body-md font-medium transition-all',
                                    isActive
                                        ? 'bg-primary-container text-on-primary shadow-sm'
                                        : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
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
