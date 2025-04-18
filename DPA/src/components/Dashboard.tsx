import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "../styles/Dashboard.module.css";
import Navbar from "./Navbar";
import OnlineUserCount from "./OnlineUserCount";


const Dashboard: React.FC = () => {
    const [userRole, setUserRole] = useState("");
    const [userName, setUserName] = useState("");
    const [userEmail, setUserEmail] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const storedUser = localStorage.getItem("user");

        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUserRole(parsedUser.role);
            setUserName(parsedUser.username);
            setUserEmail(parsedUser.email);
        } else {
            console.log("🚨 Kein Benutzer gefunden, umleiten...");
            navigate("/login", { replace: true });
        }
    }, []); // ✅ Empty dependency array ensures it runs only once


    return (
        <div className={styles.dashboardContainer}>
            <Navbar />
            <main className={styles.mainContent}>
                <div className={styles.userInfo}>
                    <p>Angemeldet als: <strong>{userName}</strong> (Rolle: <strong>{userRole}</strong>)</p>
                    <p>Email: <strong>{userEmail}</strong></p>
                </div>
                <h2>Dashboard</h2>
                <OnlineUserCount /> {/* Zeige die Anzahl der Online-Benutzer an */}
                <div className={styles.statsContainer}>
                    <div className={styles.statCard}>
                        <h3>Historic Water Data</h3>
                        <p>03/02/2024 - 20/08/2024</p>
                        <p>All Day</p>
                    </div>
                    <div className={styles.statCard}>
                        <h3>Waterflow</h3>
                        <p>32,451</p>
                    </div>
                    <div className={styles.statCard}>
                        <h3>Loss</h3>
                        <p>15,236</p>
                    </div>
                    <div className={styles.statCard}>
                        <h3>Bezirk - Tulin</h3>
                    </div>
                    <div className={styles.statCard}>
                        <h3>Status</h3>
                    </div>
                    <div className={styles.statCard}>
                        <h3>Sender Water</h3>
                        <p>32,451</p>
                    </div>
                    <div className={styles.statCard}>
                        <h3>Arrived Water</h3>
                        <p>17,215</p>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Dashboard;

