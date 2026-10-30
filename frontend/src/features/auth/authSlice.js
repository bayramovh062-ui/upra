import { createSlice } from '@reduxjs/toolkit';

const loadStoredUser = () => {
    try {
        const stored = localStorage.getItem('user');
        return stored ? JSON.parse(stored) : null;
    } catch {
        // Yaddaşdakı dəyər korlanıbsa, istifadəçini boş sayırıq
        return null;
    }
};

const token = localStorage.getItem('token') || null;
const user = loadStoredUser();

const authSlice = createSlice({
    name: 'auth',
    initialState: {
        token,
        user,
        isAuthenticated: !!token,
    },
    reducers: {
        setCredentials: (state, action) => {
            const { token, user } = action.payload;
            state.token = token;
            state.user = user;
            state.isAuthenticated = true;
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
        },
        logout: (state) => {
            state.token = null;
            state.user = null;
            state.isAuthenticated = false;
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        },
    },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;