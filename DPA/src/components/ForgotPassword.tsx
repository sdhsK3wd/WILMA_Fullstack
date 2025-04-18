import React, { useState, useEffect } from "react";
import axios from "../api/axiosInstance";
import { useNavigate, useSearchParams } from "react-router-dom";
import styles from "../styles/ForgotPassword.module.css";
import API_BASE_URL from "../apiConfig";
import type { AxiosError } from "axios";
import PasswordInputWithConfirm from "./PasswordInputWithConfirm";
import toast from "react-hot-toast";
import { ClipLoader } from "react-spinners";

const ForgotPassword: React.FC = () => {
    const [email, setEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const tokenFromURL = searchParams.get("token");
        if (tokenFromURL) {
            setToken(tokenFromURL.trim());
            setStep(2);
        }
    }, [searchParams]);

    const handleEmailSubmit = async () => {
        if (!email) {
            toast.error("Bitte gib deine E-Mail-Adresse ein.");
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/users/forgot-password`, { email });
            toast.success(response.data.message || "E-Mail zum Zurücksetzen wurde gesendet.");
        } catch (error) {
            const err = error as AxiosError<{ message?: string }>;
            toast.error(err.response?.data?.message || "Fehler beim Senden der E-Mail.");
        }
        setLoading(false);
    };

    const handleResetPassword = async () => {
        if (!token) {
            toast.error("Kein Token gefunden.");
            return;
        }

        if (!newPassword || !confirmPassword) {
            toast.error("Bitte alle Felder ausfüllen.");
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error("Passwörter stimmen nicht überein.");
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/users/reset-password`, {
                token,
                newPassword
            });

            toast.success(response.data.message || "Passwort erfolgreich geändert.");
            setTimeout(() => navigate("/login"), 2500);
        } catch (error) {
            const err = error as AxiosError<{ message?: string }>;
            toast.error(err.response?.data?.message || "Fehler beim Zurücksetzen.");
        }
        setLoading(false);
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h2>Passwort zurücksetzen</h2>

                {step === 1 ? (
                    <>
                        <input
                            type="email"
                            placeholder="Deine E-Mail"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <button onClick={handleEmailSubmit} disabled={loading}>
                            {loading ? <ClipLoader size={18} color="#fff"/> : "Reset-Link senden"}
                        </button>

                    </>
                ) : (
                    <>
                        <PasswordInputWithConfirm
                            password={newPassword}
                            confirmPassword={confirmPassword}
                            onPasswordChange={setNewPassword}
                            onConfirmChange={setConfirmPassword}
                        />

                        <button onClick={handleResetPassword} disabled={loading}>
                            {loading ? <ClipLoader size={18} color="#fff"/> : "Passwort setzen"}
                        </button>

                    </>
                )}
            </div>
        </div>
    );
};

export default ForgotPassword;
