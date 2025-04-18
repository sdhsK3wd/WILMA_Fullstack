import React, { useEffect, useState } from "react";
import axios from "../api/axiosInstance";
import Navbar from "./Navbar";
import styles from "../styles/UserList.module.css";
import API_BASE_URL from "../apiConfig";
import toast from "react-hot-toast";

interface User {
    id: number;
    username: string;
    email: string;
    role: string;
    profileImageUrl?: string;
}

const UserList: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/users/all`);
                setUsers(res.data);
            } catch (error) {
                toast.error("Fehler beim Laden der Benutzer.");
            }
        };

        fetchUsers();
    }, []);

    const handleDelete = async (userId: number) => {
        const confirmDelete = window.confirm("Willst du diesen Benutzer wirklich löschen?");
        if (!confirmDelete) return;

        try {
            await axios.delete(`${API_BASE_URL}/users/${userId}`);
            setUsers(users.filter(user => user.id !== userId));
            toast.success("Benutzer gelöscht.");
        } catch (error) {
            toast.error("Fehler beim Löschen.");
        }
    };

    const defaultProfileImage = "/Default.png";

    return (
        <div className={styles.dashboardContainer}>
            <Navbar />
            <main className={styles.mainContent}>
                <h2>Benutzerliste</h2>
                <table className={styles.userTable}>
                    <thead>
                    <tr>
                        <th>Profilbild</th>
                        <th>Benutzername</th>
                        <th>E-Mail</th>
                        <th>Rolle</th>
                        <th>Aktionen</th>
                    </tr>
                    </thead>
                    <tbody>
                    {users.map(user => (
                        <tr key={user.id}>
                            <td>
                                <img
                                    src={user.profileImageUrl || defaultProfileImage}
                                    alt="Profilbild"
                                    className={styles.userImage}
                                />
                            </td>
                            <td>{user.username}</td>
                            <td>{user.email}</td>
                            <td>{user.role}</td>
                            <td>
                                {storedUser.role === "Admin" && user.role !== "Admin" ? (
                                    <button
                                        className={styles.deleteButton}
                                        onClick={() => handleDelete(user.id)}
                                    >
                                        Löschen
                                    </button>
                                ) : (
                                    <span className={styles.adminLabel}>Admin</span>
                                )}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </main>
        </div>
    );
};

export default UserList;
