// Mobildə uzun forma: "Göndər" düyməsini aşağıda basan istifadəçi yuxarıdakı sahənin xətasını görmür.
// FieldError ekrana çıxanda bu köməkçi (yalnız istifadəçi bu an klik/submit/Enter edibsə) ən yuxarıdakı xətanı
// görünən yerə gətirir. Yazı zamanı yenilənən xətalar səhifəni sürüşdürmür.

const HEADER_OFFSET = 80; // sabit topbar (64px) + boşluq
const BOTTOM_GAP = 16;
const INTENT_WINDOW_MS = 2000; // klikdən sonra xəta bu müddət ərzində çıxsa, səbəbi həmin klikdir

let lastIntentAt = 0;
let scheduled = false;
const pending = new Set();

if (typeof document !== 'undefined') {
    const mark = () => {
        lastIntentAt = Date.now();
    };
    document.addEventListener('click', mark, true);
    document.addEventListener('submit', mark, true);
    document.addEventListener(
        'keydown',
        (e) => {
            if (e.key === 'Enter') mark();
        },
        true
    );
}

const isVisible = (el) => {
    const rect = el.getBoundingClientRect();
    // visualViewport: mobil klaviatura açıq olanda həqiqətən görünən hündürlük
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    return rect.top >= HEADER_OFFSET && rect.bottom <= viewportHeight - BOTTOM_GAP;
};

const flush = () => {
    scheduled = false;
    const elements = [...pending].filter((el) => el.isConnected);
    pending.clear();
    if (elements.length === 0) return;

    // Eyni anda bir neçə xəta çıxanda DOM sırasına görə ən yuxarıdakına gedirik
    elements.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    const first = elements[0];
    if (isVisible(first)) return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    first.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
};

export const revealError = (el) => {
    if (!el || Date.now() - lastIntentAt > INTENT_WINDOW_MS) return;
    pending.add(el);
    if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(flush);
    }
};
