import http from 'http';
import app from './src/app.js';
import { initSocket } from './src/socket.js';

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Socket.io tətbiq olunur
initSocket(server);

server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});