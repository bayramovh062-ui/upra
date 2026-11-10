export class AppError extends Error {
    // errorCode (optional): frontend-in mətnə baxmadan reaksiya verməsi üçün sabit kod (məs. EMAIL_NOT_VERIFIED)
    constructor(message, statusCode, errorCode) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.isOperational = true; // that is a logic bug not a programming bug so user can see this error's content
        Error.captureStackTrace(this, this.constructor);
    }
}
