import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from './config/db.js';
import { verifyContractAccess } from './utils/contractAccess.js';

let io;

// CLIENT_URL vergüllə bir neçə ünvan ola bilər (app.js-dəki HTTP CORS ilə eyni qayda).
// Vergüllü sətri olduğu kimi vermək olmaz: heç bir origin ona bərabər olmur və socket bağlantısı rədd olunur.
const resolveSocketOrigins = () => {
    const origins = (process.env.CLIENT_URL || '')
        .split(',')
        .map((url) => url.trim())
        .filter(Boolean);
    return origins.length > 0 ? origins : '*';
};

export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: resolveSocketOrigins(),
            methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        },
    });

    // JWT Auth Middleware: Yalnız valid tokeni olan istifadəçilər qoşula bilər
    io.use(async (socket, next) => {
        const token =
            socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.split(' ')[1];

        if (!token) {
            return next(new Error('Authentication error: Token missing'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Phase B: parol sıfırlanandan sonra (tokenVersion dəyişib) və ya hesab silinib/dayandırılıbsa socket qəbul olunmur
            const user = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: { tokenVersion: true, deletedAt: true, isSuspended: true },
            });
            if (!user || user.deletedAt !== null || user.isSuspended || (decoded.ver ?? 0) !== user.tokenVersion) {
                return next(new Error('Authentication error: Invalid token'));
            }

            socket.user = decoded;
            next();
        } catch (err) {
            return next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        // Şəxsi otaq: bildirişlər yalnız token sahibinə gedir (id JWT-dən gəlir, client göndərməz)
        if (socket.user?.id) {
            socket.join(`user:${socket.user.id}`);
        }

        // Contract Otağına Qoşulma (İcazə yoxlanılır)
        socket.on('join_contract', async (contractId) => {
            try {
                await verifyContractAccess(contractId, socket.user.id);
                const roomName = `contract:${contractId}`;
                socket.join(roomName);
                socket.emit('joined_room', { room: roomName });
            } catch (error) {
                socket.emit('socket_error', { message: error.message });
            }
        });

        // Otaqdan Çıxma
        socket.on('leave_contract', (contractId) => {
            socket.leave(`contract:${contractId}`);
        });

        socket.on('disconnect', () => { });
    });

    return io;
};

// Konkret istifadəçiyə (onun bütün açıq tab/cihazlarına) real-vaxt hadisəsi göndərir
export const emitToUser = (userId, event, data) => {
    if (io) {
        io.to(`user:${userId}`).emit(event, data);
    }
};

// Controllers daxilindən real-vaxt bildirişi göndərmək üçün köməkçi funksiya
export const emitToContract = (contractId, event, data) => {
    if (io) {
        io.to(`contract:${contractId}`).emit(event, data);
    }
};