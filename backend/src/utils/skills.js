import { z } from 'zod';

// Bacarıq adı: hərf və ya rəqəmlə başlayır, 30 simvola qədər, yalnız təhlükəsiz simvollar.
// Vergül qadağandır, çünki filtrlər ?skills=a,b şəklində gəlir.
export const SKILL_NAME_REGEX = /^[\p{L}\p{N}][\p{L}\p{N} .+#&/-]{0,29}$/u;

export const skillNameSchema = z
    .string({ error: 'Skill must be a string' })
    .trim()
    .regex(SKILL_NAME_REGEX, 'Skill names must be 1-30 characters (letters, numbers, spaces and . + # & / -)');

// "  Next.js " -> "next.js", "REST   API" -> "rest api"
export const toSlug = (name) => name.trim().toLowerCase().replace(/\s+/g, ' ');

const cleanName = (name) => name.trim().replace(/\s+/g, ' ');

// Adların siyahısını slug-a görə təkrarsız edir (ilk yazılış adı saxlanır)
export const dedupeSkillNames = (names) => {
    const map = new Map();
    for (const name of names) {
        const slug = toSlug(name);
        if (!map.has(slug)) map.set(slug, cleanName(name));
    }
    return [...map.entries()].map(([slug, name]) => ({ slug, name }));
};

// Adlara uyğun Skill id-lərini qaytarır, olmayanları yaradır.
// createMany + skipDuplicates: eyni anda iki sorğu eyni bacarığı yaratsa da unikal xəta vermir.
export const resolveSkillIds = async (tx, names) => {
    const items = dedupeSkillNames(names);
    if (items.length === 0) return [];

    await tx.skill.createMany({ data: items, skipDuplicates: true });

    const rows = await tx.skill.findMany({
        where: { slug: { in: items.map((i) => i.slug) } },
        select: { id: true },
    });
    return rows.map((r) => r.id);
};

// Prisma-nın { skill: {...} } sətirlərini düz [{id, name, slug}] siyahısına çevirir
export const flattenSkills = (rows = []) => rows.map((r) => r.skill).sort((a, b) => a.name.localeCompare(b.name));

// Frilanserin bacarıqları ilə işin tələb etdiyi bacarıqların üst-üstə düşmə faizi (0-100)
export const computeMatchScore = (jobSkillIds, userSkillIdSet) => {
    if (!jobSkillIds || jobSkillIds.length === 0 || !userSkillIdSet || userSkillIdSet.size === 0) return 0;
    const overlap = jobSkillIds.filter((id) => userSkillIdSet.has(id)).length;
    return Math.round((overlap / jobSkillIds.length) * 100);
};
