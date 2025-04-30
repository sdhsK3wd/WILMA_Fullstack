import React, { useState, useEffect } from 'react';
import axios from '../api/axiosInstance';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import logo from '../images/Logo.png'; // Dein GWT Logo - Geht davon aus, dass 'images' relativ hier ist
import API_BASE_URL from '../apiConfig';
import type { AxiosError } from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

// --- MUI Imports ---
// Grid wurde entfernt
import {
    Box,
    Card,
    Typography,
    TextField,
    Link,
    IconButton,
    InputAdornment,
    FormControl,
    InputLabel,
    OutlinedInput,
    // Grid, // Nicht mehr benötigt
    useTheme,
    useMediaQuery
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import { Visibility, VisibilityOff } from '@mui/icons-material';

// --- Framer Motion Import ---
import { motion } from 'framer-motion';

// --- HINTERGRUNDBILDER ---
// Importiere die Bilder direkt - Passe die Pfade an, falls dein 'images'-Ordner woanders liegt!
import bgImage1 from '../images/sign-in-image-1.jpg'; // Stimmt "sing-in..."? Oder "sign-in..."? Oder ganz anders?
import bgImage2 from '../images/sign-in-image-2.jpg'; // Stimmt dieser Name exakt?
import bgImage3 from '../images/sign-in-image-3.jpg'; // Stimmt dieser Name exakt?

// Verwende die importierten Variablen im Array
const backgroundImages = [bgImage1, bgImage2, bgImage3];
// --- ENDE HINTERGRUNDBILDER ---

const SignIn: React.FC = () => {
    // --- States ---
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [currentBgIndex, setCurrentBgIndex] = useState(0);

    // --- Hooks ---
    const navigate = useNavigate();
    const location = useLocation();
    const { login, isAuthenticated } = useAuth();
    const theme = useTheme();
    const isMdUp = useMediaQuery(theme.breakpoints.up('md'));

    // --- Effekte ---
    // Timer für Hintergrundwechsel
    useEffect(() => {
        const intervalId = setInterval(() => {
            setCurrentBgIndex((prevIndex) => (prevIndex + 1) % backgroundImages.length);
        }, 5000);
        return () => clearInterval(intervalId);
    }, []);

    // Redirect wenn bereits eingeloggt
    useEffect(() => {
        if (isAuthenticated && location.pathname === "/login") {
            navigate("/home", { replace: true });
        }
    }, [isAuthenticated, navigate, location.pathname]);

    // --- Handler ---
    const handleLogin = async () => {
        if (!email || !password) {
            toast.error("Bitte fülle alle Felder aus!");
            return;
        }
        setLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/users/login`, { email, password });
            const updatedUser = { /* ...deine User-Daten... */
                id: response.data.id, username: response.data.username, email: response.data.email,
                role: response.data.role, phoneNumber: response.data.phoneNumber, location: response.data.location,
                profileImageUrl: response.data.profileImageUrl, token: response.data.token, refreshToken: response.data.refreshToken
            };
            login(updatedUser);
            toast.success("Login erfolgreich!");
            navigate("/home", { replace: true });
        } catch (error) {
            const err = error as AxiosError<{ message?: string }>;
            toast.error(err.response?.data?.message || "Login fehlgeschlagen");
        } finally {
            setLoading(false);
        }
    };
    const handleClickShowPassword = () => setShowPassword((show) => !show);
    const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => { event.preventDefault(); };
    // --- Ende Handler ---


    return (
        // Äußerer Container für Seite und Hintergrund-Layer
        <Box
            sx={{
                position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: '100vh', overflow: 'hidden', padding: 2,
            }}
        >
            {/* --- Hintergrund-Slideshow Layer (unverändert) --- */}
            {backgroundImages.map((imgUrl, index) => (
                <Box
                    key={index}
                    sx={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        backgroundImage: `url(${imgUrl})`, // Nutzt jetzt importierte Variable
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        zIndex: -1, opacity: index === currentBgIndex ? 1 : 0,
                        transition: 'opacity 1.2s ease-in-out',
                    }}
                />
            ))}
            {/* --- Ende Slideshow Layer --- */}


            {/* Login Card (mit motion.div) */}
            <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }} style={{zIndex: 1}}
            >
                <Card
                    elevation={8}
                    sx={{
                        maxWidth: 900, width: '100%', borderRadius: 4, overflow: 'hidden',
                        // Wichtig: display: 'flex' wird jetzt HIER gesetzt für die Spalten
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' }, // Spalten auf Desktop, Zeilen auf Mobile
                        backgroundColor: 'background.paper',
                    }}
                >
                    {/* --- Grid wurde durch Box ersetzt --- */}
                    {/* Linke Spalte (Branding) als Box */}
                    <Box
                        sx={{
                            display: { xs: 'none', md: 'flex' }, // Nur auf Desktop sichtbar
                            flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                            padding: 6, color: theme.palette.primary.dark,
                            width: { md: '40%' }, // Breite der linken Spalte (anpassen nach Bedarf)
                            // Statt 'md={5}' (was ~41.6% war)
                        }}
                    >
                        <motion.div whileHover={{ scale: 1.05 }} transition={{ type: "spring", stiffness: 300 }}>
                            <Box component="img" src={logo} alt="GWT Logo" sx={{ width: 150, height: 'auto', marginBottom: 3 }} />
                        </motion.div>
                        <Typography variant="h6" component="p" align="center" sx={{ mb: 1 }}>
                            Wasserversorgungstechnik
                        </Typography>
                        <Typography variant="body2" align="center" sx={{ opacity: 0.8 }}>
                            Ihr Partner für klares Wasser.
                        </Typography>
                    </Box>

                    {/* --- Grid wurde durch Box ersetzt --- */}
                    {/* Rechte Spalte (Formular) als Box */}
                    <Box
                        sx={{
                            display: 'flex', flexDirection: 'column', justifyContent: 'center',
                            padding: { xs: 3, sm: 4, md: 6 },
                            width: { xs: '100%', md: '60%' }, // Breite der rechten Spalte
                            // Statt 'md={7}' (was ~58.3% war)
                        }}
                    >
                        {/* Logo für mobile Ansicht */}
                        <Box component="img" src={logo} alt="GWT Logo" sx={{ width: 80, height: 'auto', mb: 2, alignSelf: 'center', display: { xs: 'block', md: 'none' } }} />

                        <Typography component="h1" variant="h4" sx={{ mb: 3, fontWeight: 'bold', textAlign: 'center' }}>
                            Willkommen zurück!
                        </Typography>

                        {/* Formular */}
                        <Box component="form" onSubmit={(e) => { e.preventDefault(); handleLogin(); }} sx={{ width: '100%' }}>
                            <TextField /* ...props... */
                                margin="normal" required fullWidth id="email" label="Email Addresse" name="email"
                                autoComplete="email" autoFocus={!isMdUp} value={email}
                                onChange={(e) => setEmail(e.target.value)} disabled={loading}
                                sx={{ '& .MuiOutlinedInput-root': { '&:hover fieldset': { borderColor: theme.palette.primary.light, }, '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, }, }, }}
                            />
                            <FormControl margin="normal" required fullWidth variant="outlined" disabled={loading}>
                                <InputLabel htmlFor="outlined-adornment-password">Passwort</InputLabel>
                                <OutlinedInput /* ...props... */
                                    id="outlined-adornment-password" type={showPassword ? 'text' : 'password'} value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    endAdornment={ <InputAdornment position="end"> <IconButton aria-label="toggle password visibility" onClick={handleClickShowPassword} onMouseDown={handleMouseDownPassword} edge="end"> {showPassword ? <VisibilityOff /> : <Visibility />} </IconButton> </InputAdornment> }
                                    label="Passwort"
                                    sx={{ '&:hover fieldset': { borderColor: theme.palette.primary.light, }, '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, }, }}
                                />
                            </FormControl>
                            <LoadingButton /* ...props... */
                                type="submit" fullWidth variant="contained" color="primary" loading={loading}
                                sx={{ mt: 4, mb: 2, py: 1.5, fontSize: '1rem', fontWeight: 'bold', borderRadius: 2, transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out', '&:hover': { transform: 'scale(1.03)', boxShadow: theme.shadows[4], } }}
                            >
                                Login
                            </LoadingButton>
                            <Box sx={{ textAlign: 'center', mt: 2 }}>
                                <Link component={RouterLink} to="/forgot-password" variant="body2" sx={{ fontWeight: 'medium' }}>
                                    Passwort vergessen?
                                </Link>
                            </Box>
                        </Box> {/* Ende Formular Box */}
                    </Box> {/* Ende Rechte Spalte Box */}
                </Card> {/* Ende Card */}
            </motion.div> {/* Ende motion.div */}
        </Box> // Ende äußerer Container
    );
};

export default SignIn;