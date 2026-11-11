import { useState } from 'react';
import toast from 'react-hot-toast';
import { Icon } from '../../components/ui';
import { fieldClass } from '../../components/ui/fieldClass';
import { useDebounce } from '../../lib/useDebounce';
import { SKILL_NAME_REGEX, normalizeSkillName, toSkillSlug } from '../../lib/skills';
import { useTranslation } from '../locale/useTranslation';
import { useGetSkillsQuery } from './taxonomyApi';

// Bacarıq çipləri + avtomatik tamamlama.
//   value: bacarıq adlarının siyahısı (["React", "Node.js"]), onChange(yeniSiyahı)
//   allowCreate=false: yalnız mövcud bacarıqlar seçilir (filtrlər üçün)
const SkillPicker = ({
    value = [],
    onChange,
    max = 15,
    allowCreate = true,
    placeholder,
    chipClassName = 'bg-primary-fixed text-on-primary-fixed',
}) => {
    const { t } = useTranslation();
    const resolvedPlaceholder = placeholder ?? t('jobs.skillPicker.defaultPlaceholder');
    const [input, setInput] = useState('');
    const [open, setOpen] = useState(false);
    const debounced = useDebounce(input.trim(), 250);

    const { data } = useGetSkillsQuery({ search: debounced, limit: 8 }, { skip: !open });

    const selected = new Set(value.map(toSkillSlug));
    const suggestions = (data?.skills ?? []).filter((s) => !selected.has(s.slug));
    const typedSlug = toSkillSlug(input);
    const exact = suggestions.find((s) => s.slug === typedSlug);
    const canCreate = allowCreate && typedSlug && !exact && !selected.has(typedSlug);

    const add = (raw) => {
        const name = normalizeSkillName(raw);
        if (!name) return;
        if (selected.has(toSkillSlug(name))) {
            setInput('');
            return;
        }
        if (value.length >= max) {
            toast.error(t('jobs.skillPicker.tooMany', { max }));
            return;
        }
        if (!SKILL_NAME_REGEX.test(name)) {
            toast.error(t('jobs.skillPicker.invalid'));
            return;
        }
        onChange([...value, name]);
        setInput('');
    };

    const remove = (name) => onChange(value.filter((n) => toSkillSlug(n) !== toSkillSlug(name)));

    const onKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            if (!input.trim()) return;
            if (allowCreate) add(exact?.name ?? input);
            else if (suggestions[0]) add(suggestions[0].name);
        } else if (e.key === 'Backspace' && !input && value.length > 0) {
            remove(value[value.length - 1]);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    const showMenu = open && (suggestions.length > 0 || canCreate);

    return (
        <div className="flex flex-col gap-2">
            {value.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {value.map((name) => (
                        <span
                            key={toSkillSlug(name)}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption ${chipClassName}`}
                        >
                            {name}
                            <button
                                type="button"
                                onClick={() => remove(name)}
                                aria-label={t('jobs.skillPicker.remove', { name })}
                                className="flex items-center opacity-70 transition-opacity hover:opacity-100"
                            >
                                <Icon name="close" className="text-[13px]" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            <div className="relative">
                <input
                    type="text"
                    value={input}
                    placeholder={
                        value.length >= max
                            ? t('jobs.skillPicker.limitReached', { max })
                            : resolvedPlaceholder
                    }
                    disabled={value.length >= max}
                    onChange={(e) => setInput(e.target.value)}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 120)}
                    onKeyDown={onKeyDown}
                    className={fieldClass(false)}
                    autoComplete="off"
                    aria-label={t('jobs.skillPicker.searchLabel')}
                />

                {showMenu && (
                    <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-line bg-surface-container-lowest py-1 shadow-lg">
                        {suggestions.map((skill) => (
                            <li key={skill.id}>
                                <button
                                    type="button"
                                    // mousedown: input blur olmadan seçmək üçün
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        add(skill.name);
                                    }}
                                    className="block w-full px-3 py-2 text-left text-body-md text-on-surface hover:bg-surface-container-low"
                                >
                                    {skill.name}
                                </button>
                            </li>
                        ))}
                        {canCreate && (
                            <li>
                                <button
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        add(input);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-body-md text-primary hover:bg-surface-container-low"
                                >
                                    <Icon name="add" className="text-[16px]" />
                                    {t('jobs.skillPicker.addSuggestion', { name: normalizeSkillName(input) })}
                                </button>
                            </li>
                        )}
                    </ul>
                )}
            </div>

            {max && (
                <p className="text-caption text-secondary">
                    {t('jobs.skillPicker.selected', { count: value.length, max })}
                </p>
            )}
        </div>
    );
};

export default SkillPicker;
