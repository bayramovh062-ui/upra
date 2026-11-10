import winston from 'winston';

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

export const logger = winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
    ]
});

// Development-də rəngli oxunaqlı format; production-da (Render) JSON sətirləri konsola yazılır ki, Logs bölməsində görünsün.
logger.add(
    new winston.transports.Console({
        format:
            process.env.NODE_ENV !== 'production'
                ? winston.format.combine(winston.format.colorize(), winston.format.simple())
                : logFormat,
    })
);