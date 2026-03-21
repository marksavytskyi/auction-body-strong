import axios from "axios";

const API_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.strongg.us";

const axiosInstance = axios.create({
    baseURL: API_URL,
    timeout: 10 * 60 * 1000,
    headers: {
        "Content-Type": "application/json",
    },
});

// 🔹 Request interceptor — добавляем Bearer token
axiosInstance.interceptors.request.use(
    (config) => {
        if (typeof window !== "undefined") {
            const token = localStorage.getItem("authToken");
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 🔹 Response interceptor — 401 = logout + redirect
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (
            error?.response?.status === 401 &&
            typeof window !== "undefined"
        ) {
            localStorage.removeItem("authToken");
            localStorage.removeItem("authTokenTimestamp");

            // редирект на логин
            window.location.href = "/login";
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;