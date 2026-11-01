// Jest hər test faylından əvvəl işləyir.
// backend/.env.test varsa, testlər dev bazası əvəzinə ONUN DATABASE_URL-i ilə işləyir.
// Yoxdursa köhnə davranış qalır (dev bazası), amma xəbərdarlıq çıxır.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const envTestPath = path.resolve(__dirname, '..', '.env.test');

if (fs.existsSync(envTestPath)) {
    dotenv.config({ path: envTestPath, override: true, quiet: true });
} else if (!process.env.__UPRA_WARNED_TEST_DB) {
    process.env.__UPRA_WARNED_TEST_DB = '1';
    console.warn(
        '[tests] backend/.env.test tapılmadı: testlər dev bazasında işləyir. Ayrıca test bazası üçün .env.test.example-ə bax.'
    );
}
