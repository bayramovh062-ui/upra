import { useLocation } from 'react-router-dom';
import { Icon } from '../../components/ui';
import { cn } from '../../lib/cn';
import { useTranslation } from '../locale/useTranslation';
import AiChat from './AiChat';
import { useSendAiMessageMutation } from './aiApi';
import { contractIdFromPath } from './chatUtils';

// Sağ aşağıda açılan söhbət paneli. Parent (AssistantButton) onu həmişə mount saxlayır, bağlananda yalnız gizlədir:
// beləliklə söhbət bağla/aç arasında qalır, səhifə yenilənəndə və ya "Söhbəti təmizlə" ilə silinir.
const AssistantPanel = ({ open, onClose, remainingToday }) => {
    const { t, locale } = useTranslation();
    const { pathname } = useLocation();
    const [sendAiMessage] = useSendAiMessageMutation();

    // /contracts/:id səhifəsindəyiksə id də göndərilir (server yenə də istifadəçinin icazəsini yoxlayır)
    const contractId = contractIdFromPath(pathname);

    const send = (messages) =>
        sendAiMessage({ messages, locale, context: contractId ? { contractId } : undefined }).unwrap();

    return (
        <section
            role="dialog"
            aria-label={t('ai.title')}
            className={cn(
                'fixed bottom-20 right-4 z-40 flex h-[34rem] max-h-[calc(100dvh-6rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden',
                'rounded-2xl border border-line bg-surface-container-lowest shadow-xl sm:w-96',
                !open && 'hidden'
            )}
        >
            <header className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
                <h2 className="flex items-center gap-2 text-title-md font-semibold text-on-surface">
                    <Icon name="smart_toy" className="text-[20px] text-primary" />
                    {t('ai.title')}
                </h2>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t('ai.close')}
                    className="rounded-lg p-1 text-secondary hover:bg-surface-container hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
                >
                    <Icon name="close" />
                </button>
            </header>

            <AiChat
                className="flex-1"
                send={send}
                welcome={t('ai.welcome')}
                placeholder={t('ai.placeholder')}
                initialRemaining={remainingToday}
            />
        </section>
    );
};

export default AssistantPanel;
