import React, { useState, useEffect } from "react";
import axios from "../api/axiosInstance";
import Navbar from "./Navbar";
import API_BASE_URL from "../apiConfig";
import styles from "../styles/Profile.module.css";
import toast from "react-hot-toast";
import { ClipLoader } from "react-spinners";

const Profile: React.FC = () => {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [location, setLocation] = useState("");
    const [profileImage, setProfileImage] = useState("");
    const [showEdit, setShowEdit] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            const user = JSON.parse(storedUser);
            setUsername(user.username);
            setEmail(user.email);
            setProfileImage(user.profileImageUrl || "");
            setPhoneNumber(user.phoneNumber || "Not set");
            setLocation(user.location || "Not set");
        }
    }, []);

    const validatePhoneNumber = (number: string) => /^\+?[0-9]{7,15}$/.test(number);

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await axios.post(`${API_BASE_URL}/users/upload-profile-image`, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            setProfileImage(res.data.imageUrl);
            toast.success("Bild erfolgreich hochgeladen!");
        } catch {
            toast.error("Bild konnte nicht hochgeladen werden.");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validatePhoneNumber(phoneNumber)) {
            toast.error("Bitte gib eine gültige Telefonnummer ein.");
            return;
        }
        if (!location) {
            toast.error("Standort darf nicht leer sein.");
            return;
        }

        setLoading(true);
        try {
            await axios.put(`${API_BASE_URL}/users/update-profile`, {
                username,
                email,
                phoneNumber,
                location,
                profileImageUrl: profileImage
            });

            toast.success("Profil erfolgreich aktualisiert!");

            const storedUser = localStorage.getItem("user");
            if (storedUser) {
                const user = JSON.parse(storedUser);
                const updatedUser = {
                    ...user,
                    phoneNumber,
                    location,
                    profileImageUrl: profileImage
                };
                localStorage.setItem("user", JSON.stringify(updatedUser));
            }

            setShowEdit(false);
        } catch {
            toast.error("Fehler beim Aktualisieren des Profils.");
        }
        setLoading(false);
    };

    return (
        <div className={styles.dashboardContainer}>
            <Navbar />
            <main className={styles.mainContent}>
                <div className={styles.profileContainer}>
                    <img
                        src={profileImage || "/default-profile.png"}
                        className={styles.profileImage}
                        alt="Profilbild"
                    />
                    <h2>{username}</h2>
                    <p><strong>Email:</strong> {email}</p>
                    <p><strong>Telefonnummer:</strong> {phoneNumber}</p>
                    <p><strong>Standort:</strong> {location}</p>

                    <button className={styles.editButton} onClick={() => setShowEdit(true)}>
                        Profil Bearbeiten
                    </button>

                    {showEdit && (
                        <div className={styles.modalBackdrop}>
                            <div className={styles.modal}>
                                <h3>Profil bearbeiten</h3>
                                <form onSubmit={handleSubmit}>
                                    <label>Telefonnummer:</label>
                                    <input
                                        type="text"
                                        value={phoneNumber === "Not set" ? "" : phoneNumber}
                                        onChange={e => setPhoneNumber(e.target.value)}
                                    />

                                    <label>Standort:</label>
                                    <input
                                        type="text"
                                        value={location === "Not set" ? "" : location}
                                        onChange={e => setLocation(e.target.value)}
                                    />

                                    <label>Profilbild:</label>
                                    <input type="file" accept="image/*" onChange={handleImageChange} />

                                    <button type="submit" disabled={loading}>
                                        {loading ? <ClipLoader size={18} color="#fff"/> : "Speichern"}
                                    </button>

                                    <button type="button" className={styles.closeButton}
                                            onClick={() => setShowEdit(false)}>
                                        Abbrechen
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Profile;
