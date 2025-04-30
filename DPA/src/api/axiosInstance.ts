import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
// Stelle sicher, dass die richtige Basis-URL hier steht oder importiert wird
// import API_BASE_URL from '../apiConfig'; // Alternative zum Hardcoden
import toast from 'react-hot-toast';

// Interface für das User-Objekt im localStorage (aus deinem Code übernommen)
interface StoredUser {
    token?: string; // Der Access Token
    refreshToken?: string;
    // ... andere User-Daten ...
}

// Erstelle die Axios-Instanz
const instance = axios.create({
    // ✅ WICHTIG: Setze hier die korrekte URL deines ASP.NET Core Backends ein!
    baseURL: "http://localhost:5070", // Geändert von 8000 auf 5070
});

// ✅ Request Interceptor: Token anhängen (Logik beibehalten)
instance.interceptors.request.use(
    (config) => {
        const userString = localStorage.getItem("user");
        const user: StoredUser = userString ? JSON.parse(userString) : {};

        if (user?.token) {
            config.headers.Authorization = `Bearer ${user.token}`;
        }
        return config;
    },
    (error) => {
        console.error('Axios Request Interceptor Error:', error);
        return Promise.reject(error);
    }
);

// ✅ Response Interceptor: Refresh bei 401 (Logik beibehalten, aber Endpunkt/Payload prüfen!)
instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Prüfe auf 401 und _retry Flag
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
            console.warn("Axios Interceptor: 401 Unauthorized erkannt. Versuche Token-Refresh.");
            originalRequest._retry = true;

            try {
                const userString = localStorage.getItem("user");
                const user: StoredUser = userString ? JSON.parse(userString) : {};

                if (!user?.refreshToken) {
                    console.error("Refresh Error: Kein Refresh Token im localStorage gefunden.");
                    throw new Error("Kein Refresh Token gefunden.");
                }

                // --- ⚠️ ACHTUNG: Diese Refresh-Logik muss evtl. an dein ASP.NET Core Backend angepasst werden! ---
                // 1. Ist der Endpunkt korrekt? '/api/Auth/refresh' ist nur ein BEISPIEL!
                const refreshEndpoint = '/api/Auth/refresh'; // Beispiel! Ändere dies ggf.!

                // 2. Welches Payload erwartet dein ASP.NET Core Backend?
                const refreshPayload = {
                    // token: user.token, // Braucht das Backend den alten Access Token?
                    refreshToken: user.refreshToken
                };

                console.log(`Versuche Refresh an: ${instance.defaults.baseURL}${refreshEndpoint}`);
                // Verwende eine NEUE axios Instanz oder axios direkt, um Interceptor-Schleifen zu vermeiden
                const refreshResponse = await axios.post(`${instance.defaults.baseURL}${refreshEndpoint}`, refreshPayload);

                // 3. Wie sieht die Antwort vom ASP.NET Core Backend aus?
                // Annahme hier: { token: "...", refreshToken: "..." } - Passe dies an!
                const newAccessToken = refreshResponse.data.token; // Beispiel! Ändere dies!
                const newRefreshToken = refreshResponse.data.refreshToken; // Beispiel! Ändere dies!

                if (!newAccessToken) {
                    console.error("Refresh Error: Kein neuer Access Token in der Antwort vom Backend.");
                    throw new Error("Ungültige Refresh-Antwort vom Server.");
                }

                const updatedUser: StoredUser = {
                    ...user,
                    token: newAccessToken,
                    refreshToken: newRefreshToken ?? user.refreshToken // Aktualisiere Refresh Token, falls neu
                };

                localStorage.setItem("user", JSON.stringify(updatedUser));
                console.log("Token erfolgreich aktualisiert (laut Refresh-Logik).");

                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                console.log("Wiederhole ursprüngliche Anfrage:", originalRequest.url);
                return instance(originalRequest); // Verwende die ursprüngliche Instanz
                // --- Ende ACHTUNG ---

            } catch (refreshError: any) {
                console.error("❌ Token Refresh fehlgeschlagen:", refreshError?.response?.data || refreshError?.message || refreshError);
                toast.error("Sitzung abgelaufen.");
                localStorage.removeItem("user");
                setTimeout(() => { window.location.href = "/login"; }, 1500);
                return Promise.reject(refreshError);
            }
        }

        // Andere Fehler weitergeben
        if (error.response) {
            console.error(`Axios Response Error: Status ${error.response.status}`, error.response.data);
        } else if (error.request) {
            console.error('Axios Request Error: No response received', error.request);
            toast.error('Netzwerkfehler oder Server nicht erreichbar.');
        } else {
            console.error('Axios Setup Error:', error.message);
        }
        return Promise.reject(error);
    }
);

export default instance;
