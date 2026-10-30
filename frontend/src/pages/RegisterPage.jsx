import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { registerSchema } from '../validations/authSchema';
import { useRegisterMutation } from '../features/auth/authApi';
import { Button, Icon, Input, PasswordInput } from '../components/ui';
import { FieldError } from '../components/ui/Input';

const ROLES = [
    {
        value: 'CLIENT',
        icon: 'corporate_fare',
        title: 'Client — I want to hire',
        description: 'Post jobs, review proposals and manage the project board.',
    },
    {
        value: 'FREELANCER',
        icon: 'terminal',
        title: 'Freelancer — I want to work',
        description: 'Find jobs, send proposals and deliver work on a Kanban board.',
    },
];

const RegisterPage = () => {
    const navigate = useNavigate();
    const [registerUser, { isLoading }] = useRegisterMutation();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(registerSchema),
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
            toast.success('Account created successfully!');
            navigate('/dashboard', { replace: true });
        } catch (err) {
            toast.error(err?.data?.message || 'Registration failed');
        }
    };

    return (
        <>
            <div className="mb-6 flex justify-end text-body-md text-secondary">
                Already have an account?
                <Link
                    to="/login"
                    className="ml-1.5 font-semibold text-primary transition-colors hover:text-surface-tint"
                >
                    Sign in
                </Link>
            </div>

            <div className="mx-auto my-auto w-full max-w-xl">
                <div className="mb-8">
                    <h2 className="mb-2 text-headline-lg text-on-surface">Create your Upra account</h2>
                    <p className="text-body-md text-secondary">
                        Start hiring talent or finding projects. You can pick one role per account.
                    </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
                    <fieldset>
                        <legend className="mb-2 text-label-sm font-semibold uppercase tracking-wider text-on-surface">
                            Account type
                        </legend>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {ROLES.map((role) => (
                                <label
                                    key={role.value}
                                    className="relative flex cursor-pointer flex-col rounded-xl border border-line bg-white p-4 shadow-sm transition hover:bg-surface-container-low has-[:checked]:border-primary-container has-[:checked]:bg-surface-container-low has-[:checked]:ring-1 has-[:checked]:ring-primary-container"
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
                                    <span className="mb-0.5 text-title-md text-on-surface">{role.title}</span>
                                    <span className="text-caption text-secondary">{role.description}</span>
                                </label>
                            ))}
                        </div>
                        <FieldError>{errors.role?.message}</FieldError>
                    </fieldset>

                    <Input
                        label="Full name"
                        icon="person"
                        autoComplete="name"
                        placeholder="Elena Rostova"
                        error={errors.fullName?.message}
                        {...register('fullName')}
                    />

                    <Input
                        label="Email"
                        type="email"
                        icon="mail"
                        autoComplete="email"
                        placeholder="name@example.com"
                        error={errors.email?.message}
                        {...register('email')}
                    />

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <PasswordInput
                            label="Password"
                            autoComplete="new-password"
                            placeholder="••••••••"
                            error={errors.password?.message}
                            {...register('password')}
                        />
                        <PasswordInput
                            label="Confirm password"
                            autoComplete="new-password"
                            placeholder="••••••••"
                            error={errors.confirmPassword?.message}
                            {...register('confirmPassword')}
                        />
                    </div>

                    <Button type="submit" size="lg" loading={isLoading} className="w-full">
                        {isLoading ? 'Creating account...' : 'Create account'}
                        {!isLoading && <Icon name="arrow_forward" className="text-[18px]" />}
                    </Button>
                </form>
            </div>
        </>
    );
};

export default RegisterPage;
