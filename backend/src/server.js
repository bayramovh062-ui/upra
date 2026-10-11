import app from './app.js';
import dotenv from 'dotenv';
dotenv.config();
if (!process.env.JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET environment variable is not defined.');
    process.exit(1);
}
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 The server is running at address http://localhost:${PORT}.`);
});