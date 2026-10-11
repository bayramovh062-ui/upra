import { logger } from '../utils/logger.js';

export const globalErrorMiddleware = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || "Internal server error";

    // Prisma errors
    if (err.code === 'P2025') {
        statusCode = 404;
        message = "The requested information was not found.";
    }

    if (err.code === 'P2002') {
        statusCode = 400;
        message = "This information already exists in the system.";
    }

    // JWT errors
    if (err.name === "JsonWebTokenError") {
        statusCode = 401;
        message = "No authorization, invalid token";
    }

    if (err.name === "TokenExpiredError") {
        statusCode = 401;
        message = "The token has expired; please log in again.";
    }

    // Logging
    if (statusCode === 500) {
        logger.error(`${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`, { stack: err.stack });

        // Daxili sistem xətalarını production-da gizlədirik ki, kənara məlumat sızmasın
        if (process.env.NODE_ENV === 'production') {
            message = "Something went wrong on the server.";
        }
    } else {
        logger.warn(`${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
    }

    return res.status(statusCode).json({
        success: false,
        message,
    });
};