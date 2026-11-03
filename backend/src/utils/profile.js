import { flattenSkills } from './skills.js';

const skillInclude = { select: { skill: { select: { id: true, name: true, slug: true } } } };

// Şəxsi profil (özünün /auth/me cavabı): email daxildir
export const ownProfileSelect = {
    id: true,
    email: true,
    fullName: true,
    role: true,
    headline: true,
    bio: true,
    hourlyRate: true,
    location: true,
    timezone: true,
    availability: true,
    avatarUrl: true,
    profilePublic: true,
    createdAt: true,
    skills: skillInclude,
};

// İctimai profil: email və həssas sahələr yoxdur
export const publicProfileSelect = {
    id: true,
    fullName: true,
    role: true,
    headline: true,
    bio: true,
    hourlyRate: true,
    location: true,
    timezone: true,
    availability: true,
    avatarUrl: true,
    profilePublic: true,
    createdAt: true,
    deletedAt: true,
    skills: skillInclude,
};

// { skills: [{ skill }] } -> { skills: [{ id, name, slug }] }
export const withFlatSkills = (user) => ({ ...user, skills: flattenSkills(user.skills) });
