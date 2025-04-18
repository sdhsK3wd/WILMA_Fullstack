import React, { useState, useEffect } from "react";
import axios from "../api/axiosInstance";
import { useNavigate, Link, useLocation } from "react-router-dom";
import styles from "../styles/SignIn.module.css";
import logo from "../images/Logo.png";
import API_BASE_URL from "../apiConfig";
import type { AxiosError } from "axios";
import toast from "react-hot-toast";
import PasswordInput from "./PasswordInput";
import { ClipLoader } from "react-spinners";
import { useAuth } from "../context/AuthContext";

const SignIn: React.FC = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { login, isAuthenticated } = useAuth();

    useEffect(() => {
        if (isAuthenticated && location.pathname === "/login") {
            navigate("/dashboard", { replace: true });
        }
    }, [isAuthenticated, navigate, location.pathname]);

    const handleLogin = async () => {
        if (!email || !password) {
            toast.error("Bitte fülle alle Felder aus!");
            return;
        }

        setLoading(true);

        try {
            const response = await axios.post(`${API_BASE_URL}/users/login`, { email, password });

            const updatedUser = {
                id: response.data.id,
                username: response.data.username,
                email: response.data.email,
                role: response.data.role,
                phoneNumber: response.data.phoneNumber,
                location: response.data.location,
                profileImageUrl: response.data.profileImageUrl,
                token: response.data.token,
                refreshToken: response.data.refreshToken // ✅ NEU!
            };


            login(updatedUser); // ✅ Context login aufrufen
            toast.success("Login erfolgreich!");
            navigate("/dashboard", { replace: true });

        } catch (error) {
            const err = error as AxiosError<{ message?: string }>;
            toast.error(err.response?.data?.message || "Login fehlgeschlagen");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.signInCard}>
                <div className={styles.sidebar}>
                    <img src={logo} alt="Logo" className={styles.logo} />
                </div>
                <div className={styles.mainContent}>
                    <h2>Sign In</h2>

                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <PasswordInput
                        value={password}
                        onChange={setPassword}
                        placeholder="Passwort"
                        showStrength={true}
                    />

                    <button onClick={handleLogin} disabled={loading}>
                        {loading ? <ClipLoader size={18} color="#fff" /> : "Login"}
                    </button>

                    <Link to="/forgot-password" className={styles.forgotPassword}>
                        Forgot Password?
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default SignIn;
