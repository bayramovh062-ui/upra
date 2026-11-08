import { logger } from '../utils/logger.js';

export const globalErrorMiddleware = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || "Internal server error";

    // Prisma errors

    if (err.code === 'P2003') {
        statusCode = 400
        message = 'Invalid reference ID: Related entity not found or constraint failed'
    }

    if (err.code === 'P2025') {
        statusCode = 404;
        message = "The requested information was not found.";
    }

    // Unikal indeks pozuntusu (məs. eyni anda iki eyni təklif sorğusu): 409 Conflict
    if (err.code === 'P2002') {
        statusCode = 409;
        message = "This information already exists in the system.";
    }

    // Deadlock / yazma konflikti (maliyyə servisi 3 dəfə cəhd edib, nəticə alınmayıb)
    if (err.code === 'P2034') {
        statusCode = 409;
        message = "The operation conflicted with another request. Please try again.";
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

    // Multer upload limits
    if (err.code === 'LIMIT_FILE_SIZE') {
        statusCode = 400;
        message = 'File is too large';
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_PART_COUNT') {
        statusCode = 400;
        message = 'Too many files or invalid upload form';
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