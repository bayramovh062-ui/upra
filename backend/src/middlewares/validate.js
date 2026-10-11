import { AppError } from '../utils/AppError.js';

export const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
        const issues = result.error.issues || [];

        const errorMessage = issues
            .map((err) => (err.path.length > 0 ? `${err.path.join('.')}: ${err.message}` : err.message))
            .join(', ');

        throw new AppError(errorMessage || 'Validation error', 400);
    }

    req.body = result.data;
    next();
};