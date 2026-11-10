import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

// =====================================================================================
// E-poçt göndərişi (Resend REST API, əlavə paket yoxdur).
//  - test:        real göndəriş yoxdur, mesajlar yaddaşdakı `testOutbox`-a yazılır.
//  - development: RESEND_API_KEY yoxdursa mesaj konsola/loga yazılır (link oradan götürülür).
//  - production:  RESEND_API_KEY və EMAIL_FROM məcburidir; yoxdursa xəta (Phase A ilə eyni prinsip).
// =====================================================================================

const isProduction = () => process.env.NODE_ENV === 'production';
const isTest = () => process.env.NODE_ENV === 'test';

export const testOutbox = [];
export const clearTestOutbox = () => {
    testOutbox.length = 0;
};

const emailConfigured = () => Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());

// server.js açılışda çağırır: production-da konfiqurasiya natamamdırsa server qalxmır.
export const assertEmailReady = () => {
    if (isProduction() && !emailConfigured()) {
        throw new AppError(
            'Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM (and APP_URL) for production.',
            503
        );
    }
};

// E-poçtdakı linklərin göstərəcəyi frontend ünvanı
export const getAppUrl = () => {
    const explicit = process.env.APP_URL?.trim();
    const fromClient = process.env.CLIENT_URL?.split(',')[0]?.trim();
    return (explicit || fromClient || 'http://localhost:5173').replace(/\/+$/, '');
};

export const sendEmail = async ({ to, subject, html, text }) => {
    // Qeyd: test növbəsinə yazma sinxrondur (ilk await-dən əvvəl), ona görə "await etmədən" çağırışda da testlər görür.
    if (isTest()) {
        testOutbox.push({ to, subject, html, text });
        return { provider: 'test' };
    }

    if (!emailConfigured()) {
        if (isProduction()) {
            throw new AppError('Email delivery is not configured on this server.', 503);
        }
        logger.info(`[email:dev] To: ${to} | Subject: ${subject}\n${text}`);
        return { provider: 'console' };
    }

    let response;
    try {
        response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ from: process.env.EMAIL_FROM.trim(), to: [to], subject, html, text }),
            signal: AbortSignal.timeout(10_000),
        });
    } catch (err) {
        logger.error(`Resend request failed: ${err.message}`);
        throw new AppError('Could not send the email right now. Please try again later.', 502);
    }

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        logger.error(`Resend rejected the email (${response.status}): ${detail}`);
        throw new AppError('Could not send the email right now. Please try again later.', 502);
    }

    return { provider: 'resend' };
};

// ---------------- Şablonlar ----------------

const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

const layout = ({ heading, paragraphs, buttonLabel, url, footer }) => `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;">${escapeHtml(heading)}</h1>
      ${paragraphs.map((p) => `<p style="margin:0 0 16px;line-height:1.5;">${escapeHtml(p)}</p>`).join('\n      ')}
      <p style="margin:24px 0;">
        <a href="${escapeHtml(url)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;">${escapeHtml(buttonLabel)}</a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">If the button does not work, copy this link into your browser:</p>
      <p style="margin:0 0 16px;font-size:13px;word-break:break-all;color:#2563eb;">${escapeHtml(url)}</p>
      <p style="margin:0;font-size:12px;color:#9ca3af;">${escapeHtml(footer)}</p>
    </div>
  </body>
</html>`;

export const buildVerificationEmail = ({ to, fullName, token }) => {
    const url = `${getAppUrl()}/verify-email?token=${token}`;
    const firstName = String(fullName || '').split(' ')[0] || 'there';
    const paragraphs = [
        `Hi ${firstName}, welcome to Upra! Please confirm your email address to unlock posting jobs and sending proposals.`,
        'This link is valid for 24 hours.',
    ];
    return {
        to,
        subject: 'Confirm your email address - Upra',
        html: layout({
            heading: 'Confirm your email',
            paragraphs,
            buttonLabel: 'Confirm email',
            url,
            footer: 'If you did not create an Upra account, you can ignore this email. Upra is a demo project: all money is test money.',
        }),
        text: `${paragraphs.join('\n\n')}\n\nConfirm your email: ${url}`,
    };
};

export const buildPasswordResetEmail = ({ to, fullName, token }) => {
    const url = `${getAppUrl()}/reset-password?token=${token}`;
    const firstName = String(fullName || '').split(' ')[0] || 'there';
    const paragraphs = [
        `Hi ${firstName}, we received a request to reset your Upra password.`,
        'This link is valid for 1 hour and can be used only once. Resetting your password signs you out of all devices.',
    ];
    return {
        to,
        subject: 'Reset your password - Upra',
        html: layout({
            heading: 'Reset your password',
            paragraphs,
            buttonLabel: 'Choose a new password',
            url,
            footer: 'If you did not request this, you can safely ignore this email: your password stays unchanged.',
        }),
        text: `${paragraphs.join('\n\n')}\n\nReset your password: ${url}`,
    };
};
