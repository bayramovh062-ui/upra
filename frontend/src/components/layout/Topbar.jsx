import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useLogout } from '../../features/auth/useLogout';
import Avatar from '../ui/Avatar';
import Icon from '../ui/Icon';

const ROLE_LABEL = { CLIENT: 'Client', FREELANCER: 'Freelancer' };

// Sabit tünd üst panel (dizayn: bg-inverse-surface/#1F2937, h-16)
const Topbar = ({ onMenuClick }) => {
    const user = useSelector((state) => state.auth.user);
    const logout = useLogout();
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <header className="fixed inset-x-0 top-0 z-50 h-16 bg-nav shadow-[0_1px_8px_rgba(0,0,0,0.06)]">
            <div className="flex h-full items-center justify-between px-4 sm:px-8">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onMenuClick}
                        aria-label="Open menu"
                        className="rounded-lg p-2 text-secondary-fixed-dim hover:bg-white/10 hover:text-white lg:hidden"
                    >
                        <Icon name="menu" />
                    </button>
                    <Link to="/" className="flex items-center gap-2">
                        <span className="text-headline-md font-bold tracking-tight text-white">Upra</span>
                        <span className="rounded bg-tertiary px-1.5 py-0.5 text-caption uppercase text-inverse-on-surface">
                            {ROLE_LABEL[user?.role]}
                        </span>
                    </Link>
                </div>

                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setMenuOpen((v) => !v)}
                        className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/10"
                    >
                        <Avatar name={user?.fullName} size="sm" className="bg-primary-container text-white" />
                        <span className="hidden text-left sm:block">
                            <span className="block text-body-md font-medium leading-tight text-white">
                                {user?.fullName}
                            </span>
                            <span className="block text-label-sm leading-tight text-secondary-fixed-dim">
                                {user?.email}
                            </span>
                        </span>
                        <Icon name="expand_more" className="text-[18px] text-secondary-fixed-dim" />
                    </button>

                    {menuOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setMenuOpen(false)}
                                aria-hidden="true"
                            />
                            <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-line bg-white py-1 shadow-lg">
                                <Link
                                    to="/settings"
                                    onClick={() => setMenuOpen(false)}
                                    className="flex items-center gap-2 px-4 py-2 text-body-md text-on-surface hover:bg-surface-container-low"
                                >
                                    <Icon name="settings" className="text-[18px] text-secondary" />
                                    Settings
                                </Link>
                                <button
                                    type="button"
                                    onClick={logout}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-body-md text-error hover:bg-surface-container-low"
                                >
                                    <Icon name="logout" className="text-[18px]" />
                                    Log out
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Topbar;
