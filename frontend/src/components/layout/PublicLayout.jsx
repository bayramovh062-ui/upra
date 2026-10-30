import { Outlet } from 'react-router-dom';
import Navbar from '../Navbar';

// Qonaq səhifələri üçün qabıq (landing, login, register, 404)
const PublicLayout = () => (
    <>
        <Navbar />
        <main className="min-h-[calc(100vh-4rem)] bg-canvas">
            <Outlet />
        </main>
    </>
);

export default PublicLayout;
