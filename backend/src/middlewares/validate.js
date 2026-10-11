import { AppError } from '../utils/AppError.js';

export const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
        const errorMessage = result.error.errors
            .map((err) => `${err.path.join('.')}: ${err.message}`)
            .join(', ');

        throw new AppError(errorMessage, 400);
    }

    req.body = result.data;
    next();
};