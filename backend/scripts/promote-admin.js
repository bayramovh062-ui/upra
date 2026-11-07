import dotenv from 'dotenv';

// ADMIN bootstrap-ı yalnız bu skriptlə aparılır. Public endpoint YOXDUR.
// İstifadə: npm run admin:promote -- user@example.com   (backend qovluğunda)
// Skript .env-dəki DATABASE_URL ilə işləyir (default: development bazası).
dotenv.config();

const email = (process.argv[2] || process.env.ADMIN_EMAIL || '').trim().toLowerCase();

if (!email) {
    console.error('Usage: npm run admin:promote -- <existing-user-email>');
    process.exit(1);
}

const { default: prisma } = await import('../src/config/db.js');

try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, role: true } });
    if (!user) {
        console.error(`No user found with email ${email}`);
        process.exitCode = 1;
    } else if (user.role === 'ADMIN') {
        console.log(`${user.email} is already an ADMIN`);
    } else {
        await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
        console.log(`${user.email}: ${user.role} -> ADMIN`);
    }
} catch (err) {
    console.error(`Failed to promote admin: ${err.message}`);
    process.exitCode = 1;
} finally {
    await prisma.$disconnect();
}
