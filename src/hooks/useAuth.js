'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';

const TOKEN_EXPIRATION_TIME = 3 * 60 * 60 * 1000; // 3h

export const useAuth = () => {
    const [token, setToken] = useState(null);
    const [timestamp, setTimestamp] = useState(0);
    const [ready, setReady] = useState(false); // <-- добавили

    // Читаем токен только в браузере, затем помечаем ready
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const t  = window.localStorage.getItem('authToken');
        const ts = Number(window.localStorage.getItem('authTokenTimestamp')) || 0;
        setToken(t);
        setTimestamp(ts);
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
        setReady(true);
    };

    const logout = useCallback(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.removeItem('authToken');
        window.localStorage.removeItem('authTokenTimestamp');
        setToken(null);
        setTimestamp(0);
        setReady(true);
    }, []);

    // Авто-логаут по истечению токена после загрузки
    useEffect(() => {
        if (ready && isTokenExpired) logout();
    }, [ready, isTokenExpired, logout]);

    return { ready, isLoggedIn, token, saveToken, logout };
};
