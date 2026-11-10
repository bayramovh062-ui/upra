import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import { useVerifyEmailMutation } from '../features/auth/authApi';
import { getDashboardPath } from '../lib/navigation';
import { Button, Icon, Spinner } from '../components/ui';

// E-poçtdakı link: /verify-email?token=...  Giriş etmiş və ya etməmiş istifadəçi aça bilər.
const VerifyEmailPage = () => {
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
                setMessage(data?.message || 'Your email has been verified.');
                setStatus('success');
            })
            .catch((err) => {
                setMessage(err?.data?.message || 'This verification link is invalid or has expired.');
                setStatus('error');
            });
    }, [token, verifyEmail]);

    return (
        <div className="mx-auto my-auto w-full max-w-md space-y-4 py-8">
            {status === 'loading' && (
                <>
                    <Spinner size="lg" />
                    <h2 className="text-headline-lg text-on-surface">Verifying your email...</h2>
                </>
            )}

            {status === 'success' && (
                <>
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-primary">
                        <Icon name="verified" filled className="text-[28px]" />
                    </span>
                    <h2 className="text-headline-lg text-on-surface">Email verified</h2>
                    <p className="text-body-md text-secondary">{message}</p>
                    <Link to={isAuthenticated ? getDashboardPath(user?.role) : '/login'}>
                        <Button size="lg">{isAuthenticated ? 'Go to dashboard' : 'Sign in'}</Button>
                    </Link>
                </>
            )}

            {(status === 'error' || status === 'missing') && (
                <>
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-error">
                        <Icon name="link_off" className="text-[28px]" />
                    </span>
                    <h2 className="text-headline-lg text-on-surface">Verification failed</h2>
                    <p className="text-body-md text-secondary">
                        {status === 'missing' ? 'This link is incomplete.' : message} Sign in and use the
                        &quot;Resend email&quot; button in the banner to get a new link.
                    </p>
                    <Link to={isAuthenticated ? getDashboardPath(user?.role) : '/login'}>
                        <Button size="lg" variant="secondary">
                            {isAuthenticated ? 'Go to dashboard' : 'Sign in'}
                        </Button>
                    </Link>
                </>
            )}
        </div>
    );
};

export default VerifyEmailPage;
