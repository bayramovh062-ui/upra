import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { generateToken } from '../utils/generateToken.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

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
            createdAt: true,
        },
    });

    const token = generateToken(newUser.id, newUser.role);

    res.status(201).json({
        success: true,
        user: newUser,
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

    const token = generateToken(user.id, user.role);

    res.status(200).json({
        success: true,
        user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
        },
        token,
    });
});

// @route   GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
    res.status(200).json({
        success: true,
        user: req.user,
    });
});

// @route   PATCH /api/auth/update-me
export const updateMe = asyncHandler(async (req, res) => {
    const { fullName } = req.body;

    const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: { fullName },
        select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            createdAt: true,
        },
    });

    res.status(200).json({
        success: true,
        user: updatedUser,
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
        throw new AppError('Current password is incorrect.', 401);
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