// src/context/authContext.tsx

import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../api/axiosInstance"; // Stelle sicher, dass dieser Pfad korrekt ist

export interface User {
    id: number;
    username: string;
    email: string;
    role: string;
    token: string; // Token ist bereits Teil des User-Objekts, das ist gut!
    phoneNumber?: string;
    location?: string;
    profileImageUrl?: string;
}

interface AuthContextProps {
    user: User | null;
    isAuthenticated: boolean;
    isAdmin: boolean;
    token: string | null; // <-- HINZUGEFÜGT: Token direkt verfügbar machen
    login: (user: User) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const stored = localStorage.getItem("user");
        if (stored) {
            try {
                const parsedUser = JSON.parse(stored) as User; // Typzusicherung
                setUser(parsedUser);
                // Stelle sicher, dass 'token' im geparsten Objekt vorhanden ist
                if (parsedUser && parsedUser.token) {
                    axios.defaults.headers.common["Authorization"] = `Bearer ${parsedUser.token}`;
                } else {
                    // Fall behandeln, falls Token fehlt, ggf. ausloggen
                    console.warn("Stored user data is missing token. Logging out.");
                    localStorage.removeItem("user");
                    // navigate("/login"); // Optional: direkt ausloggen
                }
            } catch (error) {
                console.error("Failed to parse stored user data:", error);
                localStorage.removeItem("user"); // Fehlerhaftes Item entfernen
            }
        }
    }, []);

    const login = (userData: User) => {
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
        // Stelle sicher, dass userData.token existiert, bevor du es verwendest
        if (userData && userData.token) {
            axios.defaults.headers.common["Authorization"] = `Bearer ${userData.token}`;
        } else {
            console.error("Login attempt with user data missing token.");
            // Hier könntest du einen Fehler werfen oder den Login abbrechen
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem("user");
        delete axios.defaults.headers.common["Authorization"];
        navigate("/login");
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                isAdmin: user?.role === "Admin",
                token: user ? user.token : null, // <-- HINZUGEFÜGT: Token-Wert bereitstellen
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth muss innerhalb von <AuthProvider> verwendet werden");
    }
    return context;
};