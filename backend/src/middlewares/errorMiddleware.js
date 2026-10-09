export const globalErrorMiddleware = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || "Daxili Server Xətası";

    // Prisma errors
    if (err.code === 'P2025') {
        statusCode = 404;
        message = "Axtarılan məlumat tapılmadı";
    }

    if (err.code === 'P2002') {
        statusCode = 400;
        // P2002 - Unique constraint failed (məsələn: eyni email-dən 2-ci dəfə qeydiyyat)
        message = "Bu məlumat artıq sistemdə mövcuddur";
    }

    // JWT errors
    if (err.name === "JsonWebTokenError") {
        statusCode = 401;
        message = "Səlahiyyət yoxdur, token yanlışdır";
    }

    if (err.name === "TokenExpiredError") {
        statusCode = 401;
        message = "Tokenin vaxtı bitib, yenidən daxil olun";
    }

    if (process.env.NODE_ENV !== 'production') {
        console.error(`[ERROR]: ${message}`, err);
    }

    return res.status(statusCode).json({
        success: false,
        message,
    });
};