import React, { useState, useEffect } from "react";
import axios from "../api/axiosInstance";
import { useNavigate, useSearchParams } from "react-router-dom";
import API_BASE_URL from "../apiConfig";
import type { AxiosError } from "axios";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next"; // <-- HINZUGEFÜGT: Importiere useTranslation

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
    const { t } = useTranslation(); // <-- HINZUGEFÜGT: Initialisiere useTranslation

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
            toast.error(t("forgotPassword.toast.enterEmail")); // <-- ÜBERSETZT
            return;
        }
        setLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/users/forgot-password`, { email });
            toast.success(response.data.message || t("forgotPassword.toast.resetEmailSent")); // <-- ÜBERSETZT
            // Optionally stay on step 1 or navigate/clear field
        } catch (error) {
            const err = error as AxiosError<{ message?: string }>;
            toast.error(err.response?.data?.message || t("forgotPassword.toast.errorSendingEmail")); // <-- ÜBERSETZT
        }
        setLoading(false);
    };

    const handleResetPassword = async (event: React.FormEvent) => {
        event.preventDefault(); // Prevent default form submission
        if (!token) {
            toast.error(t("forgotPassword.toast.invalidToken")); // <-- ÜBERSETZT
            return;
        }
        if (!newPassword || !confirmPassword) {
            toast.error(t("forgotPassword.toast.fillAllPasswordFields")); // <-- ÜBERSETZT
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error(t("forgotPassword.toast.passwordsDoNotMatch")); // <-- ÜBERSETZT
            return;
        }
        // Add password complexity validation if needed here

        setLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/users/reset-password`, { token, newPassword });
            toast.success(response.data.message || t("forgotPassword.toast.passwordChangedSuccess")); // <-- ÜBERSETZT
            setTimeout(() => navigate("/login"), 2500);
        } catch (error) {
            const err = error as AxiosError<{ message?: string }>;
            toast.error(err.response?.data?.message || t("forgotPassword.toast.errorResettingPassword")); // <-- ÜBERSETZT
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
                            {t("forgotPassword.pageTitle")} {/* <-- ÜBERSETZT */}
                        </Typography>

                        {step === 1 ? (
                            <Stack spacing={3} component="form" onSubmit={handleEmailSubmit} sx={{ width: '100%'}}>
                                <Typography variant="body2" color="text.secondary" textAlign="center">
                                    {t("forgotPassword.step1.description")} {/* <-- ÜBERSETZT */}
                                </Typography>
                                <TextField
                                    fullWidth
                                    id="email"
                                    label={t("forgotPassword.step1.emailLabel")}
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
                                    {t("forgotPassword.step1.sendResetLinkButton")} {/* <-- ÜBERSETZT */}
                                </LoadingButton>
                            </Stack>
                        ) : (
                            <Stack spacing={3} component="form" onSubmit={handleResetPassword} sx={{ width: '100%'}}>
                                <Typography variant="body2" color="text.secondary" textAlign="center">
                                    {t("forgotPassword.step2.description")} {/* <-- ÜBERSETZT */}
                                </Typography>
                                <FormControl fullWidth variant="outlined">
                                    <InputLabel htmlFor="reset-new-password">{t("forgotPassword.step2.newPasswordLabel")}</InputLabel> {/* <-- ÜBERSETZT */}
                                    <OutlinedInput
                                        id="reset-new-password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        disabled={loading}
                                        label={t("forgotPassword.step2.newPasswordLabel")}
                                        endAdornment={
                                            <InputAdornment position="end">
                                                <IconButton aria-label={t("forgotPassword.step2.togglePasswordVisibilityAriaLabel")} onClick={handleClickShowPassword} onMouseDown={handleMouseDownPassword} edge="end"> {/* <-- ÜBERSETZT */}
                                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>
                                        }
                                    />
                                </FormControl>
                                <FormControl fullWidth variant="outlined">
                                    <InputLabel htmlFor="reset-confirm-password">{t("forgotPassword.step2.confirmPasswordLabel")}</InputLabel> {/* <-- ÜBERSETZT */}
                                    <OutlinedInput
                                        id="reset-confirm-password"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        disabled={loading}
                                        label={t("forgotPassword.step2.confirmPasswordLabel")}
                                        endAdornment={
                                            <InputAdornment position="end">
                                                <IconButton aria-label={t("forgotPassword.step2.toggleConfirmPasswordVisibilityAriaLabel")} onClick={handleClickShowConfirmPassword} onMouseDown={handleMouseDownConfirmPassword} edge="end"> {/* <-- ÜBERSETZT */}
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
                                    {t("forgotPassword.step2.setPasswordButton")} {/* <-- ÜBERSETZT */}
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