import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createRegisterSchema } from '../validations/authSchema';
import { useRegisterMutation } from '../features/auth/authApi';
import { useTranslation } from '../features/locale/useTranslation';
import { Button, Icon, Input, PasswordInput } from '../components/ui';
import { FieldError } from '../components/ui/Input';
import { demoNotice } from '../lib/demo';

const ROLES = [
    { value: 'CLIENT', icon: 'corporate_fare' },
    { value: 'FREELANCER', icon: 'terminal' },
];

const RegisterPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [registerUser, { isLoading }] = useRegisterMutation();

    const schema = useMemo(() => createRegisterSchema(t), [t]);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            fullName: '',
            email: '',
            password: '',
            confirmPassword: '',
            role: 'CLIENT', // Default olaraq 'CLIENT' seçilir
        },
    });

    const onSubmit = async (formData) => {
        try {
            // Backend-ə göndərilmədən öncə confirmPassword sahəsini ayırırıq
            // eslint-disable-next-line no-unused-vars
            const { confirmPassword, ...registerData } = formData;
            // Token və user Redux-a authApi-dəki onQueryStarted ilə yazılır
            await registerUser(registerData).unwrap();
            toast.success(t('auth.register.success'));
            navigate('/dashboard', { replace: true });
        } catch (err) {
            toast.error(err?.data?.message || t('auth.register.errorFallback'));
        }
    };

    return (
        <>
            <div className="mb-6 flex justify-end text-body-md text-secondary">
                {t('auth.register.haveAccount')}
                <Link
                    to="/login"
                    className="ml-1.5 font-semibold text-primary transition-colors hover:text-surface-tint"
                >
                    {t('auth.register.signIn')}
                </Link>
            </div>

            <div className="mx-auto my-auto w-full max-w-xl">
                <div className="mb-8">
                    <h2 className="mb-2 text-headline-lg text-on-surface">{t('auth.register.title')}</h2>
                    <p className="text-body-md text-secondary">{t('auth.register.subtitle')}</p>
                    <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-label-md text-warning-ink">
                        <Icon name="science" className="mt-0.5 shrink-0 text-[18px]" />
                        {demoNotice()}
                    </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
                    <fieldset>
                        <legend className="mb-2 text-label-sm font-semibold uppercase tracking-wider text-on-surface">
                            {t('auth.register.accountType')}
                        </legend>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {ROLES.map((role) => (
                                <label
                                    key={role.value}
                                    className="relative flex cursor-pointer flex-col rounded-xl border border-line bg-surface-container-lowest p-4 shadow-sm transition hover:bg-surface-container-low has-[:checked]:border-primary-container has-[:checked]:bg-surface-container-low has-[:checked]:ring-1 has-[:checked]:ring-primary-container"
                                >
                                    <input
                                        type="radio"
                                        value={role.value}
                                        className="peer sr-only"
                                        {...register('role')}
                                    />
                                    <div className="mb-2 flex items-center justify-between">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container text-primary">
                                            <Icon name={role.icon} />
                                        </span>
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-container-highest text-transparent peer-checked:bg-primary-container peer-checked:text-white">
                                            <Icon name="check" className="text-[14px]" />
                                        </span>
                                    </div>
                                    <span className="mb-0.5 text-title-md text-on-surface">
                                        {t(`auth.register.role${role.value === 'CLIENT' ? 'Client' : 'Freelancer'}Title`)}
                                    </span>
                                    <span className="text-caption text-secondary">
                                        {t(`auth.register.role${role.value === 'CLIENT' ? 'Client' : 'Freelancer'}Description`)}
                                    </span>
                                </label>
                            ))}
                        </div>
                        <FieldError>{errors.role?.message}</FieldError>
                    </fieldset>

                    <Input
                        label={t('auth.register.fullName')}
                        icon="person"
                        autoComplete="name"
                        placeholder={t('auth.register.fullNamePlaceholder')}
                        error={errors.fullName?.message}
                        {...register('fullName')}
                    />

                    <Input
                        label={t('auth.email')}
                        type="email"
                        icon="mail"
                        autoComplete="email"
                        placeholder={t('auth.emailPlaceholder')}
                        error={errors.email?.message}
                        {...register('email')}
                    />

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <PasswordInput
                            label={t('auth.password')}
                            autoComplete="new-password"
                            placeholder="••••••••"
                            error={errors.password?.message}
                            {...register('password')}
                        />
                        <PasswordInput
                            label={t('auth.register.confirmPassword')}
                            autoComplete="new-password"
                            placeholder="••••••••"
                            error={errors.confirmPassword?.message}
                            {...register('confirmPassword')}
                        />
                    </div>

                    <Button type="submit" size="lg" loading={isLoading} className="w-full">
                        {isLoading ? t('auth.register.submitting') : t('auth.register.submit')}
                        {!isLoading && <Icon name="arrow_forward" className="text-[18px]" />}
                    </Button>
                </form>
            </div>
        </>
    );
};

export default RegisterPage;
