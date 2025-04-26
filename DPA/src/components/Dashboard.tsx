import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/Dashboard.module.css";
import Navbar from "./Navbar";
import OnlineUserCount from "./OnlineUserCount";
import axios from "axios";
import toast from "react-hot-toast";

const Dashboard: React.FC = () => {
    const [userRole, setUserRole] = useState("");
    const [userName, setUserName] = useState("");
    const [forecastData, setForecastData] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const storedUser = localStorage.getItem("user");

        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUserRole(parsedUser.role);
            setUserName(parsedUser.username);
        } else {
            console.log("🚨 Kein Benutzer gefunden, umleiten...");
            navigate("/login", { replace: true });
        }
    }, []);

    const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await axios.post("http://127.0.0.1:8000/upload_csv/", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            console.log("Vorhersage erhalten:", response.data);
            toast.success("CSV erfolgreich hochgeladen und Vorhersage erhalten!");
            setForecastData(response.data);
        } catch (err) {
            console.error("Fehler beim Upload:", err);
            toast.error("Upload fehlgeschlagen.");
        }
    };

    return (
        <div className={styles.dashboardContainer}>
            <Navbar />
            <main className={styles.mainContent}>
                <div className={styles.userCard}>
                    <h2>{userName} <span className={styles.role}>({userRole})</span></h2>
                    <p className={styles.onlineStatus}>Online-Benutzer: <strong>1</strong></p>
                </div>

                {userRole === "Admin" && (
                    <div className={styles.uploadSection}>
                        <h3>CSV Datei hochladen</h3>
                        <input type="file" accept=".csv" onChange={handleCsvUpload} />
                    </div>
                )}

                {/* Forecast Ergebnisse */}
                {forecastData.length > 0 && (
                    <div className={styles.forecastSection}>
                        <h3>Vorhersageergebnisse:</h3>
                        <ul>
                            {forecastData.map((item: any, index: number) => (
                                <li key={index}>
                                    {item.ds}: {item.yhat.toFixed(2)}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;
