import { useSelector } from 'react-redux';
import { Navigate, Outlet } from 'react-router-dom';

// Giriş etmiş istifadəçi /login və /register səhifələrinə girməsin
const GuestRoute = () => {
    const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

    if (isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};

export default GuestRoute;
