import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from './authSlice';
import { baseApi } from '../../lib/baseApi';

// Çıxış: state + localStorage təmizlənir, RTK Query cache sıfırlanır, login-ə yönləndirilir
export const useLogout = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    return () => {
        dispatch(logout());
        // Cache təmizlənməsə, başqa istifadəçi girəndə əvvəlkinin datası görünə bilər
        dispatch(baseApi.util.resetApiState());
        navigate('/login', { replace: true });
    };
};
