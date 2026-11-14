import { useState } from 'react';
import { Icon } from '../../components/ui';
import { cn } from '../../lib/cn';
import { useTranslation } from '../locale/useTranslation';
import AssistantPanel from './AssistantPanel';
import { useGetAiStatusQuery } from './aiApi';

// Giriş etmiş istifadəçilər üçün sağ aşağıda dairəvi AI düyməsi.
// Status yüklənənə qədər və ya AI söndürülübsə (açar yoxdur / AI_ENABLED=false) heç nə göstərilmir.
const AssistantButton = () => {
    const { t } = useTranslation();
    const { data } = useGetAiStatusQuery();
    const [open, setOpen] = useState(false);

    if (!data?.enabled) return null;

    return (
        <>
            <AssistantPanel open={open} onClose={() => setOpen(false)} remainingToday={data.remainingToday} />
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-label={open ? t('ai.close') : t('ai.open')}
                aria-expanded={open}
                className={cn(
                    'fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full',
                    'bg-primary-container text-on-primary shadow-lg transition hover:opacity-90',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                )}
            >
                <Icon name={open ? 'close' : 'smart_toy'} className="text-[24px]" />
            </button>
        </>
    );
};

export default AssistantButton;
