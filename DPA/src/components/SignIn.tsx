import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import axios from '../api/axiosInstance';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import type { AxiosError } from 'axios';
import API_BASE_URL from '../apiConfig';
import type { User } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

import {
    Box,
    Typography,
    TextField,
    Link,
    IconButton,
    InputAdornment,
    FormControl,
    InputLabel,
    FilledInput,
    useTheme,
    Paper,
    Stack,
    CssBaseline,
    // Avatar, // Nicht mehr benötigt, da Logo verwendet wird
    alpha,
    // Divider // Nicht verwendet im Code
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import { Visibility, VisibilityOff, Login as LoginIcon } from '@mui/icons-material';

import logo from '../images/Logo.png'; // Importiere dein Logo

const SignIn: React.FC = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const { login, isAuthenticated } = useAuth();
    const theme = useTheme();
    const { t } = useTranslation();

    useEffect(() => {
        if (isAuthenticated && (location.pathname === "/login" || location.pathname === "/")) {
            navigate("/home", { replace: true });
        }
    }, [isAuthenticated, navigate, location.pathname]);

    const handleLogin = async () => {
        if (!email || !password) {
            toast.error(t("signIn.toast.fieldsRequired"));
            return;
        }
        setLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/users/login`, { email, password });
            const loggedInUser: User = response.data;
            login(loggedInUser);
            toast.success(t("signIn.toast.loginSuccess"));
            navigate("/home", { replace: true });
        } catch (error) {
            const err = error as AxiosError<{ message?: string }>;
            console.error("Login Error:", err.response?.data || err.message);
            toast.error(err.response?.data?.message || t("signIn.toast.loginErrorGeneric"));
        } finally {
            setLoading(false);
        }
    };

    const handleClickShowPassword = () => setShowPassword((show) => !show);
    const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
    };

    // Hilfsfunktion für Autofill-Styles, um Wiederholungen zu vermeiden
    // Die Hintergrundfarbe hier ist der Standard für FilledInput in MUI
    // theme.palette.mode === 'dark' ? alpha(theme.palette.common.white, 0.09) : alpha(theme.palette.common.black, 0.06)
    // Passe dies an, falls deine FilledInputs eine andere benutzerdefinierte Hintergrundfarbe haben.
    const getAutofillStyles = (themeInstance: typeof theme) => ({
        WebkitBoxShadow: `0 0 0 100px ${
            themeInstance.palette.mode === 'dark'
                ? alpha(themeInstance.palette.common.white, 0.09) // Standard MUI FilledInput Hintergrund (dunkel)
                : alpha(themeInstance.palette.common.black, 0.06) // Standard MUI FilledInput Hintergrund (hell)
        } inset !important`,
        WebkitTextFillColor: `${themeInstance.palette.text.primary} !important`,
        caretColor: `${themeInstance.palette.text.primary} !important`,
        borderRadius: 'inherit !important', // Nimmt den Radius des Elternelements (des Inputs)
        transition: 'background-color 5000s ease-in-out 0s', // Verhindert die Browser-Standard-Transition
    });

    const autofillStyles = getAutofillStyles(theme);


    return (
        <Box
            sx={{
                display: 'flex',
                minHeight: '100vh',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[100],
                p: 3,
            }}
        >
            <CssBaseline />
            <Paper
                elevation={0}
                variant="outlined"
                sx={{
                    p: { xs: 3, sm: 5 },
                    width: '100%',
                    maxWidth: '500px',
                    borderRadius: 4, // Entspricht theme.shape.borderRadius * 1 bei Standardtheme (4px)
                    borderColor: alpha(theme.palette.divider, 0.3),
                    bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.75) : 'background.paper',
                    backdropFilter: theme.palette.mode === 'dark' ? 'blur(16px)' : 'none',
                    border: theme.palette.mode === 'dark'
                        ? `1px solid ${alpha(theme.palette.grey[700], 0.3)}`
                        : `1px solid ${alpha(theme.palette.grey[300], 0.7)}`,
                    transition: 'border-color 0.3s ease',
                    '&:hover': {
                        borderColor: theme.palette.mode === 'dark'
                            ? alpha(theme.palette.grey[600], 0.5)
                            : alpha(theme.palette.grey[400], 0.9),
                    }
                }}
            >
                <Stack spacing={3} alignItems="center">
                    <img
                        src={logo}
                        alt="GWT Logo"
                        style={{ width: 140, height: 'auto', marginBottom: theme.spacing(1) }}
                    />

                    <Typography component="h1" variant="h5" sx={{ fontWeight: 'bold', color: 'text.primary' }}>
                        {t('signIn.welcomeTitle')}
                    </Typography>
                    <Typography component="p" variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', mt: -2, mb: 1 }}>
                        {t('signIn.subtitle')}
                    </Typography>

                    <Box component="form" onSubmit={(e) => { e.preventDefault(); handleLogin(); }} sx={{ width: '100%', mt: 1 }}>
                        <Stack spacing={3}>
                            <TextField
                                fullWidth
                                required
                                id="email"
                                label={t('signIn.emailLabel')}
                                name="email"
                                type="email"
                                autoComplete="email"
                                autoFocus
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                                variant="filled"
                                InputProps={{ disableUnderline: true }}
                                InputLabelProps={{ required: false }}
                                sx={{
                                    '.MuiFilledInput-root': {
                                        borderRadius: 2, // Dein ursprünglicher Radius
                                        // Wichtig: Styles für das eigentliche <input>-Element innerhalb von MuiFilledInput-root
                                        '& input:-webkit-autofill': autofillStyles,
                                        '& input:-webkit-autofill:hover': autofillStyles,
                                        '& input:-webkit-autofill:focus': autofillStyles,
                                        '& input:-webkit-autofill:active': autofillStyles,
                                    },
                                }}
                            />
                            <FormControl
                                fullWidth
                                required
                                variant="filled"
                                disabled={loading}
                                sx={{
                                    '.MuiFilledInput-root': {
                                        borderRadius: 2, // Dein ursprünglicher Radius
                                        // Wichtig: Styles für das eigentliche <input>-Element innerhalb von MuiFilledInput-root
                                        '& input:-webkit-autofill': autofillStyles,
                                        '& input:-webkit-autofill:hover': autofillStyles,
                                        '& input:-webkit-autofill:focus': autofillStyles,
                                        '& input:-webkit-autofill:active': autofillStyles,
                                    },
                                }}
                            >
                                <InputLabel htmlFor="login-password" required={false}>
                                    {t('signIn.passwordLabel')}
                                </InputLabel>
                                <FilledInput
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    disableUnderline={true}
                                    endAdornment={(
                                        <InputAdornment position="end">
                                            <IconButton
                                                aria-label={t('signIn.password.toggleVisibilityAriaLabel')}
                                                onClick={handleClickShowPassword}
                                                onMouseDown={handleMouseDownPassword}
                                                edge="end"
                                                sx={{
                                                    backgroundColor: 'transparent !important',
                                                    '&:hover': { backgroundColor: 'action.hover' }
                                                }}
                                            >
                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    )}
                                />
                            </FormControl>

                            <LoadingButton
                                type="submit"
                                fullWidth
                                variant="contained"
                                color="primary"
                                size="large"
                                loading={loading}
                                startIcon={<LoginIcon />}
                                sx={{
                                    py: 1.5,
                                    fontWeight: 'bold',
                                    borderRadius: 2,
                                    boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.25)}`,
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                    '&:hover': {
                                        transform: 'translateY(-2px)',
                                        boxShadow: `0 8px 25px ${alpha(theme.palette.primary.main, 0.35)}`,
                                    }
                                }}
                            >
                                {t('signIn.submitButton')}
                            </LoadingButton>
                            <Box sx={{ textAlign: 'center', pt: 1 }}>
                                <Link component={RouterLink} to="/forgot-password" variant="body2" sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                                    {t('signIn.forgotPasswordLink')}
                                </Link>
                            </Box>
                        </Stack>
                    </Box>
                </Stack>
            </Paper>
        </Box>
    );
};

export default SignIn;