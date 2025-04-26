import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/Dashboard.module.css";
import Navbar from "./Navbar";
import OnlineUserCount from "./OnlineUserCount";
import axios from "../api/axiosInstance"; // Dein angepasstes axiosInstance
import toast from "react-hot-toast";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

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

            // Direkt beim Start Forecasts laden
            fetchForecasts();
        } else {
            console.log("🚨 Kein Benutzer gefunden, umleiten...");
            navigate("/login", { replace: true });
        }
    }, []);

    const fetchForecasts = async () => {
        try {
            const response = await axios.get("/forecasts/"); // <<< Wichtig richtige URL
            setForecastData(response.data);
        } catch (error) {
            console.error("Fehler beim Laden der Forecast-Daten:", error);
            toast.error("Fehler beim Laden der Vorhersagen.");
        }
    };

    const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            await axios.post("/upload_csv/", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            toast.success("CSV erfolgreich hochgeladen!");

            // Nach Upload Daten neu laden
            fetchForecasts();
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

                {forecastData.length > 0 && (
                    <div className={styles.forecastSection}>
                        <h3>Vorhersage Diagramm:</h3>
                        <div style={{ width: "100%", height: 400 }}>
                            <ResponsiveContainer>
                                <LineChart data={forecastData}>
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="value" stroke="#8884d8" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default Dashboard;
