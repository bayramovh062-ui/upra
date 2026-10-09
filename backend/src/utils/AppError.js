export class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true; // that is a logic bug not a programming bug so user can see this error's content
        Error.captureStackTrace(this, this.constructor);
    }
}