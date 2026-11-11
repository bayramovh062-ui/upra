import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createForgotPasswordSchema } from '../validations/authSchema';
import { useForgotPasswordMutation } from '../features/auth/authApi';
import { useTranslation } from '../features/locale/useTranslation';
import { Button, Icon, Input } from '../components/ui';

const ForgotPasswordPage = () => {
    const { t } = useTranslation();
    const [forgotPassword, { isLoading }] = useForgotPasswordMutation();
    const [sentTo, setSentTo] = useState(null);

    const schema = useMemo(() => createForgotPasswordSchema(t), [t]);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(schema),
        defaultValues: { email: '' },
    });

    const onSubmit = async (formData) => {
        try {
            await forgotPassword(formData).unwrap();
            setSentTo(formData.email);
        } catch (err) {
            toast.error(err?.data?.message || t('auth.forgot.errorFallback'));
        }
    };

    return (
        <>
            <div className="flex justify-end text-body-md text-secondary">
                <Link
                    to="/login"
                    className="inline-flex items-center gap-1 text-title-md text-primary-container transition-colors hover:text-primary"
                >
                    <Icon name="arrow_back" className="text-[16px]" />
                    {t('auth.forgot.back')}
                </Link>
            </div>

            <div className="mx-auto my-auto w-full max-w-md py-8">
                {sentTo ? (
                    <div className="space-y-4">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-primary">
                            <Icon name="mark_email_read" className="text-[28px]" />
                        </span>
                        <h2 className="text-headline-lg text-on-surface">{t('auth.forgot.sentTitle')}</h2>
                        <p className="text-body-md text-secondary">
                            {t('auth.forgot.sentBody', { email: sentTo })}
                        </p>
                        <p className="text-caption text-secondary">
                            {t('auth.forgot.sentHint')}{' '}
                            <button
                                type="button"
                                onClick={() => setSentTo(null)}
                                className="font-semibold text-primary hover:text-surface-tint"
                            >
                                {t('auth.forgot.tryAgain')}
                            </button>
                            .
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="mb-8 space-y-2">
                            <h2 className="text-headline-lg text-on-surface">{t('auth.forgot.title')}</h2>
                            <p className="text-body-md text-secondary">{t('auth.forgot.subtitle')}</p>
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

                            <Button type="submit" size="lg" loading={isLoading} className="mt-2 w-full">
                                {isLoading ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
                                {!isLoading && <Icon name="send" className="text-[18px]" />}
                            </Button>
                        </form>
                    </>
                )}
            </div>
        </>
    );
};

export default ForgotPasswordPage;
