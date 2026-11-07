// Jest her test faylından evvel işleyir.
// Testler YALNIZ backend/.env.test ile işleyir: .env (dev bazası) fallback-i qadağandır.
// Əks halda sehv konfiqurasiya real development bazasına yazı ede biler.
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

const envTestPath = path.resolve(__dirname, '..', '.env.test');

if (!fs.existsSync(envTestPath)) {
    throw new Error(
        '[tests] backend/.env.test is required. Refusing to run tests against the development database.'
    );
}

dotenv.config({ path: envTestPath, override: true, quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error('[tests] backend/.env.test does not define DATABASE_URL.');
}

let databaseName;
try {
    databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');
} catch {
    throw new Error('[tests] DATABASE_URL in backend/.env.test is not a valid URL.');
}

if (!/_test$/i.test(databaseName)) {
    throw new Error(
        `[tests] Refusing to run against database "${databaseName}": the name must end with "_test".`
    );
}
