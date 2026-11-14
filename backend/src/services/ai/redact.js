// Sərbəst mətni xarici AI-yə göndərməzdən əvvəl təmizləyir və kəsir.
// Qeyd: bu sadə regex-dir, tam məxfilik təminatı deyil (pulsuz Gemini planında mətn Google tərəfindən istifadə oluna bilər).

export const REDACTED = '[gizlədilib]';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// 7 və daha çox rəqəmdən ibarət ardıcıllıq, aralarda boşluq, tire, nöqtə, mötərizə ola bilər; əvvəlində +
const PHONE_RE = /\+?\d(?:[\s().-]*\d){6,}/g;

export const redactText = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(EMAIL_RE, REDACTED).replace(PHONE_RE, REDACTED);
};

export const truncate = (text, max) => {
    if (typeof text !== 'string') return '';
    return text.length > max ? `${text.slice(0, max)}…` : text;
};
