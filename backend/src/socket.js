import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { verifyContractAccess } from './utils/contractAccess.js';

let io;

export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL || '*',
            methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        },
    });

    // JWT Auth Middleware: Yalnız valid tokeni olan istifadəçilər qoşula bilər
    io.use((socket, next) => {
        const token =
            socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.split(' ')[1];

        if (!token) {
            return next(new Error('Authentication error: Token missing'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
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