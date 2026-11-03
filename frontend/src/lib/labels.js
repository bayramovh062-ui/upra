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

export const AVAILABILITY_OPTIONS = [
    { value: 'AVAILABLE', label: 'Available for work', tone: 'green' },
    { value: 'BUSY', label: 'Busy', tone: 'amber' },
    { value: 'UNAVAILABLE', label: 'Not available', tone: 'gray' },
];

export const availabilityLabel = (value) => labelOf(AVAILABILITY_OPTIONS, value);
export const availabilityTone = (value) => AVAILABILITY_OPTIONS.find((item) => item.value === value)?.tone ?? 'gray';

// IANA saat qurşaqları (brauzerin siyahısı). Backend də eyni adları Intl ilə yoxlayır
export const TIMEZONES = (() => {
    const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
    return ['UTC', ...zones.filter((zone) => zone !== 'UTC')];
})();

export const isValidTimezone = (value) => {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
        return true;
    } catch {
        return false;
    }
};
