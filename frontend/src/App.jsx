import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Komponentlər
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';

// Səhifələr
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  return (
    <BrowserRouter>
      {/* Navbar bütün səhifələrdə görünəcək */}
      <Navbar />

      {/* Bildirişlər (Toast) üçün qlobal komponent */}
      <Toaster position="top-right" reverseOrder={false} />

      <main className="min-h-screen bg-gray-50">
        <Routes>
          {/* Hər kəsə açıq olan marşrutlar */}
          <Route path="/" element={<HomePage />} />

          {/* Yalnız giriş etməyənlər üçün */}
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* Qorunan marşrutlar (Yalnız giriş edənlər üçün) */}
          <Route element={<ProtectedRoute />}>
            {/* <Route path="/dashboard" element={<DashboardPage />} /> */}
          </Route>

          {/* 404 Not Found marşrutu */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;
