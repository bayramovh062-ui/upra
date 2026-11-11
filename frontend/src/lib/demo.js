// "Demo / test pulu" mətnləri bir yerdə: Topbar, footer, qeydiyyat və pul təsdiqi pəncərələri eyni sözləri işlədir.
// Mətn aktiv dilə görə `translate` ilə oxunur.
import { translate } from '../i18n';

export const demoBadge = () => translate('common.demo.badge');

export const demoNotice = () => translate('common.demo.notice');

// Pul hərəkətini təsdiq edən pəncərələrin sonuna əlavə olunur
export const demoMoneyNote = () => translate('common.demo.moneyNote');
