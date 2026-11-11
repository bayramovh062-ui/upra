import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { useResendVerificationMutation } from '../features/auth/authApi';
import { useTranslation } from '../features/locale/useTranslation';
import { translateApiMessage } from '../i18n';
import { Button, Icon } from './ui';

const COOLDOWN_SECONDS = 60;

// Təsdiqlənməmiş hesab üçün üst xəbərdarlıq. `emailVerified === false` yoxlanılır:
// sahəsi olmayan köhnə saxlanmış user obyektində (undefined) banner görünmür.
const EmailVerificationBanner = () => {
    const { t } = useTranslation();
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
            toast.success(data.message ? translateApiMessage(data.message) : t('shell.emailBanner.sent'));
            if (!data.alreadyVerified) setCooldown(COOLDOWN_SECONDS);
        } catch (err) {
            toast.error(err?.data?.message ? translateApiMessage(err.data.message) : t('shell.emailBanner.failed'));
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
                    <p className="text-title-md">{t('shell.emailBanner.title')}</p>
                    <p className="text-body-md">{t('shell.emailBanner.body', { email: user.email })}</p>
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
                {cooldown > 0
                    ? t('shell.emailBanner.resendIn', { seconds: cooldown })
                    : t('shell.emailBanner.resend')}
            </Button>
        </div>
    );
};

export default EmailVerificationBanner;
