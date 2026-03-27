'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';

const TOKEN_EXPIRATION_TIME = 60 * 60 * 1000; // 1h — matches backend JWT TTL

export const useAuth = () => {
    const [token, setToken] = useState(null);
    const [timestamp, setTimestamp] = useState(0);
    const [email, setEmail] = useState(null);
    const [ready, setReady] = useState(false); // <-- добавили

    const parseEmail = (t) => {
        try {
            if (!t) return null;
            const payload = t.split('.')[1];
            if (!payload) return null;
            const decoded = JSON.parse(atob(payload));
            return decoded.sub || decoded.email || null;
        } catch (e) {
            console.error('Failed to parse JWT email', e);
            return null;
        }
    };

    // Читаем токен только в браузере, затем помечаем ready
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const t  = window.localStorage.getItem('authToken');
        const ts = Number(window.localStorage.getItem('authTokenTimestamp')) || 0;
        setToken(t);
        setTimestamp(ts);
        setEmail(parseEmail(t));
        setReady(true); // <-- теперь можно принимать решения
    }, []);

    const isTokenExpired = useMemo(() => {
        if (!timestamp) return false;
        return timestamp + TOKEN_EXPIRATION_TIME < Date.now();
    }, [timestamp]);

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
        setTimestamp(now);
        setEmail(parseEmail(newToken));
        setReady(true);
    };

    const logout = useCallback(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.removeItem('authToken');
        window.localStorage.removeItem('authTokenTimestamp');
        window.localStorage.removeItem('dashboard:active-job-id');
        setToken(null);
        setTimestamp(0);
        setEmail(null);
        setReady(true);
    }, []);

    // Авто-логаут по истечению токена после загрузки
    useEffect(() => {
        if (ready && isTokenExpired) logout();
    }, [ready, isTokenExpired, logout]);

    return { ready, isLoggedIn, token, email, saveToken, logout };
};
