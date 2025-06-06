// src/api/forecastApi.ts
import axios from 'axios';
import toast from 'react-hot-toast'; // Optional für Fehlermeldungen spezifisch für diese Instanz

// StoredUser Interface, falls Token auch hier benötigt wird
interface StoredUser {
    token?: string;
}

const forecastInstance = axios.create({
    baseURL: 'http://localhost:8000/api' // Für Ihren Python/FastAPI KI-Server
    // Das /api hier ist wichtig, da Ihre FastAPI-Routen so beginnen
});

// Optional: Request Interceptor für den KI-Server, falls dieser auch einen Token erwartet
// Dies könnte derselbe Token sein oder ein anderer, je nach Ihrer Architektur.
// Wenn der KI-Server keine Authentifizierung benötigt, können Sie diesen Interceptor weglassen.
forecastInstance.interceptors.request.use(
    (config) => {
        const userString = localStorage.getItem("user"); // Annahme: derselbe User-Speicherort
        const user: StoredUser = userString ? JSON.parse(userString) : {};

        if (user?.token) { // Annahme: derselbe Token wird verwendet
            config.headers.Authorization = `Bearer ${user.token}`;
        }
        return config;
    },
    (error) => {
        console.error('Axios Request Interceptor Error (forecastApi):', error);
        return Promise.reject(error);
    }
);

// Optional: Einfacher Response Interceptor für generische Fehlerbehandlung
forecastInstance.interceptors.response.use(
    response => response,
    error => {
        if (error.response) {
            console.error(`Axios Response Error (forecastApi): Status ${error.response.status}`, error.response.data);
            // Spezifische Fehlermeldung für den Benutzer, falls gewünscht
            // toast.error(error.response.data.detail || `KI-Server Fehler: ${error.response.status}`);
        } else if (error.request) {
            console.error('Axios Request Error (forecastApi): No response received', error.request);
            toast.error('KI-Server nicht erreichbar oder Netzwerkfehler.');
        } else {
            console.error('Axios Setup Error (forecastApi):', error.message);
        }
        return Promise.reject(error);
    }
);

export default forecastInstance;