import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { generateToken } from '../utils/generateToken.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { ownProfileSelect, withFlatSkills } from '../utils/profile.js';
import { resolveSkillIds } from '../utils/skills.js';
import { logger } from '../utils/logger.js';
import { issueAuthToken, consumeAuthToken, findUsedAuthTokenOwner } from '../services/authTokenService.js';
import { sendEmail, buildVerificationEmail, buildPasswordResetEmail } from '../services/emailService.js';

// Qeydiyyat/yenidən göndəriş üçün: token yaradır və təsdiq mailini göndərir. Xəta atarsa çağıran qərar verir.
const sendVerificationEmailTo = async (user) => {
    const token = await issueAuthToken(user.id, 'EMAIL_VERIFY');
    await sendEmail(buildVerificationEmail({ to: user.email, fullName: user.fullName, token }));
};

// @route   POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
    const { email, password, fullName, role } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new AppError('This email is already registered.', 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
        data: {
            email,
            passwordHash: hashedPassword,
            fullName,
            role: role || 'CLIENT',
        },
        select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            emailVerified: true,
            tokenVersion: true,
            createdAt: true,
        },
    });

    // Qeydiyyat e-poçt xətası uğrunda sınmamalıdır: istifadəçi sonra "yenidən göndər" edə bilər.
    try {
        await sendVerificationEmailTo(newUser);
    } catch (err) {
        logger.error(`Verification email failed for ${newUser.id}: ${err.message}`);
    }

    const { tokenVersion, ...publicUser } = newUser;
    const token = generateToken(newUser.id, newUser.role, tokenVersion);

    res.status(201).json({
        success: true,
        user: publicUser,
        token,
    });
});

// @route   POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt !== null) {
        throw new AppError('Invalid email or password', 401);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
        throw new AppError('Invalid email or password', 401);
    }

    // P3: suspend yoxlaması yalnız parol düzgün olduqdan sonra (hesab mövcudluğunu sızdırmamaq üçün).
    if (user.isSuspended) {
        throw new AppError('Your account is suspended. Contact support for help.', 403);
    }

    const token = generateToken(user.id, user.role, user.tokenVersion);

    res.status(200).json({
        success: true,
        user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            emailVerified: user.emailVerified,
        },
        token,
    });
});

// @route   GET /api/auth/me
// Tam profil (bacarıqlar daxil). Hər sorğuda işləyən protect middleware-i yüngül qalsın deyə bacarıqlar burada çəkilir.
export const getMe = asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: ownProfileSelect,
    });

    res.status(200).json({
        success: true,
        user: withFlatSkills(user),
    });
});

// @route   PATCH /api/auth/update-me
export const updateMe = asyncHandler(async (req, res) => {
    const { fullName, headline, bio, hourlyRate, location, timezone, availability, avatarUrl, profilePublic, skills } = req.body;

    if (hourlyRate != null && req.user.role !== 'FREELANCER') {
        throw new AppError('Only freelancers can set an hourly rate', 400);
    }

    if (skills !== undefined && req.user.role !== 'FREELANCER') {
        throw new AppError('Only freelancers can set skills', 400);
    }

    // Yalnız göndərilən sahələr dəyişir; boş sətir null olur
    const data = {};
    if (fullName !== undefined) data.fullName = fullName;
    if (headline !== undefined) data.headline = headline || null;
    if (bio !== undefined) data.bio = bio || null;
    if (hourlyRate !== undefined) data.hourlyRate = hourlyRate;
    if (location !== undefined) data.location = location || null;
    if (timezone !== undefined) data.timezone = timezone || null;
    if (availability !== undefined) data.availability = availability;
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl || null;
    if (profilePublic !== undefined) data.profilePublic = profilePublic;

    const updatedUser = await prisma.$transaction(async (tx) => {
        if (skills !== undefined) {
            const skillIds = await resolveSkillIds(tx, skills);
            await tx.userSkill.deleteMany({ where: { userId: req.user.id } });
            if (skillIds.length > 0) {
                await tx.userSkill.createMany({ data: skillIds.map((skillId) => ({ userId: req.user.id, skillId })) });
            }
        }

        return tx.user.update({
            where: { id: req.user.id },
            data,
            select: ownProfileSelect,
        });
    });

    res.status(200).json({
        success: true,
        user: withFlatSkills(updatedUser),
    });
});

// @route   PATCH /api/auth/update-password
export const updatePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
    });

    const isPasswordCorrect = await bcrypt.compare(
        currentPassword,
        user.passwordHash
    );

    if (!isPasswordCorrect) {
        // 401 yox, 400: frontend istənilən 401-də istifadəçini sessiyadan çıxarır, parol səhvi isə sessiya xətası deyil
        throw new AppError('Current password is incorrect.', 400);
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
        where: { id: req.user.id },
        data: { passwordHash: hashedNewPassword },
    });

    res.status(200).json({
        success: true,
        message: 'Password updated successfully.',
    });
});

// ================= PHASE B: E-POÇT TƏSDİQİ VƏ PAROL BƏRPASI =================

// @route   POST /api/auth/verify-email/send
// @access  Private. Təsdiq mailini yenidən göndərir (əvvəlki link etibarsız olur).
export const sendVerificationEmail = asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, fullName: true, emailVerified: true },
    });

    if (user.emailVerified) {
        return res.status(200).json({ success: true, alreadyVerified: true, message: 'Your email is already verified.' });
    }

    // Burada istifadəçi məhz bunu tələb edib: göndəriş xətası (503/502) ona göstərilir.
    await sendVerificationEmailTo(user);

    res.status(200).json({ success: true, alreadyVerified: false, message: 'Verification email sent. Please check your inbox.' });
});

// @route   POST /api/auth/verify-email
// @access  Public. Body: { token }
export const verifyEmail = asyncHandler(async (req, res) => {
    const { token } = req.body;

    const userId = await prisma.$transaction(async (tx) => {
        const id = await consumeAuthToken(tx, token, 'EMAIL_VERIFY');
        if (!id) return null;

        await tx.user.update({
            where: { id },
            data: { emailVerified: true, emailVerifiedAt: new Date() },
        });
        return id;
    });

    if (userId) {
        return res.status(200).json({ success: true, message: 'Your email has been verified.' });
    }

    // Linkin ikinci dəfə açılması (e-poçt skaneri, çift klik): hesab artıq təsdiqlənibsə uğurlu sayılır.
    const usedOwnerId = await findUsedAuthTokenOwner(token, 'EMAIL_VERIFY');
    if (usedOwnerId) {
        const owner = await prisma.user.findUnique({ where: { id: usedOwnerId }, select: { emailVerified: true } });
        if (owner?.emailVerified) {
            return res.status(200).json({ success: true, alreadyVerified: true, message: 'Your email is already verified.' });
        }
    }

    throw new AppError('This verification link is invalid or has expired. Request a new one from your account.', 400);
});

const FORGOT_PASSWORD_MESSAGE = 'If an account exists for that email, we sent a password reset link.';

// @route   POST /api/auth/forgot-password
// @access  Public. Body: { email }
// Cavab hər zaman eynidir: e-poçtın mövcudluğunu açıqlamır (enumeration-un qarşısı).
export const forgotPassword = asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
        where: { email: req.body.email },
        select: { id: true, email: true, fullName: true, deletedAt: true },
    });

    if (user && user.deletedAt === null) {
        const token = await issueAuthToken(user.id, 'PASSWORD_RESET');
        // Göndərişi gözləməyirik: cavab müddəti hesabın mövcud olub-olmamasını sızdırmasın.
        sendEmail(buildPasswordResetEmail({ to: user.email, fullName: user.fullName, token })).catch((err) =>
            logger.error(`Password reset email failed for ${user.id}: ${err.message}`)
        );
    }

    res.status(200).json({ success: true, message: FORGOT_PASSWORD_MESSAGE });
});

// @route   POST /api/auth/reset-password
// @access  Public. Body: { token, newPassword }
// Token birdəfəlik və 1 saatlıqdır. Uğurlu sıfırlamadan sonra bütün köhnə sessiyalar ləğv olunur (tokenVersion).
export const resetPassword = asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;
    const passwordHash = await bcrypt.hash(newPassword, 10);

    const userId = await prisma.$transaction(async (tx) => {
        const id = await consumeAuthToken(tx, token, 'PASSWORD_RESET');
        if (!id) return null;

        const current = await tx.user.findUnique({ where: { id }, select: { emailVerified: true, deletedAt: true } });
        if (!current || current.deletedAt !== null) return null;

        await tx.user.update({
            where: { id },
            data: {
                passwordHash,
                tokenVersion: { increment: 1 },
                // Linki yalnız e-poçtın sahibi ala bilər: bu həm də e-poçtın təsdiqidir
                ...(current.emailVerified ? {} : { emailVerified: true, emailVerifiedAt: new Date() }),
            },
        });
        await tx.authToken.deleteMany({ where: { userId: id, usedAt: null } });
        return id;
    });

    if (!userId) {
        throw new AppError('This reset link is invalid or has expired. Please request a new one.', 400);
    }

    res.status(200).json({ success: true, message: 'Your password has been reset. You can now log in.' });
});
