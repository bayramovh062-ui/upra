import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Komponentlər
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

// Səhifələr
import HomePage from './pages/HomePage';
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
          {/* <Route path="/login" element={<LoginPage />} /> */}

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