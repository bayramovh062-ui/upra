import { useState } from 'react';
import { cn } from '../../lib/cn';
import Icon from '../../components/ui/Icon';
import { LOCALES } from '../../i18n';
import useTranslation from './useTranslation';

const tones = {
    surface:
        'text-secondary hover:bg-surface-container hover:text-on-surface focus-visible:ring-primary-container',
    nav: 'text-secondary-fixed-dim hover:bg-white/10 hover:text-white focus-visible:ring-primary-fixed-dim',
};

// Dil seçimi: cari dilin qısa kodu (EN/AZ/TR) göstərilir, kliklə siyahı açılır.
// Tema keçidindən asılı deyil və onunla eyni localStorage açarını istifadə etmir.
const LanguageSwitcher = ({ tone = 'surface', className }) => {
    const { locale, setLocale, t } = useTranslation();
    const [open, setOpen] = useState(false);

    const current = LOCALES.find((item) => item.code === locale) ?? LOCALES[0];

    const choose = (code) => {
        setLocale(code);
        setOpen(false);
    };

    return (
        <div className={cn('relative', className)}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={t('common.language.select')}
                title={t('common.language.select')}
                className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-lg px-2 transition',
                    'text-label-sm font-medium uppercase tracking-wide',
                    'focus:outline-none focus-visible:ring-2',
                    tones[tone]
                )}
            >
                <Icon name="language" className="text-[18px]" />
                <span>{current.short}</span>
                <Icon name="expand_more" className="text-[16px]" />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
                    <ul
                        role="menu"
                        aria-label={t('common.language.label')}
                        className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-xl border border-line bg-surface-container-lowest py-1 shadow-lg"
                    >
                        {LOCALES.map((item) => (
                            <li key={item.code} role="none">
                                <button
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={item.code === locale}
                                    onClick={() => choose(item.code)}
                                    className={cn(
                                        'flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-body-md transition',
                                        item.code === locale
                                            ? 'bg-primary-fixed text-primary'
                                            : 'text-on-surface hover:bg-surface-container-low'
                                    )}
                                >
                                    <span>{item.label}</span>
                                    {item.code === locale && (
                                        <Icon name="check" className="text-[18px]" />
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
};

export default LanguageSwitcher;
