import axios from "axios";

const instance = axios.create({
    baseURL: "http://127.0.0.1:8000",  // ✅ Direkt auf dein FastAPI Backend zeigen!
});

// ✅ Request Interceptor: Token anhängen
instance.interceptors.request.use(
    config => {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        if (user?.token) {
            config.headers.Authorization = `Bearer ${user.token}`;
        }
        return config;
    },
    error => {
        return Promise.reject(error);
    }
);

// ✅ Response Interceptor: Refresh bei 401
instance.interceptors.response.use(
    response => response,
    async error => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const user = JSON.parse(localStorage.getItem("user") || "{}");
                if (!user?.refreshToken) throw new Error("Kein Refresh Token gefunden.");

                // Hier musst du auf den richtigen Endpunkt achten (optional!)
                const refreshResponse = await axios.post(`http://127.0.0.1:8000/api/users/refresh-token`, {
                    token: user.refreshToken
                });

                const updatedUser = {
                    ...user,
                    token: refreshResponse.data.token,
                    refreshToken: refreshResponse.data.refreshToken
                };

                localStorage.setItem("user", JSON.stringify(updatedUser));

                originalRequest.headers.Authorization = `Bearer ${updatedUser.token}`;
                return instance(originalRequest);

            } catch (refreshError) {
                console.error("❌ Refresh fehlgeschlagen", refreshError);
                localStorage.removeItem("user");
                window.location.href = "/login";
            }
        }

        return Promise.reject(error);
    }
);

export default instance;
