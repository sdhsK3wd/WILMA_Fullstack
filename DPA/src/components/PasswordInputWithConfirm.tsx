import React, { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputWithConfirmProps {
    password: string;
    confirmPassword: string;
    onPasswordChange: (value: string) => void;
    onConfirmChange: (value: string) => void;
}

const getStrength = (password: string) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
};

const PasswordInputWithConfirm: React.FC<PasswordInputWithConfirmProps> = ({
                                                                               password,
                                                                               confirmPassword,
                                                                               onPasswordChange,
                                                                               onConfirmChange
                                                                           }) => {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [touched, setTouched] = useState(false);

    const strength = getStrength(password);
    const passwordsMatch = password === confirmPassword;

    const strengthColors = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71"];
    const strengthText = ["Sehr schwach", "Schwach", "Gut", "Stark"];

    useEffect(() => {
        if (confirmPassword.length > 0) setTouched(true);
    }, [confirmPassword]);

    const inputStyle = (hasError = false): React.CSSProperties => ({
        width: "100%",
        padding: "0.5rem 2.5rem 0.5rem 0.5rem",
        border: `1px solid ${hasError ? "#e74c3c" : "#ccc"}`,
        borderRadius: "4px",
        fontSize: "1rem",
        boxSizing: "border-box"
    });

    const iconStyle: React.CSSProperties = {
        position: "absolute",
        right: "0.5rem",
        top: "50%",
        transform: "translateY(calc(-50% + 1px))",
        cursor: "pointer",
        color: "#555"
    };

    return (
        <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontWeight: "bold" }}>Neues Passwort</label>
            <div style={{ position: "relative", marginBottom: "0.5rem" }}>
                <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    placeholder="Neues Passwort"
                    onChange={(e) => onPasswordChange(e.target.value)}
                    style={inputStyle()}
                />
                <span onClick={() => setShowPassword(!showPassword)} style={iconStyle}>
                    {showPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                </span>
            </div>

            {/* Stärke-Balken + Info */}
            <div style={{ marginTop: "0.3rem", marginBottom: "1rem", textAlign: "center" }}>
                <div
                    style={{
                        height: "6px",
                        background: "#eee",
                        borderRadius: "4px",
                        overflow: "hidden",
                        marginBottom: "0.4rem"
                    }}
                >
                    <div
                        style={{
                            height: "100%",
                            width: `${(strength / 4) * 100}%`,
                            backgroundColor: strengthColors[strength - 1] || "#e74c3c",
                            transition: "width 0.3s ease"
                        }}
                    />
                </div>
                <p style={{ fontSize: "0.9rem", fontWeight: "bold", margin: "0.2rem 0" }}>
                    {strengthText[strength - 1] || "Sehr schwach"}
                </p>
                <p style={{ fontSize: "0.85rem", color: "#666", margin: 0 }}>
                    mindestens 8 Zeichen, 1 Zahl, 1 Großbuchstabe
                </p>
            </div>

            <label style={{ fontWeight: "bold" }}>Passwort wiederholen</label>
            <div style={{ position: "relative", marginBottom: "0.3rem" }}>
                <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    placeholder="Passwort wiederholen"
                    onChange={(e) => onConfirmChange(e.target.value)}
                    style={inputStyle(!passwordsMatch && touched)}
                />
                <span onClick={() => setShowConfirm(!showConfirm)} style={iconStyle}>
                    {showConfirm ? <Eye size={20} /> : <EyeOff size={20} />}
                </span>
            </div>

            {!passwordsMatch && touched && (
                <p style={{ color: "#e74c3c", fontSize: "0.85rem" }}>
                    Passwörter stimmen nicht überein
                </p>
            )}
        </div>
    );
};

export default PasswordInputWithConfirm;
