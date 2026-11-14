import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarkNotificationReadMutation } from './notificationsApi';

// Bildirişə klik: oxunmamışdırsa oxundu işarələnir (optimistik, cache dərhal yenilənir), sonra linkə keçilir.
// Zəng paneli və "hamısı" səhifəsi eyni davranışı işlədir. onDone: panelin bağlanması üçün.
const useOpenNotification = (onDone) => {
    const navigate = useNavigate();
    const [markRead] = useMarkNotificationReadMutation();

    return useCallback(
        (notification) => {
            if (!notification.readAt) markRead(notification.id);
            onDone?.();
            // Yalnız tətbiqdaxili yollar: link backend-dən gəlir, kənar ünvana yönləndirməyə icazə vermirik
            if (typeof notification.link === 'string' && notification.link.startsWith('/')) {
                navigate(notification.link);
            }
        },
        [markRead, navigate, onDone],
    );
};

export default useOpenNotification;
