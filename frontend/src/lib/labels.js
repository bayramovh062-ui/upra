// Backend enum dəyərləri → ekranda göstərilən yazı. Filtrlər, kartlar və formalar eyni siyahını işlədir.
export const EXPERIENCE_LEVELS = [
    { value: 'ENTRY', label: 'Entry' },
    { value: 'MID', label: 'Mid' },
    { value: 'SENIOR', label: 'Senior' },
];

export const PAYMENT_STRUCTURES = [
    { value: 'MILESTONES', label: 'Milestones' },
    { value: 'LUMP_SUM', label: 'Lump sum' },
];

const labelOf = (list, value) => list.find((item) => item.value === value)?.label ?? null;

export const experienceLabel = (value) => labelOf(EXPERIENCE_LEVELS, value);
export const paymentLabel = (value) => labelOf(PAYMENT_STRUCTURES, value);
