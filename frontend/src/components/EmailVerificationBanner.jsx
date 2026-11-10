import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { useResendVerificationMutation } from '../features/auth/authApi';
import { Button, Icon } from './ui';

const COOLDOWN_SECONDS = 60;

// Təsdiqlənməmiş hesab üçün üst xəbərdarlıq. `emailVerified === false` yoxlanılır:
// sahəsi olmayan köhnə saxlanmış user obyektində (undefined) banner görünmür.
const EmailVerificationBanner = () => {
    const user = useSelector((state) => state.auth.user);
    const [resend, { isLoading }] = useResendVerificationMutation();
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown <= 0) return undefined;
        const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    if (!user || user.emailVerified !== false) return null;

    const handleResend = async () => {
        try {
            const data = await resend().unwrap();
            toast.success(data.message || 'Verification email sent.');
            if (!data.alreadyVerified) setCooldown(COOLDOWN_SECONDS);
        } catch (err) {
            toast.error(err?.data?.message || 'Could not send the email. Please try again later.');
        }
    };

    return (
        <div
            role="status"
            className="mb-6 flex flex-col gap-3 rounded-xl border border-warning-ink/30 bg-warning-soft p-4 text-warning-ink sm:flex-row sm:items-center sm:justify-between"
        >
            <div className="flex items-start gap-3">
                <Icon name="mark_email_unread" className="mt-0.5 text-[22px]" />
                <div>
                    <p className="text-title-md">Confirm your email address</p>
                    <p className="text-body-md">
                        We sent a link to <span className="font-semibold">{user.email}</span>. Until you confirm
                        it, you cannot post jobs or send proposals.
                    </p>
                </div>
            </div>
            <Button
                size="sm"
                variant="secondary"
                loading={isLoading}
                disabled={cooldown > 0}
                onClick={handleResend}
                className="shrink-0"
            >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
            </Button>
        </div>
    );
};

export default EmailVerificationBanner;
