import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { initSocket } from './socket.js';
import { autoApproveDue } from './services/financialService.js';
import { logger } from './utils/logger.js';

if (!process.env.JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET environment variable is not defined.');
    process.exit(1);
}

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

initSocket(server);

server.listen(PORT, () => {
    console.log(
        `Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`
    );
});

// Avtomatik təsdiq: 7 tam gün IN_REVIEW qalan mərhələlər saatlıq yoxlanılır.
// "Nə vaxt təsdiqlənir" qaydası financialService.approveMilestone-dadır (7 gündən tez heç vaxt);
// burada yalnız onu vaxtaşırı çağıran mexanizm var. Server yenidən başlasa itirilən heç nə yoxdur:
// vəziyyət bazadadır, ilk işə düşmə qaçırılmış mərhələləri tutur. Bir neçə instansiya eyni anda işləsə də
// ikiqat ödəniş olmur (şərti updateMany + Contract kilidi). Söndürmək üçün: ENABLE_SCHEDULER=false.
const SCHEDULER_INTERVAL_MS = 60 * 60 * 1000;

if (process.env.NODE_ENV !== 'test' && process.env.ENABLE_SCHEDULER !== 'false') {
    let running = false;

    const runAutoApproval = async () => {
        if (running) return; // əvvəlki dövr hələ bitməyib
        running = true;
        try {
            const summary = await autoApproveDue();
            if (summary.due > 0) logger.info(`Auto-approval run: ${JSON.stringify(summary)}`);
        } catch (err) {
            logger.error(`Auto-approval run crashed: ${err.message}`, { stack: err.stack });
        } finally {
            running = false;
        }
    };

    setTimeout(runAutoApproval, 30 * 1000).unref();
    setInterval(runAutoApproval, SCHEDULER_INTERVAL_MS).unref();
}
