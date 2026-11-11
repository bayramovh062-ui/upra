import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import { useVerifyEmailMutation } from '../features/auth/authApi';
import { getDashboardPath } from '../lib/navigation';
import { useTranslation } from '../features/locale/useTranslation';
import { Button, Icon, Spinner } from '../components/ui';

// E-poçtdakı link: /verify-email?token=...  Giriş etmiş və ya etməmiş istifadəçi aça bilər.
const VerifyEmailPage = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const { isAuthenticated, user } = useSelector((state) => state.auth);
    const [verifyEmail] = useVerifyEmailMutation();

    // missing: token yoxdur; loading/success/error: sorğunun vəziyyəti
    const [status, setStatus] = useState(token ? 'loading' : 'missing');
    const [message, setMessage] = useState('');
    // React StrictMode effekti iki dəfə işlədir; token bir sorğu ilə yoxlanmalıdır
    const requested = useRef(false);

    useEffect(() => {
        if (!token || requested.current) return;
        requested.current = true;

        verifyEmail({ token })
            .unwrap()
            .then((data) => {
                setMessage(data?.message || t('auth.verify.successMessage'));
                setStatus('success');
            })
            .catch((err) => {
                setMessage(err?.data?.message || t('auth.verify.errorFallback'));
                setStatus('error');
            });
    }, [token, verifyEmail, t]);

    const actionPath = isAuthenticated ? getDashboardPath(user?.role) : '/login';
    const actionLabel = isAuthenticated ? t('auth.verify.goToDashboard') : t('auth.verify.signIn');

    return (
        <div className="mx-auto my-auto w-full max-w-md space-y-4 py-8">
            {status === 'loading' && (
                <>
                    <Spinner size="lg" />
                    <h2 className="text-headline-lg text-on-surface">{t('auth.verify.verifying')}</h2>
                </>
            )}

            {status === 'success' && (
                <>
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-primary">
                        <Icon name="verified" filled className="text-[28px]" />
                    </span>
                    <h2 className="text-headline-lg text-on-surface">{t('auth.verify.successTitle')}</h2>
                    <p className="text-body-md text-secondary">{message}</p>
                    <Link to={actionPath}>
                        <Button size="lg">{actionLabel}</Button>
                    </Link>
                </>
            )}

            {(status === 'error' || status === 'missing') && (
                <>
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-error">
                        <Icon name="link_off" className="text-[28px]" />
                    </span>
                    <h2 className="text-headline-lg text-on-surface">{t('auth.verify.failedTitle')}</h2>
                    <p className="text-body-md text-secondary">
                        {status === 'missing' ? t('auth.verify.missing') : message}{' '}
                        {t('auth.verify.resendHint')}
                    </p>
                    <Link to={actionPath}>
                        <Button size="lg" variant="secondary">
                            {actionLabel}
                        </Button>
                    </Link>
                </>
            )}
        </div>
    );
};

export default VerifyEmailPage;
