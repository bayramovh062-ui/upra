import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/authRoutes.js';
import { globalErrorMiddleware } from './middlewares/errorMiddleware.js';

const app = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

app.use(globalErrorMiddleware);

export default app;