import { defineConfig, devices } from '@playwright/test';

// E2E testləri AYRI baza ilə işləyir. Dev bazasına heç vaxt toxunmur:
//  - E2E_DATABASE_URL məcburidir və bazanın adı "_e2e" ilə bitməlidir (backend testlərindəki "_test" qaydası kimi).
//  - Backend 5100, frontend 5174 portunda qalxır ki, işləyən dev serverlərinizlə toqquşmasın.
//  - backend/.env oxunmur (DOTENV_CONFIG_PATH başqa fayla yönəldilib): real SMTP/Brevo açarları ilə mail göndərilməsin.
//
// Lokal işə salma (PowerShell):
//   $env:E2E_DATABASE_URL="postgresql://postgres:PAROL@localhost:5433/upra_e2e?schema=public"
//   npm run e2e

const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl) {
    throw new Error(
        '[e2e] E2E_DATABASE_URL is required, e.g. postgresql://postgres:PASSWORD@localhost:5433/upra_e2e?schema=public'
    );
}

let databaseName;
try {
    databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');
} catch {
    throw new Error('[e2e] E2E_DATABASE_URL is not a valid URL.');
}
if (!/_e2e$/i.test(databaseName)) {
    throw new Error(`[e2e] Refusing to run: database "${databaseName}" must end with "_e2e".`);
}

const BACKEND_PORT = 5100;
const FRONTEND_PORT = 5174;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;
const API_URL = `http://localhost:${BACKEND_PORT}/api`;

export default defineConfig({
    testDir: './e2e',
    // Testlər eyni bazada işləyir, ardıcıl getmək ən sabit variantdır
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    timeout: 60_000,
    expect: { timeout: 10_000 },
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

    use: {
        baseURL: FRONTEND_URL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },

    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.js/ },
        { name: 'mobile', use: { ...devices['Pixel 5'] }, testMatch: /mobile\.spec\.js/ },
    ],

    webServer: [
        {
            // Migrasiyalar (kateqoriya və bacarıqlar da onlarla gəlir) tətbiq olunur, sonra backend qalxır
            command: 'npx prisma migrate deploy && npm start',
            cwd: '../backend',
            url: `http://localhost:${BACKEND_PORT}/api/health`,
            // Özbaşına mövcud serverə qoşulmuruq: yanlışlıqla dev bazasına yazmaq olmaz
            reuseExistingServer: false,
            timeout: 120_000,
            env: {
                NODE_ENV: 'development',
                PORT: String(BACKEND_PORT),
                DATABASE_URL: databaseUrl,
                JWT_SECRET: 'e2e_secret_not_for_production',
                CLIENT_URL: FRONTEND_URL,
                ENABLE_SCHEDULER: 'false',
                REQUIRE_EMAIL_VERIFICATION: 'false',
                // Əsas axın demo pul kisəsini doldurur (real ödəniş yoxdur)
                DEMO_TOPUP_ENABLED: 'true',
                UPLOAD_PROVIDER: 'local',
                // backend/.env (SMTP, Cloudinary və s.) oxunmasın
                DOTENV_CONFIG_PATH: '.env.e2e-does-not-exist',
            },
        },
        {
            command: `npm run dev -- --port ${FRONTEND_PORT} --strictPort`,
            url: FRONTEND_URL,
            reuseExistingServer: false,
            timeout: 120_000,
            env: { VITE_API_URL: API_URL },
        },
    ],
});
