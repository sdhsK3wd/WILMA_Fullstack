import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Layout from "./components/Layout"; // Wird für Seiten mit *alter* Navbar benötigt (falls noch vorhanden)
import PageSpinner from "./components/PageSpinner";

// Lazy-Loaded Seiten
const SignIn = lazy(() => import("./components/SignIn"));
const ForgotPassword = lazy(() => import("./components/ForgotPassword"));
const Homepage = lazy(() => import("./components/Homepage")); // Die neue Startseite
const Dashboard = lazy(() => import("./components/Dashboard")); // Forecast-Seite
const CreateUser = lazy(() => import("./components/CreateUser")); // Mit UserMgmtNavbar
const UserList = lazy(() => import("./components/UserList")); // Mit UserMgmtNavbar
const Profile = lazy(() => import("./components/Profile")); // Mit ProfileNavbar
// NEU: Polls importieren
const Polls = lazy(() => import("./components/Polls"));

const App: React.FC = () => {
    return (
        <>
            <Toaster position="top-center" toastOptions={{ duration: 3000 }} />

            <Routes>
                {/* --- Öffentliche Routen --- */}
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={ <Suspense fallback={<PageSpinner />}><SignIn /></Suspense> } />
                <Route path="/forgot-password" element={ <Suspense fallback={<PageSpinner />}><ForgotPassword /></Suspense> } />

                {/* --- Geschützte Routen --- */}
                {/* Homepage ohne spezifisches Layout (hat eigenen Header) */}
                <Route path="/home" element={ <Suspense fallback={<PageSpinner />}><Homepage /></Suspense> } />

                {/* Seiten mit ihren spezifischen Navbars (kein generisches Layout mehr nötig) */}
                <Route path="/dashboard" element={ <Suspense fallback={<PageSpinner />}><Dashboard /></Suspense> } />
                <Route path="/create-user" element={ <Suspense fallback={<PageSpinner />}><CreateUser /></Suspense> } />
                <Route path="/user-list" element={ <Suspense fallback={<PageSpinner />}><UserList /></Suspense> } />
                <Route path="/profile" element={ <Suspense fallback={<PageSpinner />}><Profile /></Suspense> } />

                {/* NEU: Route für Abstimmungen */}
                <Route path="/polls" element={ <Suspense fallback={<PageSpinner />}><Polls /></Suspense> } />

                {/* Optional: Routen für Kalender und Notifications hinzufügen */}
                {/*
                <Route path="/calendar" element={<Suspense fallback={<PageSpinner />}><CalendarPage /></Suspense>} />
                <Route path="/notifications" element={<Suspense fallback={<PageSpinner />}><NotificationsPage /></Suspense>} />
                */}

                {/* Fallback-Route */}
                <Route path="*" element={<Navigate to="/home" replace />} /> {/* Leitet zu Home um */}

            </Routes>
        </>
    );
};

export default App;