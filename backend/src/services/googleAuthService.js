import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError.js';

// Google ilə giriş: frontend Google Identity Services-dən ID token (JWT) alır, backend onu yoxlayır.
// Əlavə paket lazım deyil: imza Google-un açıq açarları (JWKS) ilə mövcud jsonwebtoken kitabxanası vasitəsilə yoxlanılır.

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const FETCH_TIMEOUT_MS = 5000;
const DEFAULT_KEY_TTL_MS = 60 * 60 * 1000;

let keyCache = { keys: new Map(), expiresAt: 0 };

export const isGoogleLoginConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID?.trim());

const refreshKeys = async () => {
    let response;
    try {
        response = await fetch(JWKS_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    } catch {
        throw new AppError('Could not reach Google to verify the sign-in. Please try again.', 502);
    }
    if (!response.ok) {
        throw new AppError('Could not reach Google to verify the sign-in. Please try again.', 502);
    }

    const { keys } = await response.json();
    const maxAge = /max-age=(\d+)/.exec(response.headers.get('cache-control') || '')?.[1];
    keyCache = {
        keys: new Map((keys || []).map((jwk) => [jwk.kid, jwk])),
        expiresAt: Date.now() + (maxAge ? Number(maxAge) * 1000 : DEFAULT_KEY_TTL_MS),
    };
};

const getKey = async (kid) => {
    if (Date.now() >= keyCache.expiresAt || !keyCache.keys.has(kid)) {
        await refreshKeys();
    }
    const jwk = keyCache.keys.get(kid);
    if (!jwk) return null;
    return crypto.createPublicKey({ key: jwk, format: 'jwk' });
};

const invalidToken = () => new AppError('Invalid Google sign-in. Please try again.', 401);

// ID token-i yoxlayır (imza, buraxan, auditoriya, müddət) və lazımi sahələri qaytarır.
export const verifyGoogleIdToken = async (idToken) => {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
        throw new AppError('Google sign-in is not configured on the server.', 503);
    }

    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded?.header?.kid) throw invalidToken();

    const key = await getKey(decoded.header.kid);
    if (!key) throw invalidToken();

    let payload;
    try {
        payload = jwt.verify(idToken, key, {
            algorithms: ['RS256'],
            audience: clientId,
            issuer: ISSUERS,
        });
    } catch {
        throw invalidToken();
    }

    if (!payload.sub || !payload.email) throw invalidToken();

    return {
        sub: String(payload.sub),
        email: String(payload.email).trim().toLowerCase(),
        // Google bu sahəni bəzən sətir ("true") kimi göndərir
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
        name: typeof payload.name === 'string' ? payload.name.trim() : '',
    };
};
