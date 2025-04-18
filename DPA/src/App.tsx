import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Layout from "./components/Layout";
import PageSpinner from "./components/PageSpinner";

// Lazy-Loaded Seiten
const SignIn = lazy(() => import("./components/SignIn"));
const ForgotPassword = lazy(() => import("./components/ForgotPassword"));
const Dashboard = lazy(() => import("./components/Dashboard"));
const CreateUser = lazy(() => import("./components/CreateUser"));
const UserList = lazy(() => import("./components/UserList"));
const Profile = lazy(() => import("./components/Profile"));

const App: React.FC = () => {
    return (
        <>
            <Toaster position="top-center" toastOptions={{ duration: 3000 }} />

            <Routes>
                <Route path="/" element={<Navigate to="/login" />} />
                <Route path="/login" element={
                    <Suspense fallback={<PageSpinner />}>
                        <SignIn />
                    </Suspense>
                } />
                <Route path="/forgot-password" element={
                    <Suspense fallback={<PageSpinner />}>
                        <ForgotPassword />
                    </Suspense>
                } />

                {/* 🔐 Geschützte Seiten mit Layout */}
                <Route path="/dashboard" element={
                    <Layout>
                        <Suspense fallback={<PageSpinner />}>
                            <Dashboard />
                        </Suspense>
                    </Layout>
                } />
                <Route path="/create-user" element={
                    <Layout>
                        <Suspense fallback={<PageSpinner />}>
                            <CreateUser />
                        </Suspense>
                    </Layout>
                } />
                <Route path="/user-list" element={
                    <Layout>
                        <Suspense fallback={<PageSpinner />}>
                            <UserList />
                        </Suspense>
                    </Layout>
                } />
                <Route path="/profile" element={
                    <Layout>
                        <Suspense fallback={<PageSpinner />}>
                            <Profile />
                        </Suspense>
                    </Layout>
                } />
            </Routes>
        </>
    );
};

export default App;
