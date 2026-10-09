import bcrypt from 'bcryptjs';
import prisma from '../config/db.js';
import { generateToken } from '../utils/generateToken.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// @route   POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
    const { email, password, fullName, role } = req.body;

    if (!email || !password || !fullName || !role) {
        return res.status(400).json({ message: 'Bütün xanaları doldurun' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        return res.status(400).json({ message: 'Bu email artıq qeydiyyatdan keçib' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
        data: {
            email,
            password: hashedPassword,
            fullName,
            role,
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

    if (!email || !password) {
        return res.status(400).json({ message: 'Email və parolu daxil edin' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt !== null) {
        return res.status(401).json({ message: 'Email və ya parol yanlışdır' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(401).json({ message: 'Email və ya parol yanlışdır' });
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