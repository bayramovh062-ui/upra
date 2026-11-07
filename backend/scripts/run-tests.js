import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const fail = (message) => {
    console.error(`[tests] ${message}`);
    process.exit(1);
};

// Testler YALNIZ .env.test ile isleyir. .env (dev bazasi) fallback-i qadagandir:
// sehv halda `prisma migrate deploy` dev bazasina toxuna biler.
const envTest = path.join(rootDir, '.env.test');
if (!fs.existsSync(envTest)) {
    fail('backend/.env.test is required. Refusing to fall back to backend/.env (development database).');
}

const parsed = dotenv.parse(fs.readFileSync(envTest));
if (!parsed.DATABASE_URL) {
    fail('backend/.env.test does not define DATABASE_URL.');
}

let databaseName;
try {
    databaseName = new URL(parsed.DATABASE_URL).pathname.replace(/^\//, '');
} catch {
    fail('DATABASE_URL in backend/.env.test is not a valid URL.');
}

// Elave qoruma: test bazasinin adi _test ile bitmelidir.
if (!/_test$/i.test(databaseName)) {
    fail(
        `Refusing to run: test database "${databaseName}" does not end with "_test". ` +
            'Point backend/.env.test at a dedicated test database.'
    );
}

const env = {
    ...process.env,
    ...parsed,
};

const prismaCli = path.join(rootDir, 'node_modules', 'prisma', 'build', 'index.js');

const runPrisma = (args) =>
    spawnSync(process.execPath, [prismaCli, ...args], {
        cwd: rootDir,
        stdio: 'inherit',
        env,
    });

// Client her zaman cedvelden yeniden yaradilir: sxem deyisende kohne client
// (mes. `prisma.message === undefined`) testleri sebebsiz sindirir.
const generate = runPrisma(['generate']);
if (generate.status !== 0) {
    process.exit(generate.status ?? 1);
}

// Migrasiyalar avtomatik TETBIQ OLUNMUR. Yalniz status yoxlanilir; kohne test bazasi
// ile qarsilasanda aydin mesaj verilir. Tetbiq etmek ucun: UPRA_TEST_DB_MIGRATE=1 npm test
const allowMigrate = process.env.UPRA_TEST_DB_MIGRATE === '1';
const migration = allowMigrate ? runPrisma(['migrate', 'deploy']) : runPrisma(['migrate', 'status']);

if (migration.status !== 0) {
    if (allowMigrate) {
        process.exit(migration.status ?? 1);
    }
    fail(
        `The test database "${databaseName}" has pending or failed migrations. ` +
            'Review them with `npx prisma migrate status` (with backend/.env.test loaded), then apply them ' +
            'explicitly, or re-run with UPRA_TEST_DB_MIGRATE=1 after approval.'
    );
}

const jestArgs = [
    '--experimental-vm-modules',
    path.join(rootDir, 'node_modules', 'jest', 'bin', 'jest.js'),
    '--testTimeout=10000',
    ...process.argv.slice(2),
];

const jest = spawnSync(process.execPath, jestArgs, {
    cwd: rootDir,
    stdio: 'inherit',
    env,
});

process.exit(jest.status ?? 1);
