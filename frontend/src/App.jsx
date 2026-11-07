import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Guard-lar və qabıqlar
import SessionGate from './components/SessionGate';
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';
import PublicLayout from './components/layout/PublicLayout';
import AuthLayout from './components/layout/AuthLayout';
import AppLayout from './components/layout/AppLayout';

// Səhifələr
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';
import DashboardPage from './pages/DashboardPage';
import DashboardRedirect from './pages/DashboardRedirect';
import SettingsPage from './pages/SettingsPage';
import JobsPage from './pages/JobsPage';
import JobDetailPage from './pages/JobDetailPage';
import MyJobsPage from './pages/MyJobsPage';
import CreateJobPage from './pages/CreateJobPage';
import EditJobPage from './pages/EditJobPage';
import JobProposalsPage from './pages/JobProposalsPage';
import MyProposalsPage from './pages/MyProposalsPage';
import ContractsPage from './pages/ContractsPage';
import ContractDetailPage from './pages/ContractDetailPage';
import UserProfilePage from './pages/UserProfilePage';
import NotificationsPage from './pages/NotificationsPage';
import MessagesPage from './pages/MessagesPage';

function App() {
    return (
        <BrowserRouter>
            <Toaster position="top-right" reverseOrder={false} />

            {/* Səhifə yenilənəndə token getMe ilə yoxlanılır */}
            <SessionGate>
                <Routes>
                    {/* Login və register: sol brend paneli, sağda forma (Stitch dizaynı). Navbar yoxdur. */}
                    <Route element={<GuestRoute />}>
                        <Route element={<AuthLayout />}>
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/register" element={<RegisterPage />} />
                        </Route>
                    </Route>

                    {/* Qonaq səhifələri: yuxarıda Navbar, aşağıda Footer */}
                    <Route element={<PublicLayout />}>
                        <Route path="/" element={<HomePage />} />
                        <Route path="*" element={<NotFoundPage />} />
                    </Route>

                    {/* Giriş edənlər: sidebar + topbar */}
                    <Route element={<ProtectedRoute />}>
                        <Route element={<AppLayout />}>
                            <Route path="/dashboard" element={<DashboardRedirect />} />
                            <Route path="/contracts" element={<ContractsPage />} />
                            <Route path="/contracts/:id" element={<ContractDetailPage />} />
                            <Route path="/settings" element={<SettingsPage />} />
                            <Route path="/notifications" element={<NotificationsPage />} />
                            <Route path="/messages" element={<MessagesPage />} />
                            <Route path="/messages/:conversationId" element={<MessagesPage />} />
                            {/* İctimai profil: görünürlük qaydalarını backend tətbiq edir */}
                            <Route path="/users/:id" element={<UserProfilePage />} />
                            {/* Elanlar giriş tələb edir (backend-də GET /jobs/:id protect-dir) */}
                            <Route path="/jobs" element={<JobsPage />} />
                            <Route path="/jobs/:id" element={<JobDetailPage />} />

                            {/* Yalnız CLIENT */}
                            <Route element={<ProtectedRoute allowedRoles={['CLIENT']} />}>
                                <Route path="/client/dashboard" element={<DashboardPage />} />
                                <Route path="/client/jobs" element={<MyJobsPage />} />
                                <Route path="/client/jobs/new" element={<CreateJobPage />} />
                                <Route path="/client/jobs/:id/edit" element={<EditJobPage />} />
                                <Route path="/client/jobs/:id/proposals" element={<JobProposalsPage />} />
                            </Route>

                            {/* Yalnız FREELANCER */}
                            <Route element={<ProtectedRoute allowedRoles={['FREELANCER']} />}>
                                <Route path="/freelancer/dashboard" element={<DashboardPage />} />
                                <Route path="/freelancer/proposals" element={<MyProposalsPage />} />
                            </Route>
                        </Route>
                    </Route>
                </Routes>
            </SessionGate>
        </BrowserRouter>
    );
}

export default App;
