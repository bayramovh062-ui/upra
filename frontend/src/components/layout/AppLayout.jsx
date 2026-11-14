import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import useNotificationSocket from '../../features/notifications/useNotificationSocket';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import EmailVerificationBanner from '../EmailVerificationBanner';
import AssistantButton from '../../features/ai/AssistantButton';

// Giriş etmiş istifadəçilər üçün qabıq: sabit üst panel + sidebar + səhifə məzmunu
const AppLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Şəxsi soket: giriş etmiş istifadəçi üçün yeni bildirişlər canlı gəlir (AppLayout yalnız giriş etmişlərdə var)
    useNotificationSocket();

    return (
        <div className="min-h-dvh bg-background">
            <Topbar onMenuClick={() => setSidebarOpen(true)} />
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="pt-16 lg:pl-64">
                {/* Telefonda pb-20: sağ aşağıdakı üzən AI düyməsi səhifənin son düymələrini (məs. Pagination, Submit) örtməsin */}
                <main className="mx-auto w-full max-w-[1600px] p-4 pb-20 sm:p-6 lg:p-8">
                    <EmailVerificationBanner />
                    <Outlet />
                </main>
            </div>
            <AssistantButton />
        </div>
    );
};

export default AppLayout;
