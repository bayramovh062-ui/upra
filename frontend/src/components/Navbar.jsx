import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useLogout } from '../features/auth/useLogout';
import { getDashboardPath } from '../lib/navigation';
import Button from './ui/Button';

// Yalnız qonaq (public) səhifələrdə görünür. Giriş etmiş istifadəçilər AppLayout-un sidebar-ını görür.
const Navbar = () => {
    const logout = useLogout();
    const isAuthenticated = useSelector((state) => !!state.auth?.token);
    const user = useSelector((state) => state.auth?.user);

    return (
        <nav className="flex h-16 items-center justify-between bg-nav px-4 text-white sm:px-6">
            <Link to="/" className="text-xl font-bold">
                Upra
            </Link>

            {isAuthenticated ? (
                <div className="flex items-center gap-4">
                    <span className="hidden text-sm text-gray-300 sm:inline">{user?.fullName}</span>
                    <Link
                        to={getDashboardPath(user?.role)}
                        className="text-sm font-medium hover:text-gray-300"
                    >
                        Dashboard
                    </Link>
                    <Button size="sm" variant="danger" onClick={logout}>
                        Log out
                    </Button>
                </div>
            ) : (
                <div className="flex items-center gap-3">
                    <Link to="/login" className="text-sm font-medium hover:text-gray-300">
                        Sign in
                    </Link>
                    <Link
                        to="/register"
                        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium hover:bg-brand-700"
                    >
                        Get started
                    </Link>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
