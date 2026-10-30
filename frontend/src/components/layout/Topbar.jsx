import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useLogout } from '../../features/auth/useLogout';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';

const ROLE_LABEL = { CLIENT: 'Client', FREELANCER: 'Freelancer' };

const Topbar = ({ onMenuClick }) => {
    const user = useSelector((state) => state.auth.user);
    const logout = useLogout();
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <header className="flex h-16 items-center justify-between border-b border-line bg-white px-4 sm:px-6">
            <button
                type="button"
                onClick={onMenuClick}
                aria-label="Open menu"
                className="rounded-lg p-2 text-muted hover:bg-gray-100 lg:hidden"
            >
                <Icon name="menu" />
            </button>

            {/* Desktop-da sol tərəf boş qalır (sidebar loqonu daşıyır) */}
            <div className="hidden lg:block" />

            <div className="relative">
                <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-100"
                >
                    <Avatar name={user?.fullName} size="sm" />
                    <span className="hidden text-left sm:block">
                        <span className="block text-sm font-medium leading-tight text-ink">
                            {user?.fullName}
                        </span>
                        <span className="block text-xs leading-tight text-muted">
                            {ROLE_LABEL[user?.role]}
                        </span>
                    </span>
                </button>

                {menuOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-10"
                            onClick={() => setMenuOpen(false)}
                            aria-hidden="true"
                        />
                        <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-line bg-white py-1 shadow-lg">
                            <Link
                                to="/settings"
                                onClick={() => setMenuOpen(false)}
                                className="block px-4 py-2 text-sm text-ink hover:bg-gray-50"
                            >
                                Settings
                            </Link>
                            <button
                                type="button"
                                onClick={logout}
                                className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
                            >
                                Log out
                            </button>
                        </div>
                    </>
                )}
            </div>
        </header>
    );
};

export default Topbar;
