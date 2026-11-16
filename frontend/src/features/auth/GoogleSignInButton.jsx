import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useGoogleLoginMutation } from './authApi';
import { useTranslation } from '../locale/useTranslation';
import { Button } from '../../components/ui';
import { cn } from '../../lib/cn';

// Google ilə giriş (Google Identity Services). VITE_GOOGLE_CLIENT_ID təyin olunmayıbsa heç nə göstərilmir,
// ona görə lokal/CI mühitində (məs. E2E) Google skripti yüklənmir.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GSI_SRC = 'https://accounts.google.com/gsi/client';

let gsiPromise = null;
const loadGsi = () => {
    if (window.google?.accounts?.id) return Promise.resolve();
    if (!gsiPromise) {
        gsiPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = GSI_SRC;
            script.async = true;
            script.onload = resolve;
            script.onerror = () => {
                gsiPromise = null;
                reject(new Error('Google script failed to load'));
            };
            document.head.appendChild(script);
        });
    }
    return gsiPromise;
};

// `role` verilsə (qeydiyyat səhifəsi) yeni hesab dərhal həmin rolla yaradılır.
// Verilməsə (giriş səhifəsi) və hesab yoxdursa, istifadəçidən rol soruşulur.
const GoogleSignInButton = ({ role }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [googleLogin, { isLoading }] = useGoogleLoginMutation();
    const [pendingCredential, setPendingCredential] = useState(null);
    const [failed, setFailed] = useState(false);
    const buttonRef = useRef(null);
    const handlerRef = useRef(null);

    const submit = async (credential, chosenRole) => {
        try {
            const data = await googleLogin({ credential, ...(chosenRole ? { role: chosenRole } : {}) }).unwrap();
            if (data.needsRole) {
                setPendingCredential(credential);
                return;
            }
            setPendingCredential(null);
            toast.success(t('auth.login.success'));
            navigate('/dashboard', { replace: true });
        } catch (err) {
            setPendingCredential(null);
            toast.error(err?.data?.message || t('auth.google.errorFallback'));
        }
    };

    // Google callback-i bir dəfə qeydə alınır, ən son submit/role isə ref ilə oxunur
    useEffect(() => {
        handlerRef.current = (response) => submit(response.credential, role);
    });

    useEffect(() => {
        if (!CLIENT_ID) return undefined;
        let cancelled = false;
        loadGsi()
            .then(() => {
                if (cancelled || !buttonRef.current) return;
                window.google.accounts.id.initialize({
                    client_id: CLIENT_ID,
                    callback: (response) => handlerRef.current?.(response),
                });
                window.google.accounts.id.renderButton(buttonRef.current, {
                    theme: 'outline',
                    size: 'large',
                    text: 'continue_with',
                    width: Math.min(400, buttonRef.current.offsetWidth || 320),
                });
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (!CLIENT_ID || failed) return null;

    return (
        <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3 text-label-md text-secondary">
                <span className="h-px flex-1 bg-line" />
                {t('auth.google.or')}
                <span className="h-px flex-1 bg-line" />
            </div>

            {/* Düymə həmişə DOM-da qalır (Google onu bir dəfə çəkir), rol seçimi zamanı gizlədilir */}
            <div ref={buttonRef} className={cn('flex min-h-11 justify-center', pendingCredential && 'hidden')} />

            {pendingCredential && (
                <div className="space-y-3 rounded-xl border border-line bg-surface-container-lowest p-4">
                    <p className="text-body-md text-on-surface">{t('auth.google.chooseRole')}</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button variant="secondary" disabled={isLoading} onClick={() => submit(pendingCredential, 'CLIENT')}>
                            {t('auth.google.roleClient')}
                        </Button>
                        <Button
                            variant="secondary"
                            disabled={isLoading}
                            onClick={() => submit(pendingCredential, 'FREELANCER')}
                        >
                            {t('auth.google.roleFreelancer')}
                        </Button>
                    </div>
                    <Button variant="ghost" size="sm" disabled={isLoading} onClick={() => setPendingCredential(null)}>
                        {t('auth.google.cancel')}
                    </Button>
                </div>
            )}
        </div>
    );
};

export default GoogleSignInButton;
