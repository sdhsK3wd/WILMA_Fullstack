// src/App.tsx
import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import PageSpinner from "./components/PageSpinner"; // Stelle sicher, dass PageSpinner existiert und funktioniert
import { AppThemeProvider } from "./context/ThemeContext"; // Import Theme Provider

// Lazy Imports für die Routen
const SignIn = lazy(() => import("./components/SignIn"));
const ForgotPassword = lazy(() => import("./components/ForgotPassword"));
const Homepage = lazy(() => import("./components/Homepage"));
const Dashboard = lazy(() => import("./components/Dashboard"));
const CreateUser = lazy(() => import("./components/CreateUser"));
const UserList = lazy(() => import("./components/UserList"));
const Profile = lazy(() => import("./components/Profile"));
const Polls = lazy(() => import("./components/Polls"));
const ForecastStatus = lazy(() => import("./components/ForecastStatus"));
const Logs = lazy(() => import("./components/Logs"));
const Settings = lazy(() => import("./components/Settings"));

const App: React.FC = () => {
    return (
        <AppThemeProvider>
            {/* Toaster kann global hier bleiben */}
            <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
            <Routes>
                {/* Öffentliche Routen ohne Navbar (vermutlich) */}
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={ <Suspense fallback={<PageSpinner />}><SignIn /></Suspense> } />
                <Route path="/forgot-password" element={ <Suspense fallback={<PageSpinner />}><ForgotPassword /></Suspense> } />

                {/* Geschützte Routen, die wahrscheinlich die Navbar anzeigen sollen */}
                {/* Jede dieser Komponenten (Homepage, Dashboard, Profile, Settings, UserList, CreateUser, Polls, ForecastStatus, Logs) muss
                    die 'ProfileNavbar' Komponente importieren und rendern.
                */}
                <Route path="/home" element={ <Suspense fallback={<PageSpinner />}><Homepage /></Suspense> } />
                <Route path="/dashboard" element={ <Suspense fallback={<PageSpinner />}><Dashboard /></Suspense> } />
                <Route path="/forecast-status" element={ <Suspense fallback={<PageSpinner />}><ForecastStatus /></Suspense> } />
                <Route path="/create-user" element={ <Suspense fallback={<PageSpinner />}><CreateUser /></Suspense> } />
                <Route path="/user-list" element={ <Suspense fallback={<PageSpinner />}><UserList /></Suspense> } />
                <Route path="/profile" element={ <Suspense fallback={<PageSpinner />}><Profile /></Suspense> } />
                <Route path="/polls" element={ <Suspense fallback={<PageSpinner />}><Polls /></Suspense> } />
                <Route path="/logs" element={ <Suspense fallback={<PageSpinner />}><Logs /></Suspense> } />
                <Route path="/profile/settings" element={ <Suspense fallback={<PageSpinner />}><Settings /></Suspense> } />

                {/* Fallback-Route */}
                <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
        </AppThemeProvider>
    );
};

export default App;