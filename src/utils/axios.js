import axios from 'axios';

// Create an Axios instance
const axiosInstance = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4000', // Use your API base URL
    timeout: 10000, // Optional timeout
});

// Interceptors for requests
axiosInstance.interceptors.request.use(
    (config) => {
        // Add authentication tokens or custom headers here if needed
        const token = localStorage.getItem('authToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptors for responses
axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle errors globally
        console.error(error);
        return Promise.reject(error);
    }
);

export default axiosInstance;
