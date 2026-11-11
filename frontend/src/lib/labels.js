// Backend enum dəyərləri → ekranda göstərilən yazı. Filtrlər, kartlar və formalar eyni siyahını işlədir.
// Etiketlər aktiv dilə görə `translate` ilə oxunur; komponentlər `useTranslation` ilə
// abunə olduğundan dil dəyişəndə avtomatik yenilənir.
import { translate } from '../i18n';

export const EXPERIENCE_VALUES = ['ENTRY', 'MID', 'SENIOR'];
export const PAYMENT_VALUES = ['MILESTONES', 'LUMP_SUM'];
export const AVAILABILITY_VALUES = ['AVAILABLE', 'BUSY', 'UNAVAILABLE'];

export const experienceLevels = () =>
    EXPERIENCE_VALUES.map((value) => ({ value, label: translate(`labels.experience.${value}`) }));

export const paymentStructures = () =>
    PAYMENT_VALUES.map((value) => ({ value, label: translate(`labels.payment.${value}`) }));

export const experienceLabel = (value) => (value ? translate(`labels.experience.${value}`) : null);
export const paymentLabel = (value) => (value ? translate(`labels.payment.${value}`) : null);

export const availabilityOptions = () =>
    AVAILABILITY_VALUES.map((value) => ({
        value,
        label: translate(`labels.availability.${value}`),
        tone: { AVAILABLE: 'green', BUSY: 'amber', UNAVAILABLE: 'gray' }[value],
    }));

export const availabilityLabel = (value) => (value ? translate(`labels.availability.${value}`) : null);
export const availabilityTone = (value) =>
    ({ AVAILABLE: 'green', BUSY: 'amber', UNAVAILABLE: 'gray' }[value] ?? 'gray');

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
