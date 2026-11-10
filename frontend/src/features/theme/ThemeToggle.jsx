import { cn } from '../../lib/cn';
import Icon from '../../components/ui/Icon';
import useTheme from './useTheme';

const tones = {
    surface:
        'text-secondary hover:bg-surface-container hover:text-on-surface focus-visible:ring-primary-container',
    nav: 'text-secondary-fixed-dim hover:bg-white/10 hover:text-white focus-visible:ring-primary-fixed-dim',
};

// Tünd üst panellərdə `nav`, ağ/tünd səthlərdə `surface` tonu istifadə olunur.
const ThemeToggle = ({ tone = 'surface', className }) => {
    const { isDark, toggle } = useTheme();
    const nextLabel = isDark ? 'light' : 'dark';

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={`Switch to ${nextLabel} theme`}
            aria-pressed={isDark}
            title={`Switch to ${nextLabel} theme`}
            className={cn(
                'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition',
                'focus:outline-none focus-visible:ring-2',
                tones[tone],
                className
            )}
        >
            <Icon name={isDark ? 'light_mode' : 'dark_mode'} />
        </button>
    );
};

export default ThemeToggle;
