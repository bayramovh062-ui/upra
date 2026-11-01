import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { logger } from './utils/logger.js';
import authRoutes from './routes/authRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import { globalErrorMiddleware } from './middlewares/errorMiddleware.js';
import proposalRoutes from './routes/proposalRoutes.js';
import contractRoutes from './routes/contractRoutes.js';
import issueRoutes from './routes/issueRoutes.js';
import userRoutes from './routes/userRoutes.js';
import taxonomyRoutes from './routes/taxonomyRoutes.js';
import { AppError } from './utils/AppError.js';

const app = express();

// Middlewares
app.use(helmet());
// CLIENT_URL təyin olunubsa yalnız həmin ünvan(lar)a icazə verilir (vergüllə bir neçə ola bilər).
// Təyin olunmayıbsa (lokal inkişaf) hamıya açıqdır.
app.use(
    cors({
        origin: process.env.CLIENT_URL
            ? process.env.CLIENT_URL.split(',').map((url) => url.trim())
            : true,
    })
);
app.use(express.json());

app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api', issueRoutes);
app.use('/api', userRoutes);
app.use('/api', taxonomyRoutes);

app.use((req, res, next) => {
    next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
})

// Global Error Handler
app.use(globalErrorMiddleware);

export default app;
