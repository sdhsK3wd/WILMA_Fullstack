// src/api/coreApi.ts (oder axiosInstance.ts)
// Ihr existierender Code aus axiosInstance.ts, der auf Port 5070 zeigt
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

interface StoredUser {
    token?: string;
    refreshToken?: string;
}

const coreInstance = axios.create({
    baseURL: "http://localhost:5070", // Für Ihr ASP.NET Core Backend
});

// Request Interceptor (Token anhängen)
coreInstance.interceptors.request.use(
    (config) => {
        const userString = localStorage.getItem("user");
        const user: StoredUser = userString ? JSON.parse(userString) : {};
        if (user?.token) {
            config.headers.Authorization = `Bearer ${user.token}`;
        }
        return config;
    },
    (error) => {
        console.error('Axios Request Interceptor Error (coreApi):', error);
        return Promise.reject(error);
    }
);

// Response Interceptor (Token-Refresh-Logik)
coreInstance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
            console.warn("Axios Interceptor (coreApi): 401 Unauthorized. Attempting token refresh.");
            originalRequest._retry = true;
            try {
                const userString = localStorage.getItem("user");
                const user: StoredUser = userString ? JSON.parse(userString) : {};
                if (!user?.refreshToken) {
                    throw new Error("No refresh token found.");
                }

                // Anpassen an Ihren Auth-Endpunkt und Payload
                // Korrigiert: Endpunkt ist /api/users/refresh-token
                const refreshEndpoint = '/api/users/refresh-token';
                // Korrigiert: Payload-Key muss 'Token' sein, wie vom C# Backend erwartet
                const refreshPayload = { Token: user.refreshToken };

                const refreshResponse = await axios.post(`${coreInstance.defaults.baseURL}${refreshEndpoint}`, refreshPayload);
                const newAccessToken = refreshResponse.data.token;
                const newRefreshToken = refreshResponse.data.refreshToken;

                if (!newAccessToken) {
                    throw new Error("Invalid refresh response from server.");
                }
                const updatedUser: StoredUser = { ...user, token: newAccessToken, refreshToken: newRefreshToken ?? user.refreshToken };
                localStorage.setItem("user", JSON.stringify(updatedUser));
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return coreInstance(originalRequest);
            } catch (refreshError: any) {
                console.error("❌ Token Refresh failed (coreApi):", refreshError?.response?.data || refreshError?.message || refreshError);
                toast.error("Session expired."); // Der Text kann auch übersetzt werden, falls gewünscht
                localStorage.removeItem("user");
                setTimeout(() => { window.location.href = "/login"; }, 1500);
                return Promise.reject(refreshError);
            }
        }
        if (error.response) {
            console.error(`Axios Response Error (coreApi): Status ${error.response.status}`, error.response.data);
        } else if (error.request) {
            console.error('Axios Request Error (coreApi): No response received', error.request);
            toast.error('Network error or server unreachable.'); // Auch dieser Text kann übersetzt werden
        } else {
            console.error('Axios Setup Error (coreApi):', error.message);
        }
        return Promise.reject(error);
    }
);

export default coreInstance;