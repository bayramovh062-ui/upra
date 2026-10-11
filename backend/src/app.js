import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { logger } from './utils/logger.js';
import authRoutes from './routes/authRoutes.js';
import { globalErrorMiddleware } from './middlewares/errorMiddleware.js';

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Routes
app.use('/api/auth', authRoutes);

// Global Error Handler
app.use(globalErrorMiddleware);

export default app;