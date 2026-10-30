import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../features/auth/authSlice';
import { baseApi } from '../lib/baseApi';

const Navbar = () => {
    const dispatch = useDispatch();
    // Giriş statusu və istifadəçi məlumatları
    const isAuthenticated = useSelector((state) => !!state.auth?.token);
    const user = useSelector((state) => state.auth?.user);

    const handleLogout = () => {
        dispatch(logout());
        // Cache-i təmizləyirik ki, başqa istifadəçi girəndə köhnə data görünməsin
        dispatch(baseApi.util.resetApiState());
    };

    return (
        <nav className="flex items-center justify-between p-4 bg-gray-800 text-white">
            {/* Loqo / Brend adı */}
            <Link to="/" className="text-xl font-bold">
                Upra
            </Link>

            {/* Giriş vəziyyətinə görə dinamik linklər */}
            <div>
                {isAuthenticated ? (
                    <div className="flex items-center gap-4">
                        <span>Welcome, {user?.fullName || 'User'}</span>
                        <Link to="/dashboard" className="hover:text-gray-300">
                            Dashboard
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="bg-red-500 px-3 py-1 rounded hover:bg-red-600"
                        >
                            Logout
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-4">
                        <Link to="/login" className="hover:text-gray-300">
                            Login
                        </Link>
                        <Link to="/register" className="hover:text-gray-300">
                            Register
                        </Link>
                    </div>
                )}
            </div>
        </nav>
    );
};

export default Navbar;
