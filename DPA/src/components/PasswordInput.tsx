import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps {
    value: string;
    onChange: (value: string) => void;
    showStrength?: boolean;
    placeholder?: string;
}

const getStrength = (password: string) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
};

const PasswordInput: React.FC<PasswordInputProps> = ({
                                                         value,
                                                         onChange,
                                                         showStrength = true,
                                                         placeholder = "Passwort",
                                                     }) => {
    const [visible, setVisible] = useState(false);
    const strength = getStrength(value);

    const strengthColors = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71"];
    const strengthText = ["Sehr schwach", "Schwach", "Gut", "Stark"];

    return (
        <div style={{ marginBottom: "1rem" }}>
            <div style={{ position: "relative" }}>
                <input
                    type={visible ? "text" : "password"}
                    value={value}
                    placeholder={placeholder}
                    onChange={(e) => onChange(e.target.value)}
                    style={{
                        width: "100%",
                        padding: "0.5rem 2.5rem 0.5rem 0.5rem",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        fontSize: "1rem",
                        boxSizing: "border-box"
                    }}
                />
                <span
                    onClick={() => setVisible(!visible)}
                    style={{
                        position: "absolute",
                        right: "0.5rem",
                        top: "50%",
                        transform: "translateY(calc(-50% + 1px))",
                        cursor: "pointer",
                        color: "#555"
                    }}
                >
                    {visible ? <Eye size={20} /> : <EyeOff size={20} />}
                </span>
            </div>

            {showStrength && (
                <div style={{ marginTop: "0.5rem", textAlign: "center" }}>
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
            )}
        </div>
    );
};

export default PasswordInput;
