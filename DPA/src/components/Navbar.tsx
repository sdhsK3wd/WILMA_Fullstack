import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "../api/axiosInstance";
import API_BASE_URL from "../apiConfig";
import styles from "../styles/Navbar.module.css";
import logo from "../images/Logo.png";
import { useAuth } from "../context/AuthContext";

const Navbar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();

    const handleLogout = async () => {
        try {
            if (user?.email) {
                await axios.post(`${API_BASE_URL}/users/logout`, { email: user.email });
            }
        } catch (err) {
            console.warn("Logout-Fehler:", err);
        }

        window.dispatchEvent(new Event("storage")); // z.B. für OnlineUserCount
        logout(); // ✅ Aus dem Context – inkl. redirect
    };

    return (
        <aside className={styles.sidebar}>
            <div className={styles.logoContainer}>
                <img src={logo} alt="Logo" className={styles.logo} />
            </div>
            <nav className={styles.menu}>
                <Link to="/dashboard" className={`${styles.menuItem} ${location.pathname === "/dashboard" ? styles.active : ""}`}>
                    Dashboard
                </Link>

                {user?.role === "Admin" && (
                    <Link to="/create-user" className={`${styles.menuItem} ${location.pathname === "/create-user" ? styles.active : ""}`}>
                        Create User
                    </Link>
                )}

                <Link to="/user-list" className={`${styles.menuItem} ${location.pathname === "/user-list" ? styles.active : ""}`}>
                    User List
                </Link>

                <Link to="/profile" className={`${styles.menuItem} ${location.pathname === "/profile" ? styles.active : ""}`}>
                    Profil
                </Link>
            </nav>

            <button onClick={handleLogout} className={styles.logoutButton}>
                Logout
            </button>
        </aside>
    );
};

export default Navbar;
