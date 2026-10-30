import { useSelector } from 'react-redux';
import { Navigate, Outlet } from 'react-router-dom';
import { getDashboardPath } from '../lib/navigation';

// Giriş etmiş istifadəçi /login və /register səhifələrinə girməsin
const GuestRoute = () => {
    const { isAuthenticated, user } = useSelector((state) => state.auth);

    if (isAuthenticated) {
        return <Navigate to={getDashboardPath(user?.role)} replace />;
    }

    return <Outlet />;
};

export default GuestRoute;
