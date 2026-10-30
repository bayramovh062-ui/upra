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
        <header className="sticky top-0 z-50 bg-nav shadow-[0_1px_8px_rgba(0,0,0,0.12)]">
            <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-4 sm:px-8">
                <div className="flex items-center gap-8">
                    <Link to="/" className="text-headline-sm tracking-tight text-white">
                        Upra
                    </Link>
                    <nav className="hidden items-center gap-6 md:flex">
                        <a
                            href="/#workflow"
                            className="text-body-md font-medium text-secondary-fixed-dim transition-colors hover:text-white"
                        >
                            How it works
                        </a>
                        <a
                            href="/#features"
                            className="text-body-md font-medium text-secondary-fixed-dim transition-colors hover:text-white"
                        >
                            Features
                        </a>
                    </nav>
                </div>

                {isAuthenticated ? (
                    <div className="flex items-center gap-4">
                        <span className="hidden text-body-md text-secondary-fixed-dim sm:inline">
                            {user?.fullName}
                        </span>
                        <Link to={getDashboardPath(user?.role)}>
                            <Button size="sm">Dashboard</Button>
                        </Link>
                        <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={logout}>
                            Log out
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <Link
                            to="/login"
                            className="text-body-md font-medium text-secondary-fixed-dim transition-colors hover:text-white"
                        >
                            Sign in
                        </Link>
                        <Link to="/register">
                            <Button size="sm">Get started</Button>
                        </Link>
                    </div>
                )}
            </div>
        </header>
    );
};

export default Navbar;
