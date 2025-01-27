import { useMemo } from 'react';

// Token expiration duration (e.g., 1 hour in milliseconds)
const TOKEN_EXPIRATION_TIME = (60 * 60 * 1000) * 3; // 3 hours

export const useAuth = () => {
    // Get token and its timestamp from localStorage
    const tokenData = useMemo(() => {
        const token = localStorage.getItem('authToken');
        const timestamp = localStorage.getItem('authTokenTimestamp');
        return { token, timestamp: Number(timestamp) || 0 };
    }, []);

    // Check if the token is expired
    const isTokenExpired = useMemo(() => {
        const now = Date.now();
        return tokenData.timestamp + TOKEN_EXPIRATION_TIME < now;
    }, [tokenData]);

    // Check if the user is logged in (valid token and not expired)
    const isLoggedIn = useMemo(() => !!tokenData.token && !isTokenExpired, [tokenData, isTokenExpired]);

    // Set token and save its timestamp
    const setToken = (newToken) => {
        const now = Date.now();
        localStorage.setItem('authToken', newToken);
        localStorage.setItem('authTokenTimestamp', now.toString());
    };

    // Remove the token and timestamp to log out
    const logout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('authTokenTimestamp');
    };

    // Clear token if expired
    if (isTokenExpired) {
        logout();
    }

    return { isLoggedIn, setToken, token: tokenData.token, logout };
};
