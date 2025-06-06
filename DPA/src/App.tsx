// src/App.tsx
import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
// import PageSpinner from "./components/PageSpinner"; // Diese Zeile wird entfernt

// Importiere CircularProgress und Box von Material-UI für den Fallback
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

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
    // Der Fallback für Suspense wird nun eine Material-UI Komponente sein.
    const suspenseFallback = (
        <Box sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            bgcolor: 'background.default' // Nutzt den Theme-Hintergrund
        }}>
            <CircularProgress />
        </Box>
    );

    return (
        <AppThemeProvider>
            {/* Toaster kann global hier bleiben */}
            <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
            <Routes>
                {/* Öffentliche Routen ohne Navbar (vermutlich) */}
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={ <Suspense fallback={suspenseFallback}><SignIn /></Suspense> } />
                <Route path="/forgot-password" element={ <Suspense fallback={suspenseFallback}><ForgotPassword /></Suspense> } />

                {/* Geschützte Routen, die wahrscheinlich die Navbar anzeigen sollen */}
                {/* Jede dieser Komponenten (Homepage, Dashboard, Profile, Settings, UserList, CreateUser, Polls, ForecastStatus, Logs) muss
                    die 'ProfileNavbar' Komponente importieren und rendern.
                */}
                <Route path="/home" element={ <Suspense fallback={suspenseFallback}><Homepage /></Suspense> } />
                <Route path="/dashboard" element={ <Suspense fallback={suspenseFallback}><Dashboard /></Suspense> } />
                <Route path="/forecast-status" element={ <Suspense fallback={suspenseFallback}><ForecastStatus /></Suspense> } />
                <Route path="/create-user" element={ <Suspense fallback={suspenseFallback}><CreateUser /></Suspense> } />
                <Route path="/user-list" element={ <Suspense fallback={suspenseFallback}><UserList /></Suspense> } />
                <Route path="/profile" element={ <Suspense fallback={suspenseFallback}><Profile /></Suspense> } />
                <Route path="/polls" element={ <Suspense fallback={suspenseFallback}><Polls /></Suspense> } />
                <Route path="/logs" element={ <Suspense fallback={suspenseFallback}><Logs /></Suspense> } />
                <Route path="/profile/settings" element={ <Suspense fallback={suspenseFallback}><Settings /></Suspense> } />

                {/* Fallback-Route */}
                <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
        </AppThemeProvider>
    );
};

export default App;