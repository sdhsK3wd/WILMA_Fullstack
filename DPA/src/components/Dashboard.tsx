import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/Dashboard.module.css";
import Navbar from "./Navbar";
import OnlineUserCount from "./OnlineUserCount";
import axios from "../api/axiosInstance"; // Dein angepasstes axiosInstance
import toast from "react-hot-toast";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

const Dashboard: React.FC = () => {
    const [userRole, setUserRole] = useState("");
    const [userName, setUserName] = useState("");
    const [forecastData, setForecastData] = useState([]);
    const [forecastVsActualData, setForecastVsActualData] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const storedUser = localStorage.getItem("user");

        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUserRole(parsedUser.role);
            setUserName(parsedUser.username);

            fetchForecasts();
            fetchForecastVsActual();
        } else {
            console.log("🚨 Kein Benutzer gefunden, umleiten...");
            navigate("/login", { replace: true });
        }
    }, []);

    const fetchForecasts = async () => {
        try {
            const response = await axios.get("/forecasts/");
            setForecastData(response.data);
        } catch (error) {
            console.error("Fehler beim Laden der Forecast-Daten:", error);
            toast.error("Fehler beim Laden der Vorhersagen.");
        }
    };

    const fetchForecastVsActual = async () => {
        try {
            const response = await axios.get("/forecast_vs_actual/");
            setForecastVsActualData(response.data);
        } catch (error) {
            console.error("Fehler beim Laden der Forecast vs Actual-Daten:", error);
            toast.error("Fehler beim Laden der Vergleichsdaten.");
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
            toast.success("Forecast CSV erfolgreich hochgeladen!");
            fetchForecasts();
            fetchForecastVsActual();
        } catch (err) {
            console.error("Fehler beim Upload:", err);
            toast.error("Upload fehlgeschlagen.");
        }
    };

    const handleActualUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            await axios.post("/upload_actual/", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            toast.success("Actual CSV erfolgreich hochgeladen!");
            fetchForecastVsActual();
        } catch (err) {
            console.error("Fehler beim Upload der Actual Werte:", err);
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
                        <h3>Forecast CSV hochladen</h3>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleCsvUpload}
                            style={{ padding: "5px", fontSize: "12px", width: "220px" }}
                        />
                        <h3 style={{ marginTop: "20px" }}>Actual CSV hochladen</h3>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleActualUpload}
                            style={{ padding: "5px", fontSize: "12px", width: "220px" }}
                        />
                    </div>
                )}

                {/* Forecast vs Actual Diagramm */}
                {forecastVsActualData.length > 0 && (
                    <div className={styles.forecastSection}>
                        <h3>Vorhersage vs Tatsächliche Werte:</h3>
                        <div style={{ width: "100%", height: 450 }}>
                            <ResponsiveContainer>
                                <LineChart data={forecastVsActualData}>
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="forecast" stroke="#8884d8" strokeWidth={2.5} dot={false} />
                                    <Line type="monotone" dataKey="actual" stroke="#82ca9d" strokeWidth={1} dot={{ r: 1 }} />
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
