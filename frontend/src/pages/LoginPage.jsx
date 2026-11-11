import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createLoginSchema } from '../validations/authSchema';
import { useLoginMutation } from '../features/auth/authApi';
import { useTranslation } from '../features/locale/useTranslation';
import { Button, Icon, Input, PasswordInput } from '../components/ui';

const LoginPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [login, { isLoading }] = useLoginMutation();

    const schema = useMemo(() => createLoginSchema(t), [t]);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    const onSubmit = async (formData) => {
        try {
            // Token və user Redux-a authApi-dəki onQueryStarted ilə yazılır
            await login(formData).unwrap();
            toast.success(t('auth.login.success'));
            navigate('/dashboard', { replace: true });
        } catch (err) {
            toast.error(err?.data?.message || t('auth.login.errorFallback'));
        }
    };

    return (
        <>
            <div className="flex justify-end text-body-md text-secondary">
                {t('auth.login.noAccount')}
                <Link
                    to="/register"
                    className="ml-1.5 inline-flex items-center gap-0.5 text-title-md text-primary-container transition-colors hover:text-primary"
                >
                    {t('auth.login.signUp')}
                    <Icon name="arrow_forward" className="text-[16px]" />
                </Link>
            </div>

            <div className="mx-auto my-auto w-full max-w-md py-8">
                <div className="mb-8 space-y-2">
                    <h2 className="text-headline-lg text-on-surface">{t('auth.login.title')}</h2>
                    <p className="text-body-md text-secondary">{t('auth.login.subtitle')}</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                    <Input
                        label={t('auth.email')}
                        type="email"
                        icon="mail"
                        autoComplete="email"
                        placeholder={t('auth.emailPlaceholder')}
                        error={errors.email?.message}
                        {...register('email')}
                    />

                    <PasswordInput
                        label={t('auth.password')}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        error={errors.password?.message}
                        {...register('password')}
                    />

                    <div className="flex justify-end">
                        <Link
                            to="/forgot-password"
                            className="text-label-md font-semibold text-primary transition-colors hover:text-surface-tint"
                        >
                            {t('auth.login.forgot')}
                        </Link>
                    </div>

                    <Button type="submit" size="lg" loading={isLoading} className="mt-2 w-full">
                        {isLoading ? t('auth.login.submitting') : t('auth.login.submit')}
                        {!isLoading && <Icon name="login" />}
                    </Button>
                </form>
            </div>
        </>
    );
};

export default LoginPage;
