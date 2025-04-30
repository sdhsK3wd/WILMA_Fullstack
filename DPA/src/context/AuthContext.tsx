// src/context/authContext.tsx

import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../api/axiosInstance";

export interface User {
    id: number;
    username: string;
    email: string;
    role: string;
    token: string;
    phoneNumber?: string;
    location?: string;
    profileImageUrl?: string;
}

interface AuthContextProps {
    user: User | null;
    isAuthenticated: boolean;
    isAdmin: boolean;
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
            const parsed = JSON.parse(stored);
            setUser(parsed);
            axios.defaults.headers.common["Authorization"] = `Bearer ${parsed.token}`;
        }
    }, []);

    const login = (userData: User) => {
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
        axios.defaults.headers.common["Authorization"] = `Bearer ${userData.token}`;
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
    if (!context) throw new Error("useAuth muss innerhalb von <AuthProvider> verwendet werden");
    return context;
};
