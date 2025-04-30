import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// --- MUI Imports ---
import {
    Box, AppBar, Toolbar, Typography, CssBaseline, Card, CardContent,
    Button, useTheme, CircularProgress, Avatar, Stack, alpha,
    CardActionArea, ListItemIcon
} from '@mui/material';
// Kein Grid Import mehr benötigt, Flexbox wird verwendet

// --- Icons für die Karten & Header ---
import {
    Assessment as ForecastIcon, AccountCircle as ProfileIcon,
    // NEU: HowToVoteIcon für Abstimmungen
    HowToVote as PollsIcon,
    Group as UserManagementIcon,
    Notifications as NotificationsIcon, Logout as LogoutIcon,
    WavingHand as WavingHandIcon
} from '@mui/icons-material';

// --- Bild-Import für Logo (für Header Fallback) ---
import logo from '../images/Logo.png';

// --- Framer Motion Import ---
import { motion } from 'framer-motion';

// Interface für die Navigationskarten
interface HomeCardItem {
    title: string;
    icon: React.ReactElement;
    path?: string;
    action?: () => void;
    description: string;
    adminOnly?: boolean;
}

const Homepage: React.FC = () => {
    // --- States ---
    const [greeting, setGreeting] = useState<string>("Hallo");

    // --- Hooks ---
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const theme = useTheme();

    // --- Effekt für zufälligen Willkommensgruß ---
    useEffect(() => {
        const greetings = ["Hallo", "Willkommen", "Schön dich zu sehen", "Servus", "Guten Tag"];
        const randomIndex = Math.floor(Math.random() * greetings.length);
        setGreeting(greetings[randomIndex]);
    }, []);

    // --- Logout Handler ---
    const handleLogout = () => {
        logout();
        navigate('/login');
        toast.success("Erfolgreich ausgeloggt.");
    };

    // --- Definition der Karten-Elemente (Angepasst) ---
    const cardItems: HomeCardItem[] = [
        { title: 'Forecast & Daten', icon: <ForecastIcon fontSize="large" />, path: '/dashboard', description: 'Vorhersagen analysieren & Daten hochladen.' },
        { title: 'Profil', icon: <ProfileIcon fontSize="large" />, path: '/profile', description: 'Deine persönlichen Daten verwalten.' },
        // *** Änderung hier: Abstimmungen statt Kalender ***
        { title: 'Abstimmungen', icon: <PollsIcon fontSize="large" />, path: '/polls', description: 'An Umfragen teilnehmen oder erstellen.' },
        { title: 'Benutzerverwaltung', icon: <UserManagementIcon fontSize="large" />, path: '/user-list', description: 'Benutzerkonten anzeigen & verwalten.', adminOnly: true },
        { title: 'Meldungen', icon: <NotificationsIcon fontSize="large" />, path: '/notifications', description: 'System-Warnungen & Benachrichtigungen.' }, // Pfad anpassen
        { title: 'Logout', icon: <LogoutIcon fontSize="large" />, action: handleLogout, description: 'Sicher von der Anwendung abmelden.' },
    ];

    // --- Rendering ---
    if (!user) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
    }

    const firstName = user.username?.split(' ')[0] || user.username;
    const flexSpacing = 3; // Für Flexbox-Layout

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <CssBaseline />
            <AppBar position="sticky" sx={{ backgroundColor: 'white', color: theme.palette.text.primary, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <Toolbar>
                    <Box sx={{ flexGrow: 1 }} />
                    <Typography sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>{user.username} ({user.role})</Typography>
                    <Avatar src={user.profileImageUrl || undefined} sx={{ bgcolor: theme.palette.primary.main }}> {user.username?.charAt(0).toUpperCase()} </Avatar>
                </Toolbar>
            </AppBar>

            {/* Haupt-Inhaltsbereich */}
            <Box component="main" sx={{ flexGrow: 1, background: `linear-gradient(180deg, ${alpha(theme.palette.primary.light, 0.05)} 0%, ${theme.palette.background.default} 40%)`, p: { xs: 2, sm: 3, md: 4 }, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', }}>
                {/* Willkommensnachricht */}
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <Typography variant="h3" component="h1" gutterBottom sx={{ textAlign: 'center', fontWeight: 'bold', mt: 4, mb: 2 }}>
                        <WavingHandIcon fontSize="large" sx={{ verticalAlign: 'middle', mr: 1, color: 'primary.main' }}/> {greeting}, {firstName}!
                    </Typography>
                    <Typography variant="h6" color="text.secondary" sx={{ textAlign: 'center', mb: 6 }}>
                        Wähle einen Bereich, um fortzufahren.
                    </Typography>
                </motion.div>

                {/* --- Karten Layout mit Flexbox --- */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', mx: theme.spacing(-flexSpacing / 2), maxWidth: '1000px', width: '100%' }}>
                    {cardItems.map((item, index) => {
                        if (item.adminOnly && user?.role !== 'Admin') { return null; }
                        return (
                            <Box key={item.title} sx={{ width: { xs: '100%', sm: '50%', md: '33.3333%' }, p: theme.spacing(flexSpacing / 2), display: 'flex', }}>
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: index * 0.05 }} style={{ width: '100%', height: '100%' }}>
                                    <Card elevation={4} sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 3, transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out', '&:hover': { transform: 'translateY(-5px) scale(1.02)', boxShadow: theme.shadows[12], }, }}>
                                        <CardActionArea sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 3, textAlign: 'center' }} onClick={item.action ? item.action : () => item.path && navigate(item.path)} aria-label={item.title}>
                                            <ListItemIcon sx={{ justifyContent: 'center', color: 'primary.main', mb: 2 }}> {React.cloneElement(item.icon, { sx: { fontSize: 50 } })} </ListItemIcon>
                                            <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', mb: 1 }}> {item.title} </Typography>
                                            <Typography variant="body2" color="text.secondary"> {item.description} </Typography>
                                        </CardActionArea>
                                    </Card>
                                </motion.div>
                            </Box>
                        );
                    })}
                </Box> {/* Ende Flexbox-Karten Layout */}
            </Box> {/* Ende Haupt-Inhaltsbereich */}
        </Box> // Ende Haupt-Container
    );
};

export default Homepage;
