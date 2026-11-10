import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { forgotPasswordSchema } from '../validations/authSchema';
import { useForgotPasswordMutation } from '../features/auth/authApi';
import { Button, Icon, Input } from '../components/ui';

const ForgotPasswordPage = () => {
    const [forgotPassword, { isLoading }] = useForgotPasswordMutation();
    const [sentTo, setSentTo] = useState(null);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: { email: '' },
    });

    const onSubmit = async (formData) => {
        try {
            await forgotPassword(formData).unwrap();
            setSentTo(formData.email);
        } catch (err) {
            toast.error(err?.data?.message || 'Could not send the reset email. Please try again.');
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
                    Back to sign in
                </Link>
            </div>

            <div className="mx-auto my-auto w-full max-w-md py-8">
                {sentTo ? (
                    <div className="space-y-4">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-primary">
                            <Icon name="mark_email_read" className="text-[28px]" />
                        </span>
                        <h2 className="text-headline-lg text-on-surface">Check your inbox</h2>
                        <p className="text-body-md text-secondary">
                            If an account exists for <span className="font-semibold text-on-surface">{sentTo}</span>,
                            we sent a link to reset your password. The link is valid for 1 hour.
                        </p>
                        <p className="text-caption text-secondary">
                            Did not get it? Check your spam folder, or{' '}
                            <button
                                type="button"
                                onClick={() => setSentTo(null)}
                                className="font-semibold text-primary hover:text-surface-tint"
                            >
                                try again
                            </button>
                            .
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="mb-8 space-y-2">
                            <h2 className="text-headline-lg text-on-surface">Forgot your password?</h2>
                            <p className="text-body-md text-secondary">
                                Enter the email you registered with and we will send you a reset link.
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

                            <Button type="submit" size="lg" loading={isLoading} className="mt-2 w-full">
                                {isLoading ? 'Sending...' : 'Send reset link'}
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
