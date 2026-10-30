import { useEffect, useState } from 'react';

// Dəyər dəyişəndən sonra `delay` ms gözləyib yenisini qaytarır. Axtarışda hər düymə üçün sorğu getməsin deyə.
export const useDebounce = (value, delay = 400) => {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debounced;
};
