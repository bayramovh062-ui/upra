import { useSelector } from 'react-redux';
import { Navigate, Outlet } from 'react-router-dom';
import { getDashboardPath } from '../lib/navigation';

const ProtectedRoute = ({ allowedRoles }) => {
    const { isAuthenticated, user } = useSelector((state) => state.auth);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Rolu uyğun gəlməyən istifadəçi öz dashboard-una qayıdır
    if (allowedRoles && !allowedRoles.includes(user?.role)) {
        return <Navigate to={getDashboardPath(user?.role)} replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
