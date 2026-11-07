import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { baseApi } from '../../lib/baseApi';
import { appendMessageToCache } from '../chat/chatApi';
import { patchNotificationCaches } from './notificationsApi';

// API ünvanı http://host:5000/api -> socket serveri http://host:5000
const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

// Giriş etmiş istifadəçi üçün şəxsi soket (otaq: user:<id>, backend token-dən qurur).
// Yeni bildiriş gələndə: siyahıya əlavə olunur, toast çıxır, bildirişin təsir etdiyi məlumatlar yenilənir.
const useNotificationSocket = () => {
    const dispatch = useDispatch();
    const token = useSelector((state) => state.auth.token);

    useEffect(() => {
        const authToken = token || localStorage.getItem('token');
        if (!authToken) return undefined;

        const socket = io(SOCKET_URL, { auth: { token: authToken } });
        let firstConnect = true;

        // Yenidən qoşulmada qaçırılmış bildirişlər və mesajlar üçün siyahılar təzələnir
        socket.on('connect', () => {
            if (!firstConnect) dispatch(baseApi.util.invalidateTags(['Notification', 'Conversation', 'Message']));
            firstConnect = false;
        });

        socket.on('notification:new', (notification) => {
            patchNotificationCaches(dispatch, (draft) => {
                if (draft.notifications.some((n) => n.id === notification.id)) return;
                draft.notifications.unshift(notification);
                draft.unreadCount += 1;
            });

            // Hadisə müqavilə, mərhələ, pul və ya təkliflərə toxunub: həmin siyahılar köhnəlməsin
            dispatch(baseApi.util.invalidateTags(['Contract', 'Wallet', 'Proposal', 'Issue']));

            toast(notification.title, { icon: '🔔' });
        });

        // Chat: gelen mesaj hem achilmish suhbetin cache-ine, hem de siyahiya yazilir.
        // Ozu gonderdiyi mesaj da bu hadise ile gelir; appendMessageToCache id ile tekrari saxlayir.
        socket.on('message:new', ({ conversationId, message } = {}) => {
            if (!conversationId || !message) return;
            appendMessageToCache(dispatch, conversationId, message);
            dispatch(baseApi.util.invalidateTags(['Conversation']));
        });

        return () => {
            socket.disconnect();
        };
    }, [token, dispatch]);
};

export default useNotificationSocket;
