import { useEffect, useRef, useState } from 'react';
import { Icon, Spinner } from '../../components/ui';
import { cn } from '../../lib/cn';
import { useTranslation } from '../locale/useTranslation';
import { MAX_CONTENT, canSend, errorKeyFor, toRequestMessages } from './chatUtils';

const BUBBLE = {
    user: 'ml-auto bg-primary-container text-on-primary',
    assistant: 'mr-auto bg-surface-container text-on-surface',
    error: 'mr-auto bg-error-container/40 text-error',
};

// Köməkçi panelinin və admin mübahisə söhbətinin ortaq hissəsi: mesaj siyahısı, daimi xəbərdarlıq, giriş sahəsi.
// Söhbət tarixçəsi yalnız bu komponentin state-indədir (bazada saxlanılmır). Komponent mount qaldıqca yaşayır.
//   send(messages) -> Promise<{ reply, remainingToday }>  (xəta atarsa söhbətdə xəta yazısı göstərilir)
const AiChat = ({ send, placeholder, welcome, initialRemaining = null, className }) => {
    const { t } = useTranslation();
    const [history, setHistory] = useState([]);
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [remaining, setRemaining] = useState(null);
    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView?.({ block: 'end' });
    }, [history, busy]);

    const submit = async () => {
        if (!canSend(text, busy)) return;
        const next = [...history, { role: 'user', content: text.trim() }];
        setHistory(next);
        setText('');
        setBusy(true);
        try {
            const data = await send(toRequestMessages(next));
            setHistory((current) => [...current, { role: 'assistant', content: data.reply }]);
            if (typeof data.remainingToday === 'number') setRemaining(data.remainingToday);
        } catch (err) {
            setHistory((current) => [...current, { role: 'error', content: t(errorKeyFor(err)) }]);
            if (err?.data?.code === 'AI_DAILY_LIMIT') setRemaining(0);
        } finally {
            setBusy(false);
        }
    };

    const onKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
        }
    };

    const remainingShown = remaining ?? initialRemaining;

    return (
        <div className={cn('flex min-h-0 flex-col', className)}>
            <p className="flex items-start gap-2 border-b border-line bg-surface-container-low px-3.5 py-2 text-label-sm text-on-surface-variant">
                <Icon name="info" className="mt-px text-[16px]" />
                <span>{t('ai.disclaimer')}</span>
            </p>

            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3.5 py-3" aria-live="polite">
                {history.length === 0 && !busy && welcome && (
                    <p className="whitespace-pre-line text-body-md text-on-surface-variant">{welcome}</p>
                )}

                {history.map((entry, index) => (
                    <div
                        key={index}
                        className={cn(
                            'max-w-[85%] whitespace-pre-line break-words rounded-2xl px-3 py-2 text-body-md',
                            BUBBLE[entry.role]
                        )}
                    >
                        {entry.content}
                    </div>
                ))}

                {busy && (
                    <div
                        className={cn(
                            'flex max-w-[85%] items-center gap-2 rounded-2xl px-3 py-2 text-body-md',
                            BUBBLE.assistant
                        )}
                    >
                        <Spinner size="sm" />
                        <span>{t('ai.thinking')}</span>
                    </div>
                )}
                <div ref={endRef} />
            </div>

            <div className="border-t border-line px-3.5 pb-3 pt-2">
                <div className="mb-1.5 flex min-h-5 items-center justify-between text-label-sm text-secondary">
                    <span>{typeof remainingShown === 'number' ? t('ai.remaining', { count: remainingShown }) : ''}</span>
                    {history.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setHistory([])}
                            className="rounded px-1 text-secondary hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
                        >
                            {t('ai.clear')}
                        </button>
                    )}
                </div>
                <div className="flex items-end gap-2">
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={onKeyDown}
                        rows={2}
                        maxLength={MAX_CONTENT}
                        placeholder={placeholder}
                        aria-label={placeholder}
                        className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-line bg-surface-container-lowest px-3 py-2 text-body-md text-on-surface shadow-sm placeholder:text-secondary/60 focus:border-primary-container focus:outline-none focus:ring-2 focus:ring-primary-container"
                    />
                    <button
                        type="button"
                        onClick={submit}
                        disabled={!canSend(text, busy)}
                        aria-label={t('ai.send')}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary shadow-sm transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Icon name="send" className="text-[20px]" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AiChat;
