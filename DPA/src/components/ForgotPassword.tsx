import React, { useState, useEffect } from "react";
import axios from "../api/axiosInstance";
import { useNavigate, useSearchParams } from "react-router-dom";
import API_BASE_URL from "../apiConfig";
import type { AxiosError } from "axios";
import toast from "react-hot-toast";

import {
    Box,
    Paper,
    Typography,
    TextField,
    Stack,
    CssBaseline,
    useTheme,
    alpha,
    FormControl,
    InputLabel,
    OutlinedInput,
    InputAdornment,
    IconButton,
    Avatar
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import { LockReset as LockResetIcon, Visibility, VisibilityOff } from '@mui/icons-material';
import { motion } from 'framer-motion';

const ForgotPassword: React.FC = () => {
    const [email, setEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const theme = useTheme();

    useEffect(() => {
        const tokenFromURL = searchParams.get("token");
        if (tokenFromURL) {
            setToken(tokenFromURL.trim());
            setStep(2);
        }
    }, [searchParams]);

    const handleEmailSubmit = async (event: React.FormEvent) => {
        event.preventDefault(); // Prevent default form submission
        if (!email) {
            toast.error("Bitte gib deine E-Mail-Adresse ein.");
            return;
        }
        setLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/users/forgot-password`, { email });
            toast.success(response.data.message || "E-Mail zum Zurücksetzen wurde gesendet. Bitte prüfe dein Postfach.");
            // Optionally stay on step 1 or navigate/clear field
        } catch (error) {
            const err = error as AxiosError<{ message?: string }>;
            toast.error(err.response?.data?.message || "Fehler beim Senden der E-Mail.");
        }
        setLoading(false);
    };

    const handleResetPassword = async (event: React.FormEvent) => {
        event.preventDefault(); // Prevent default form submission
        if (!token) {
            toast.error("Kein gültiger Reset-Token gefunden oder Token abgelaufen.");
            return;
        }
        if (!newPassword || !confirmPassword) {
            toast.error("Bitte fülle beide Passwortfelder aus.");
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error("Die eingegebenen Passwörter stimmen nicht überein.");
            return;
        }
        // Add password complexity validation if needed here

        setLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/users/reset-password`, { token, newPassword });
            toast.success(response.data.message || "Passwort erfolgreich geändert.");
            setTimeout(() => navigate("/login"), 2500);
        } catch (error) {
            const err = error as AxiosError<{ message?: string }>;
            toast.error(err.response?.data?.message || "Fehler beim Zurücksetzen des Passworts.");
        }
        setLoading(false);
    };

    const handleClickShowPassword = () => setShowPassword((show) => !show);
    const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault();
    const handleClickShowConfirmPassword = () => setShowConfirmPassword((show) => !show);
    const handleMouseDownConfirmPassword = (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault();


    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[100], // Use consistent background
                p: 2,
            }}
        >
            <CssBaseline />
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
            >
                <Paper
                    elevation={0}
                    variant="outlined"
                    sx={{
                        p: { xs: 2.5, sm: 4 },
                        width: '100%',
                        maxWidth: '450px',
                        borderRadius: 3,
                        borderColor: alpha(theme.palette.divider, 0.5),
                        bgcolor: 'background.paper' // Use paper background
                    }}
                >
                    <Stack spacing={3} alignItems="center">
                        <Avatar sx={{ bgcolor: 'primary.main', mb: 1 }}>
                            <LockResetIcon />
                        </Avatar>
                        <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold' }}>
                            Passwort zurücksetzen
                        </Typography>

                        {step === 1 ? (
                            <Stack spacing={3} component="form" onSubmit={handleEmailSubmit} sx={{ width: '100%'}}>
                                <Typography variant="body2" color="text.secondary" textAlign="center">
                                    Gib deine E-Mail-Adresse ein, um einen Link zum Zurücksetzen deines Passworts zu erhalten.
                                </Typography>
                                <TextField
                                    fullWidth
                                    id="email"
                                    label="Deine E-Mail"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    autoFocus
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={loading}
                                />
                                <LoadingButton
                                    type="submit"
                                    fullWidth
                                    variant="contained"
                                    size="large"
                                    loading={loading}
                                    sx={{ py: 1.5 }}
                                >
                                    Reset-Link senden
                                </LoadingButton>
                            </Stack>
                        ) : (
                            <Stack spacing={3} component="form" onSubmit={handleResetPassword} sx={{ width: '100%'}}>
                                <Typography variant="body2" color="text.secondary" textAlign="center">
                                    Bitte gib dein neues Passwort ein.
                                </Typography>
                                <FormControl fullWidth variant="outlined">
                                    <InputLabel htmlFor="reset-new-password">Neues Passwort</InputLabel>
                                    <OutlinedInput
                                        id="reset-new-password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        disabled={loading}
                                        label="Neues Passwort"
                                        endAdornment={
                                            <InputAdornment position="end">
                                                <IconButton aria-label="toggle password visibility" onClick={handleClickShowPassword} onMouseDown={handleMouseDownPassword} edge="end">
                                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>
                                        }
                                    />
                                </FormControl>
                                <FormControl fullWidth variant="outlined">
                                    <InputLabel htmlFor="reset-confirm-password">Passwort bestätigen</InputLabel>
                                    <OutlinedInput
                                        id="reset-confirm-password"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        disabled={loading}
                                        label="Passwort bestätigen"
                                        endAdornment={
                                            <InputAdornment position="end">
                                                <IconButton aria-label="toggle confirm password visibility" onClick={handleClickShowConfirmPassword} onMouseDown={handleMouseDownConfirmPassword} edge="end">
                                                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>
                                        }
                                    />
                                </FormControl>
                                <LoadingButton
                                    type="submit"
                                    fullWidth
                                    variant="contained"
                                    size="large"
                                    loading={loading}
                                    sx={{ py: 1.5 }}
                                >
                                    Passwort setzen
                                </LoadingButton>
                            </Stack>
                        )}
                    </Stack>
                </Paper>
            </motion.div>
        </Box>
    );
};

export default ForgotPassword;