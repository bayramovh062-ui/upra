// İstifadə: node scripts/test-email.js alici@example.com
// SMTP (Gmail App Password) konfiqurasiyasını serverdən asılı olmadan yoxlayır və Gmail-in cavabını çap edir.
import 'dotenv/config';
import nodemailer from 'nodemailer';

const to = process.argv[2];
if (!to) {
    console.error('İstifadə: node scripts/test-email.js alici@example.com');
    process.exit(1);
}

const user = process.env.SMTP_USER?.trim();
const pass = process.env.SMTP_PASS?.replace(/\s+/g, '');
if (!user || !pass) {
    console.error('SMTP_USER / SMTP_PASS .env-də tapılmadı.');
    process.exit(1);
}

const port = Number(process.env.SMTP_PORT) || 465;
const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
});

try {
    await transport.verify();
    console.log('1) SMTP bağlantısı və giriş: OK');

    const info = await transport.sendMail({
        from: `Upra <${user}>`,
        to,
        subject: `Upra SMTP test ${new Date().toISOString()}`,
        text: 'Bu Upra layihəsindən test məktubudur. Bunu görürsənsə, SMTP işləyir.',
    });
    console.log('2) Göndəriş nəticəsi:');
    console.log('   accepted:', info.accepted);
    console.log('   rejected:', info.rejected);
    console.log('   response:', info.response);
    console.log('   messageId:', info.messageId);
} catch (err) {
    console.error('XƏTA:', err.code || '', err.message);
    if (err.response) console.error('Server cavabı:', err.response);
    process.exit(1);
}
