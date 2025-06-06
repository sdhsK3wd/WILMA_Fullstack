import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axiosInstance';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { AxiosError } from 'axios';
import API_BASE_URL from '../apiConfig';
import { useTranslation } from 'react-i18next';

import {
    Box, AppBar, Toolbar, Typography, CssBaseline, CardContent, CardHeader, // Card entfernt, da Paper genutzt wird
    Button, useTheme, CircularProgress, Avatar,
    Stack, alpha,
    TextField, Select, MenuItem, FormControl, InputLabel, OutlinedInput,
    InputAdornment, IconButton,
    Paper // Paper wird jetzt für den Formularhintergrund verwendet
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import {
    Visibility, VisibilityOff,
    PersonAdd as CreateUserIconMui, // Für AppBar Icon
    AccountCircleOutlined, // Icon für Benutzername
    AlternateEmailOutlined, // Icon für Email
    LockOutlined, // Icon für Passwort
    AdminPanelSettingsOutlined, // Icon für Admin Email und Admin Rolle
    ManageAccountsOutlined, // Icon für Rolle
    PersonOutline // Icon für User Rolle
} from '@mui/icons-material';

import type { User } from '../context/AuthContext';
import UserManagementNavbar from './UserManagementNavbar';

// Optionale CSS-Klasse für eine Eingangs-Animation der Karte
// Du müsstest diese Animation in deiner globalen CSS-Datei definieren
// Beispiel:
// @keyframes fadeInSlideUp {
//   from {
//     opacity: 0;
//     transform: translateY(20px);
//   }
//   to {
//     opacity: 1;
//     transform: translateY(0);
//   }
// }
// .form-card-enter-active {
//   animation: fadeInSlideUp 0.5s ease-out forwards;
// }


const CreateUser: React.FC = () => {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("User");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [adminEmail, setAdminEmail] = useState("");

    const navigate = useNavigate();
    const theme = useTheme();
    const { user, isAdmin } = useAuth();
    const { t } = useTranslation();

    useEffect(() => {
        if (user !== undefined) {
            if (isAdmin && user) {
                setAdminEmail(user.email);
            }
            if (!isAdmin) {
                navigate('/home', { replace: true });
            }
            if (user === null) {
                navigate('/login', { replace: true });
            }
        }
    }, [user, isAdmin, navigate, t]);

    const handleCreateUser = async () => {
        if (!username || !email || !password || !role || !adminEmail) {
            toast.error(t('createUser.toast.fillAllFields'));
            return;
        }
        if (!isAdmin) {
            toast.error(t('createUser.toast.adminOnly'));
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/users/register`, { username, email, password, role, adminEmail });
            toast.success(response.data.message || t('createUser.toast.userCreatedSuccess'));
            setUsername(""); setEmail(""); setPassword(""); setRole("User");
            navigate('/user-list');
        } catch (err) {
            const error = err as AxiosError<{ message?: string; errors?: any }>;
            console.error("Fehler beim Benutzer erstellen:", error.response?.data || error.message);
            let errorMsg = t('createUser.toast.userCreatedError');
            if (error.response?.data?.message) {
                errorMsg = error.response.data.message;
            }
            if (error.response?.data?.errors) {
                const validationErrors = Object.values(error.response.data.errors).flat().join(' \n');
                errorMsg = `${errorMsg}\n${validationErrors}`;
            }
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };
    const handleClickShowPassword = () => setShowPassword((show) => !show);
    const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => { event.preventDefault(); };

    if (user === undefined) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default' }}><CircularProgress /></Box>;
    }

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            <UserManagementNavbar />

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.background.default,
                    p: { xs: 2, sm: 3, md: 4 }, // Etwas mehr Padding für ein luftigeres Design
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center', // Zentriert den Inhalt horizontal
                    // justifyContent: 'center' // Zentriert den Inhalt vertikal (optional)
                }}
            >
                {/* AppBar bleibt wie gehabt, da sie schon moderne Elemente enthält */}
                <AppBar
                    position="fixed"
                    sx={{
                        width: '100%',
                        zIndex: theme.zIndex.drawer + 1,
                        bgcolor: alpha(theme.palette.background.paper, 0.8), // Beibehaltung des Glassmorphism-Effekts
                        backdropFilter: 'blur(10px)', // Etwas stärkerer Blur
                        color: theme.palette.text.primary,
                        boxShadow: theme.shadows[2], // Leichterer Schatten für eine modernere Optik
                        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` // Subtilere Border
                    }}
                >
                    <Toolbar>
                        <CreateUserIconMui sx={{ mr: 1.5, color: 'primary.main' }} />
                        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 'medium' }}> {t('createUser.appBarTitle')} </Typography>
                        {user && (
                            <>
                                <Typography sx={{ mr: 2, display: { xs: 'none', sm: 'block' }, color: 'text.secondary' }}>{user.username} ({user.role})</Typography>
                                <Avatar src={user.profileImageUrl || '/Default.png'} alt={user.username} sx={{ bgcolor: theme.palette.primary.main, color: theme.palette.primary.contrastText }} > {user.username?.charAt(0).toUpperCase()} </Avatar>
                            </>
                        )}
                    </Toolbar>
                </AppBar>
                <Toolbar /> {/* Platzhalter für die fixe AppBar */}

                {/* Modernisierte Formular-Karte */}
                <Paper
                    // className="form-card-enter-active" // Aktivieren für Animation (CSS erforderlich)
                    elevation={5} // Subtiler Schatten für einen "schwebenden" Effekt
                    sx={{
                        maxWidth: '650px', // Etwas breiter für mehr Raum
                        width: '100%', // Responsive Breite
                        mt: { xs: 3, sm: 5 }, // Mehr Abstand nach oben
                        mb: 4,
                        borderRadius: 4, // Stärkere Abrundung
                        overflow: 'hidden', // Wichtig für abgerundete Ecken mit CardHeader
                        backdropFilter: theme.palette.mode === 'dark' ? 'blur(5px)' : 'none', // Optional: leichter Blur im Dark Mode
                        background: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.8 : 0.95),
                        border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                        transition: 'box-shadow 0.3s ease-in-out, transform 0.3s ease-in-out', // Für Hover-Effekte (optional)
                        // '&:hover': { // Optionaler Hover-Effekt für die gesamte Karte
                        //   boxShadow: theme.shadows[10],
                        //   transform: 'translateY(-4px)'
                        // }
                    }}
                >
                    <CardHeader
                        avatar={
                            <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.15), color: 'primary.main' }}>
                                <CreateUserIconMui />
                            </Avatar>
                        }
                        title={t('createUser.formTitle')}
                        titleTypographyProps={{ variant: 'h5', fontWeight: 'bold', color: 'text.primary' }}
                        subheader={t('createUser.formSubheader', 'Neuen Benutzer im System anlegen')} // Optional: Subheader hinzufügen
                        sx={{
                            bgcolor: alpha(theme.palette.primary.main, 0.05), // Sehr subtile Hintergrundfarbe
                            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
                            p: 3,
                        }}
                    />
                    <CardContent sx={{ p: { xs: 2, sm: 3, md: 4 } }}> {/* Mehr Padding im Inhalt */}
                        <Stack spacing={3.5} component="form" onSubmit={(e) => { e.preventDefault(); handleCreateUser(); }}>
                            {/* Admin Email Feld (Deaktiviert, aber mit Icon) */}
                            <TextField
                                label={t('createUser.adminEmailLabel')}
                                value={adminEmail}
                                fullWidth
                                disabled
                                variant="filled" // Filled Variante für deaktivierte Felder oft schöner
                                InputProps={{
                                    readOnly: true,
                                    disableUnderline: true, // Für 'filled' Variante
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <AdminPanelSettingsOutlined sx={{ color: theme.palette.action.disabled }} />
                                        </InputAdornment>
                                    ),
                                }}
                                size="medium"
                                sx={{
                                    '.MuiFilledInput-root': {
                                        borderRadius: 2,
                                        bgcolor: alpha(theme.palette.action.selected, 0.08)
                                    }
                                }}
                            />

                            {/* Benutzername Feld */}
                            <TextField
                                variant="outlined"
                                label={t('createUser.usernameLabel')}
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                fullWidth
                                autoComplete="off"
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <AccountCircleOutlined sx={{ color: 'text.secondary' }} />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        '&:hover fieldset': { borderColor: theme.palette.primary.light },
                                        '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}` },
                                        borderRadius: 2 // Abgerundete Ecken für Input
                                    }
                                }}
                            />

                            {/* Email Feld */}
                            <TextField
                                variant="outlined"
                                label={t('createUser.emailLabel')}
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                fullWidth
                                autoComplete="off"
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <AlternateEmailOutlined sx={{ color: 'text.secondary' }} />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        '&:hover fieldset': { borderColor: theme.palette.primary.light },
                                        '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}` },
                                        borderRadius: 2
                                    }
                                }}
                            />

                            {/* Passwort Feld */}
                            <FormControl fullWidth variant="outlined" sx={{
                                '& .MuiOutlinedInput-root': {
                                    '&:hover fieldset': { borderColor: theme.palette.primary.light },
                                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}` },
                                    borderRadius: 2
                                }
                            }}>
                                <InputLabel htmlFor="create-user-password">{t('createUser.passwordLabel')}</InputLabel>
                                <OutlinedInput
                                    id="create-user-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    label={t('createUser.passwordLabel')}
                                    startAdornment={
                                        <InputAdornment position="start">
                                            <LockOutlined sx={{ color: 'text.secondary' }} />
                                        </InputAdornment>
                                    }
                                    endAdornment={
                                        <InputAdornment position="end">
                                            <IconButton aria-label={t('createUser.password.toggleVisibilityAriaLabel')} onClick={handleClickShowPassword} onMouseDown={handleMouseDownPassword} edge="end">
                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    }
                                />
                            </FormControl>

                            {/* Rolle Auswahlfeld */}
                            <FormControl fullWidth variant="outlined" sx={{
                                '& .MuiOutlinedInput-root': {
                                    '&:hover fieldset': { borderColor: theme.palette.primary.light },
                                    '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}` },
                                    borderRadius: 2
                                }
                            }}>
                                <InputLabel id="role-select-label">{t('createUser.roleLabel')}</InputLabel>
                                <Select
                                    labelId="role-select-label"
                                    id="role-select"
                                    value={role}
                                    label={t('createUser.roleLabel')}
                                    onChange={(e) => setRole(e.target.value)}
                                    startAdornment={ // Icon für das Select-Feld selbst
                                        <InputAdornment position="start" sx={{ ml: 0.5, mr: -1 }}> {/* Anpassung für bessere Optik */}
                                            <ManageAccountsOutlined sx={{ color: 'text.secondary' }} />
                                        </InputAdornment>
                                    }
                                >
                                    <MenuItem value="User">
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                            <PersonOutline sx={{ mr: 1.5, color: 'text.secondary' }} /> {t('createUser.roleUser')}
                                        </Box>
                                    </MenuItem>
                                    <MenuItem value="Admin">
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                            <AdminPanelSettingsOutlined sx={{ mr: 1.5, color: 'text.secondary' }} /> {t('createUser.roleAdmin')}
                                        </Box>
                                    </MenuItem>
                                </Select>
                            </FormControl>

                            {/* Absende-Button */}
                            <LoadingButton
                                type="submit"
                                variant="contained"
                                color="primary"
                                loading={loading}
                                fullWidth
                                size="large"
                                sx={{
                                    mt: 4, // Mehr Abstand nach oben für den Button
                                    py: 1.8, // Etwas höherer Button
                                    fontWeight: 'bold',
                                    letterSpacing: '0.8px', // Leicht erhöhter Buchstabenabstand
                                    borderRadius: 2, // Abgerundete Ecken
                                    boxShadow: theme.shadows[2],
                                    transition: 'background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
                                    '&:hover': {
                                        backgroundColor: theme.palette.primary.dark, // Dunklere Farbe beim Hover
                                        transform: 'translateY(-3px)', // Leichter "Anhebe"-Effekt
                                        boxShadow: theme.shadows[6], // Stärkerer Schatten beim Hover
                                    },
                                    '&:active': {
                                        transform: 'translateY(-1px)', // Leichter "Klick"-Effekt
                                    }
                                }}
                            >
                                {t('createUser.submitButton')}
                            </LoadingButton>
                        </Stack>
                    </CardContent>
                </Paper>
            </Box>
        </Box>
    );
};

export default CreateUser;