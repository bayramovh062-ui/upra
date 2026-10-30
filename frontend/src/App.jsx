import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Guard-lar və qabıqlar
import SessionGate from './components/SessionGate';
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';
import PublicLayout from './components/layout/PublicLayout';
import AppLayout from './components/layout/AppLayout';

// Səhifələr
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';
import DashboardPage from './pages/DashboardPage';
import DashboardRedirect from './pages/DashboardRedirect';
import ComingSoonPage from './pages/ComingSoonPage';

function App() {
    return (
        <BrowserRouter>
            <Toaster position="top-right" reverseOrder={false} />

            {/* Səhifə yenilənəndə token getMe ilə yoxlanılır */}
            <SessionGate>
                <Routes>
                    {/* Qonaq səhifələri: yuxarıda Navbar */}
                    <Route element={<PublicLayout />}>
                        <Route path="/" element={<HomePage />} />

                        <Route element={<GuestRoute />}>
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/register" element={<RegisterPage />} />
                        </Route>

                        <Route path="*" element={<NotFoundPage />} />
                    </Route>

                    {/* Giriş edənlər: sidebar + topbar */}
                    <Route element={<ProtectedRoute />}>
                        <Route element={<AppLayout />}>
                            <Route path="/dashboard" element={<DashboardRedirect />} />
                            <Route path="/contracts" element={<ComingSoonPage title="Contracts" />} />
                            <Route path="/settings" element={<ComingSoonPage title="Settings" />} />
                            {/* /jobs hələlik burada. Faza 2-də public olub-olmaması qərara alınacaq */}
                            <Route path="/jobs" element={<ComingSoonPage title="Find work" />} />

                            {/* Yalnız CLIENT */}
                            <Route element={<ProtectedRoute allowedRoles={['CLIENT']} />}>
                                <Route path="/client/dashboard" element={<DashboardPage />} />
                                <Route path="/client/jobs" element={<ComingSoonPage title="My jobs" />} />
                                <Route path="/client/jobs/new" element={<ComingSoonPage title="Post a job" />} />
                            </Route>

                            {/* Yalnız FREELANCER */}
                            <Route element={<ProtectedRoute allowedRoles={['FREELANCER']} />}>
                                <Route path="/freelancer/dashboard" element={<DashboardPage />} />
                                <Route
                                    path="/freelancer/proposals"
                                    element={<ComingSoonPage title="My proposals" />}
                                />
                            </Route>
                        </Route>
                    </Route>
                </Routes>
            </SessionGate>
        </BrowserRouter>
    );
}

export default App;
