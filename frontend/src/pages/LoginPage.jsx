import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { loginSchema } from '../validations/authSchema';
import { useLoginMutation } from '../features/auth/authApi';
import { Button, Icon, Input, PasswordInput } from '../components/ui';

const LoginPage = () => {
    const navigate = useNavigate();
    const [login, { isLoading }] = useLoginMutation();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    const onSubmit = async (formData) => {
        try {
            // Token və user Redux-a authApi-dəki onQueryStarted ilə yazılır
            await login(formData).unwrap();
            toast.success('Logged in successfully!');
            navigate('/dashboard', { replace: true });
        } catch (err) {
            toast.error(err?.data?.message || 'Invalid email or password');
        }
    };

    return (
        <>
            <div className="flex justify-end text-body-md text-secondary">
                Don&apos;t have an account?
                <Link
                    to="/register"
                    className="ml-1.5 inline-flex items-center gap-0.5 text-title-md text-primary-container transition-colors hover:text-primary"
                >
                    Sign up
                    <Icon name="arrow_forward" className="text-[16px]" />
                </Link>
            </div>

            <div className="mx-auto my-auto w-full max-w-md py-8">
                <div className="mb-8 space-y-2">
                    <h2 className="text-headline-lg text-on-surface">Sign in to Upra</h2>
                    <p className="text-body-md text-secondary">
                        Welcome back. Enter your credentials to access your jobs and contracts.
                    </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                    <Input
                        label="Email"
                        type="email"
                        icon="mail"
                        autoComplete="email"
                        placeholder="name@example.com"
                        error={errors.email?.message}
                        {...register('email')}
                    />

                    <PasswordInput
                        label="Password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        error={errors.password?.message}
                        {...register('password')}
                    />

                    <Button type="submit" size="lg" loading={isLoading} className="mt-2 w-full">
                        {isLoading ? 'Signing in...' : 'Sign in'}
                        {!isLoading && <Icon name="login" />}
                    </Button>
                </form>
            </div>
        </>
    );
};

export default LoginPage;
