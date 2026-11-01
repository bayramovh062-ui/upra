import prisma from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// @route   GET /api/categories
// @access  Public. Find Work filtrindəki "Job Category" siyahısı (açıq iş sayı ilə)
export const getCategories = asyncHandler(async (req, res) => {
    const rows = await prisma.category.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { jobs: { where: { status: 'OPEN' } } } } },
    });

    const categories = rows.map(({ _count, ...category }) => ({ ...category, openJobs: _count.jobs }));

    res.status(200).json({ success: true, count: categories.length, categories });
});

// @route   GET /api/skills?search=rea&limit=20
// @access  Public. Bacarıq çipləri üçün avtomatik tamamlama; ən çox işlənənlər əvvəldə
export const getSkills = asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 20));

    const skills = await prisma.skill.findMany({
        where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
        orderBy: [{ jobs: { _count: 'desc' } }, { users: { _count: 'desc' } }, { name: 'asc' }],
        take: limit,
        select: { id: true, name: true, slug: true },
    });

    res.status(200).json({ success: true, count: skills.length, skills });
});
