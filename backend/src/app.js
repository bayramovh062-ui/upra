import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { logger } from './utils/logger.js';
import authRoutes from './routes/authRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import { globalErrorMiddleware } from './middlewares/errorMiddleware.js';
import proposalRoutes from './routes/proposalRoutes.js';
import contractRoutes from './routes/contractRoutes.js';
import issueRoutes from './routes/issueRoutes.js';
import userRoutes from './routes/userRoutes.js';
import taxonomyRoutes from './routes/taxonomyRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import milestoneRoutes from './routes/milestoneRoutes.js';
import internalRoutes from './routes/internalRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import attachmentRoutes from './routes/attachmentRoutes.js';
import { AppError } from './utils/AppError.js';
import { resolveTrustProxy } from './config/proxy.js';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Render/Railway kimi hostinqlərdə sorğular proxy-dən keçir. Bunu yazmasaq rate limiter
// bütün istifadəçiləri eyni IP sanıb hamısını birlikdə bloklayar. Dəyər TRUST_PROXY ilə tənzimlənir (config/proxy.js).
const trustProxy = resolveTrustProxy();
if (trustProxy !== false) {
    app.set('trust proxy', trustProxy);
}

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
// Sağlamlıq yoxlaması: DB-yə toxunmur (Neon compute-u oyatmasın), Render/uptime pinger üçün
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/milestones', milestoneRoutes);
app.use('/api/internal', internalRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api', issueRoutes);
app.use('/api', userRoutes);
app.use('/api', taxonomyRoutes);

// Plan P3: local upload fallback (dev/test). Files served by key; URLs are unguessable-ish but not a substitute for Cloudinary in prod.
const localUploadDir = process.env.UPLOAD_LOCAL_DIR || path.join(__dirname, '../uploads');
if (fs.existsSync(localUploadDir) || process.env.UPLOAD_PROVIDER === 'local' || (!process.env.CLOUDINARY_CLOUD_NAME && process.env.NODE_ENV !== 'production')) {
    fs.mkdirSync(localUploadDir, { recursive: true });
    app.use('/api/uploads/local', express.static(localUploadDir, { fallthrough: false, index: false }));
}

app.use((req, res, next) => {
    next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
})

// Global Error Handler
app.use(globalErrorMiddleware);

export default app;
