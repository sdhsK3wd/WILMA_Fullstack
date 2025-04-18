import { useState, useEffect } from "react";
import axios from "../api/axiosInstance";
import API_BASE_URL from "../apiConfig";

const OnlineUserCount: React.FC = () => {
    const [onlineUsers, setOnlineUsers] = useState(0);

    const fetchOnlineUsers = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/users/online-count`);
            setOnlineUsers(response.data.onlineUsers);
        } catch (error) {
            console.error("❌ Fehler beim Abrufen der Online-Benutzer:", error);
        }
    };

    useEffect(() => {
        fetchOnlineUsers(); // Initial Call
        const interval = setInterval(fetchOnlineUsers, 5000); // Refresh every 5s

        return () => clearInterval(interval);
    }, []);

    // 👇 Ensure fresh data when logout happens
    useEffect(() => {
        const handleStorageChange = () => {
            fetchOnlineUsers();
        };

        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);

    return (
        <div>
            <p>Online-Benutzer: {onlineUsers}</p>
        </div>
    );
};

export default OnlineUserCount;
