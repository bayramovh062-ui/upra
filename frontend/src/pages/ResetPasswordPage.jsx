import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDispatch } from 'react-redux';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createResetPasswordSchema } from '../validations/authSchema';
import { useResetPasswordMutation } from '../features/auth/authApi';
import { logout } from '../features/auth/authSlice';
import { useTranslation } from '../features/locale/useTranslation';
import { Button, Icon, PasswordInput } from '../components/ui';

const ResetPasswordPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const [resetPassword, { isLoading }] = useResetPasswordMutation();

    const schema = useMemo(() => createResetPasswordSchema(t), [t]);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(schema),
        defaultValues: { newPassword: '', confirmPassword: '' },
    });

    const onSubmit = async ({ newPassword }) => {
        try {
            await resetPassword({ token, newPassword }).unwrap();
            // Bu brauzerdə giriş edilmişdisə, köhnə sessiya artıq etibarsızdır
            dispatch(logout());
            toast.success(t('auth.reset.success'));
            navigate('/login', { replace: true });
        } catch (err) {
            toast.error(err?.data?.message || t('auth.reset.errorFallback'));
        }
    };

    if (!token) {
        return (
            <div className="mx-auto my-auto w-full max-w-md space-y-4 py-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-error">
                    <Icon name="link_off" className="text-[28px]" />
                </span>
                <h2 className="text-headline-lg text-on-surface">{t('auth.reset.invalidTitle')}</h2>
                <p className="text-body-md text-secondary">{t('auth.reset.invalidBody')}</p>
                <Link to="/forgot-password">
                    <Button size="lg">{t('auth.reset.requestNew')}</Button>
                </Link>
            </div>
        );
    }

    return (
        <>
            <div className="flex justify-end text-body-md text-secondary">
                <Link
                    to="/login"
                    className="inline-flex items-center gap-1 text-title-md text-primary-container transition-colors hover:text-primary"
                >
                    <Icon name="arrow_back" className="text-[16px]" />
                    {t('auth.reset.back')}
                </Link>
            </div>

            <div className="mx-auto my-auto w-full max-w-md py-8">
                <div className="mb-8 space-y-2">
                    <h2 className="text-headline-lg text-on-surface">{t('auth.reset.title')}</h2>
                    <p className="text-body-md text-secondary">{t('auth.reset.subtitle')}</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                    <PasswordInput
                        label={t('auth.reset.newPassword')}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        error={errors.newPassword?.message}
                        {...register('newPassword')}
                    />
                    <PasswordInput
                        label={t('auth.reset.confirmNewPassword')}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        error={errors.confirmPassword?.message}
                        {...register('confirmPassword')}
                    />

                    <Button type="submit" size="lg" loading={isLoading} className="mt-2 w-full">
                        {isLoading ? t('auth.reset.submitting') : t('auth.reset.submit')}
                    </Button>
                </form>

                <p className="mt-6 text-caption text-secondary">
                    {t('auth.reset.expired')}{' '}
                    <Link to="/forgot-password" className="font-semibold text-primary hover:text-surface-tint">
                        {t('auth.reset.requestNewInline')}
                    </Link>
                    .
                </p>
            </div>
        </>
    );
};

export default ResetPasswordPage;
