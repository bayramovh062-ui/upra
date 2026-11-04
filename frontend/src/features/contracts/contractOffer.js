// Müqavilə təklifi (PENDING_ACCEPTANCE) üçün kiçik, saf köməkçilər.
// Backend qərar verir; frontend yalnız düzgün düymələri göstərmək üçün istifadə edir.
export const isPendingOffer = (status) => status === 'PENDING_ACCEPTANCE';

// Təklifə yalnız müqavilənin frilanseri cavab verə bilər (client və kənar şəxslər yox).
export const canRespondToOffer = (contract, userId) =>
    Boolean(contract) && isPendingOffer(contract.status) && Boolean(userId) && contract.freelancerId === userId;
