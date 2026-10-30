import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { getDashboardPath } from '../lib/navigation';

// /dashboard → rola uyğun dashboard-a yönləndirir
const DashboardRedirect = () => {
    const role = useSelector((state) => state.auth.user?.role);
    return <Navigate to={getDashboardPath(role)} replace />;
};

export default DashboardRedirect;
