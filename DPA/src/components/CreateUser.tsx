import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/CreateUser.module.css";
import API_BASE_URL from "../apiConfig";
import Navbar from "./Navbar";
import axios from "../api/axiosInstance";
import type { AxiosError } from "axios";
import PasswordInput from "./PasswordInput";
import toast from "react-hot-toast";
import { ClipLoader } from "react-spinners";

const CreateUser: React.FC = () => {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("User");
    const [adminEmail, setAdminEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setAdminEmail(parsedUser.email);
        } else {
            navigate("/login");
        }
    }, [navigate]);

    const handleCreateUser = async () => {
        if (!username || !email || !password || !role || !adminEmail) {
            toast.error("Bitte alle Felder ausfüllen!");
            return;
        }

        const storedUser = localStorage.getItem("user");
        const loggedInUser = storedUser ? JSON.parse(storedUser) : null;

        if (!loggedInUser || loggedInUser.role !== "Admin") {
            toast.error("Nur Admins können Benutzer erstellen!");
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/users/register`, {
                username,
                email,
                password,
                role,
                adminEmail
            });

            toast.success(response.data.message || "Benutzer erfolgreich erstellt!");

            setUsername("");
            setEmail("");
            setPassword("");
            setRole("User");
        } catch (err) {
            const error = err as AxiosError<{ message?: string }>;
            toast.error(error.response?.data?.message || "Fehler beim Erstellen des Benutzers");

            if (import.meta.env.DEV) {
                console.warn("Fehler beim Benutzer erstellen:", error);
            }
        }
        setLoading(false);
    };

    return (
        <div className={styles.dashboardContainer}>
            <Navbar />
            <main className={styles.mainContent}>
                <div className={styles.formCard}>
                    <h2>Neuen Benutzer erstellen</h2>

                    <div className={styles.inputGroup}>
                        <label>Admin-E-Mail (zur Bestätigung):</label>
                        <input
                            type="email"
                            value={adminEmail}
                            onChange={(e) => setAdminEmail(e.target.value)}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Benutzername:</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>E-Mail:</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Passwort:</label>
                        <PasswordInput
                            value={password}
                            onChange={setPassword}
                            placeholder="Passwort"
                            showStrength={true}
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Rolle wählen:</label>
                        <select value={role} onChange={(e) => setRole(e.target.value)}>
                            <option value="User">User</option>
                            <option value="Admin">Admin</option>
                        </select>
                    </div>

                    <button onClick={handleCreateUser} disabled={loading}>
                        {loading ? <ClipLoader size={18} color="#fff" /> : "Benutzer erstellen"}
                    </button>
                </div>
            </main>
        </div>
    );
};

export default CreateUser;
