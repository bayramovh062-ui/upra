import { cn } from '../../lib/cn';

// Köhnə ad → Material Symbols adı. Birbaşa Material adı da vermək olar: <Icon name="view_kanban" />
const ALIASES = {
    home: 'dashboard',
    briefcase: 'work',
    document: 'description',
    contract: 'verified_user',
    bell: 'notifications',
};

// Material Symbols Outlined (index.html-də yüklənir). Ölçünü className ilə ver: text-[18px]
const Icon = ({ name, filled = false, className }) => (
    <span
        aria-hidden="true"
        className={cn('material-symbols-outlined select-none text-[20px] leading-none', className)}
        style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
        {ALIASES[name] || name}
    </span>
);

export default Icon;
