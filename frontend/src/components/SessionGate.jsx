import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useGetMeQuery } from '../features/auth/authApi';
import { updateUser } from '../features/auth/authSlice';
import Spinner from './ui/Spinner';

// Səhifə yenilənəndə tokenin hələ etibarlı olduğunu GET /auth/me ilə yoxlayır.
// Token etibarsızdırsa baseApi-dəki 401 idarəsi logout() çağırır, ProtectedRoute login-ə atır.
const SessionGate = ({ children }) => {
    const dispatch = useDispatch();
    const token = useSelector((state) => state.auth.token);

    // Yalnız ilk yüklənmədə bloklayırıq. Login zamanı (token sonradan gələndə) tətbiq bloklanmasın.
    const [hadTokenOnLoad] = useState(Boolean(token));

    const { data, isLoading } = useGetMeQuery(undefined, { skip: !token });

    useEffect(() => {
        if (data?.user) dispatch(updateUser(data.user));
    }, [data, dispatch]);

    if (hadTokenOnLoad && isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center text-brand-600">
                <Spinner size="lg" />
            </div>
        );
    }

    return children;
};

export default SessionGate;
