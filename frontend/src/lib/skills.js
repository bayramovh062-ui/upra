// Bacarıq adı qaydaları backend ilə eynidir (backend/src/utils/skills.js)
export const SKILL_NAME_REGEX = /^[\p{L}\p{N}][\p{L}\p{N} .+#&/-]{0,29}$/u;

// Artıq boşluqları təmizləyir: "  REST   API " -> "REST API"
export const normalizeSkillName = (name = '') => name.trim().replace(/\s+/g, ' ');

// "Next.js" -> "next.js". Eyni bacarığı müqayisə etmək üçün
export const toSkillSlug = (name = '') => name.trim().toLowerCase().replace(/\s+/g, ' ');
