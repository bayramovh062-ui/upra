import jwt from 'jsonwebtoken';

// `ver` = User.tokenVersion. Parol sıfırlananda artırılır, köhnə tokenlər (ver uyğun gəlmir) etibarsız olur.
export const generateToken = (userId, role, tokenVersion = 0) => {
    return jwt.sign({ id: userId, role, ver: tokenVersion }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
};
