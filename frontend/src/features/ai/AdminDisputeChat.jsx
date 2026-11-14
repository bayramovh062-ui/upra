import { useState } from 'react';
import { Icon } from '../../components/ui';
import { cn } from '../../lib/cn';
import { useTranslation } from '../locale/useTranslation';
import AiChat from './AiChat';
import { useGetAiStatusQuery, useSendDisputeAiMessageMutation } from './aiApi';

// Admin mübahisə pəncərəsində "AI ilə müzakirə et" bölməsi. Server bu mübahisənin sübutlarını, tarixçəsini və
// yazışmasını özü yükləyir (rollar, əlaqə məlumatı gizli); AI yalnız fikir bildirir, qərarı və pul hərəkətini admin verir.
// Söhbət bölmə bağlananda da mount qalır (yalnız gizlənir), ona görə itmir.
const AdminDisputeChat = ({ disputeId }) => {
    const { t, locale } = useTranslation();
    const { data } = useGetAiStatusQuery();
    const [sendDisputeAiMessage] = useSendDisputeAiMessageMutation();
    const [open, setOpen] = useState(false);

    if (!data?.enabled) return null;

    const send = (messages) => sendDisputeAiMessage({ id: disputeId, messages, locale }).unwrap();

    return (
        <div className="mb-4 overflow-hidden rounded-xl border border-line">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-body-md font-medium text-on-surface hover:bg-surface-container-low focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-container"
            >
                <span className="inline-flex items-center gap-2">
                    <Icon name="smart_toy" className="text-[18px] text-primary" />
                    {t('ai.admin.title')}
                </span>
                <Icon name={open ? 'expand_less' : 'expand_more'} className="text-secondary" />
            </button>

            <div className={cn(!open && 'hidden')}>
                <p className="border-t border-line px-3.5 py-2 text-label-md text-on-surface-variant">
                    {t('ai.admin.hint')}
                </p>
                <AiChat className="h-80 border-t border-line" send={send} placeholder={t('ai.admin.placeholder')} />
            </div>
        </div>
    );
};

export default AdminDisputeChat;
