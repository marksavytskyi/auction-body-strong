'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';

// Fallback only — used if a token can't be decoded for some reason.
// Verified live against production: real backend JWTs are valid for ~7
// days, not 1 hour. Prefer the token's own `exp` claim (see decodeToken)
// over this constant so the frontend never logs a user out while their
// token is still genuinely valid.
const FALLBACK_TOKEN_EXPIRATION_TIME = 60 * 60 * 1000;

const decodeToken = (t) => {
    try {
        if (!t) return null;
        const payload = t.split('.')[1];
        if (!payload) return null;
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(base64));
    } catch (e) {
        console.error('Failed to decode JWT', e);
        return null;
    }
};

export const useAuth = () => {
    const [token, setToken] = useState(null);
    const [expiresAt, setExpiresAt] = useState(0);
    const [email, setEmail] = useState(null);
    const [ready, setReady] = useState(false);

    const computeExpiry = (t, fallbackTimestamp) => {
        const decoded = decodeToken(t);
        if (decoded?.exp) return decoded.exp * 1000;
        return fallbackTimestamp + FALLBACK_TOKEN_EXPIRATION_TIME;
    };

    // Читаем токен только в браузере, затем помечаем ready
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const t = window.localStorage.getItem('authToken');
        const ts = Number(window.localStorage.getItem('authTokenTimestamp')) || 0;
        setToken(t);
        setExpiresAt(t ? computeExpiry(t, ts) : 0);
        setEmail(decodeToken(t)?.sub || decodeToken(t)?.email || null);
        setReady(true);
    }, []);

    const isTokenExpired = useMemo(() => {
        if (!expiresAt) return false;
        return expiresAt < Date.now();
    }, [expiresAt]);

    const isLoggedIn = useMemo(
        () => Boolean(token) && !isTokenExpired,
        [token, isTokenExpired]
    );

    const saveToken = (newToken) => {
        if (typeof window === 'undefined') return;
        const now = Date.now();
        window.localStorage.setItem('authToken', newToken);
        window.localStorage.setItem('authTokenTimestamp', String(now));
        setToken(newToken);
        setExpiresAt(computeExpiry(newToken, now));
        const decoded = decodeToken(newToken);
        setEmail(decoded?.sub || decoded?.email || null);
        setReady(true);
    };

    const logout = useCallback(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.removeItem('authToken');
        window.localStorage.removeItem('authTokenTimestamp');
        window.localStorage.removeItem('dashboard:active-job-id');
        setToken(null);
        setExpiresAt(0);
        setEmail(null);
        setReady(true);
    }, []);

    // Авто-логаут по истечению токена после загрузки
    useEffect(() => {
        if (ready && isTokenExpired) logout();
    }, [ready, isTokenExpired, logout]);

    return { ready, isLoggedIn, token, email, saveToken, logout };
};
