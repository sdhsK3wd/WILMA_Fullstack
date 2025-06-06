import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next'; // <-- useTranslation importieren

import {
    Box, AppBar, Toolbar, Typography, CssBaseline, Card, CardContent,
    Button, useTheme, CircularProgress, Avatar, Stack, alpha,
    CardActionArea, ListItemIcon, Paper
} from '@mui/material';

import {
    Assessment as ForecastIcon, AccountCircle as ProfileIcon,
    HowToVote as PollsIcon,
    Group as UserManagementIcon,
    Description as LogsIcon,
    Logout as LogoutIcon,
    WavingHand as WavingHandIcon
} from '@mui/icons-material';

import { motion } from 'framer-motion';
import type { User } from '../context/AuthContext';

// <-- Interface geändert, um Übersetzungsschlüssel zu verwenden
interface HomeCardItem {
    titleKey: string; // Schlüssel statt fester String
    icon: React.ReactElement;
    path?: string;
    action?: () => void;
    descriptionKey: string; // Schlüssel statt fester String
    adminOnly?: boolean;
}

const Homepage: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const theme = useTheme();
    const { t } = useTranslation(); // <-- t Funktion holen

    // <-- Logik für zufällige Begrüßung mit Schlüsseln
    const greetingKeys = ["homepage.greeting.hello", "homepage.greeting.welcome", "homepage.greeting.niceToSeeYou", "homepage.greeting.servus", "homepage.greeting.goodDay"];
    const [randomGreetingKey, setRandomGreetingKey] = useState<string>('homepage.greeting.hello'); // Standardwert oder Ladezustand

    useEffect(() => {
        // Wähle einen zufälligen SCHLÜSSEL bei Komponenten-Mount
        const randomIndex = Math.floor(Math.random() * greetingKeys.length);
        setRandomGreetingKey(greetingKeys[randomIndex]);
    }, []); // Leeres Array bedeutet nur beim ersten Rendern

    const handleLogout = () => {
        logout();
        toast.success(t("homepage.logoutSuccessToast")); // <-- Toast übersetzen
    };

    // <-- cardItems verwenden jetzt Übersetzungsschlüssel
    const cardItems: HomeCardItem[] = [
        { titleKey: 'homepage.card.polls.title', icon: <PollsIcon fontSize="large" />, path: '/polls', descriptionKey: 'homepage.card.polls.description' },
        { titleKey: 'homepage.card.logs.title', icon: <LogsIcon fontSize="large" />, path: '/logs', descriptionKey: 'homepage.card.logs.description', adminOnly: true },
        { titleKey: 'homepage.card.userManagement.title', icon: <UserManagementIcon fontSize="large" />, path: '/user-list', descriptionKey: 'homepage.card.userManagement.description', adminOnly: true },
        { titleKey: 'homepage.card.forecast.title', icon: <ForecastIcon fontSize="large" />, path: '/dashboard', descriptionKey: 'homepage.card.forecast.description' },
        { titleKey: 'homepage.card.profile.title', icon: <ProfileIcon fontSize="large" />, path: '/profile', descriptionKey: 'homepage.card.profile.description' },
        { titleKey: 'homepage.card.logout.title', icon: <LogoutIcon fontSize="large" />, action: handleLogout, descriptionKey: 'homepage.card.logout.description' }
    ];

    // --- Consistent Initial Loading State ---
    if (!user) {
        return (
            <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                bgcolor: 'background.default' // Adapts to theme
            }}>
                {/* Hier könnte man auch einen übersetzten Text anzeigen */}
                <CircularProgress />
            </Box>
        );
    }
    // --- End Initial Loading State ---

    const firstName = user.username?.split(' ')[0] || user.username;
    const flexSpacing = 3;

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <CssBaseline />
            {/* <-- AppBar muss hier möglicherweise auch die gemeinsame Navbar verwenden, wenn sie eine Sidebar hat */}
            {/* Wenn die App-Leiste oben OHNE Sidebar gemeint ist, dann Texte übersetzen */}
            <AppBar
                position="sticky"
                sx={{
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    boxShadow: theme.shadows[1]
                }}
            >
                <Toolbar>
                    <Box sx={{ flexGrow: 1 }} />
                    {/* Hier wird nur der Username/Rolle angezeigt, das ist OK. Wenn "({{user.role}})" übersetzt werden muss,
                        musst du prüfen, ob user.role ein Schlüssel ist oder ob du Rollen-Strings übersetzen musst.
                        Fürs Erste lassen wir das so, da es Benutzerdaten sind.
                    */}
                    <Typography sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>{user.username} ({user.role})</Typography>
                    <Avatar src={user.profileImageUrl || undefined} sx={{ bgcolor: theme.palette.primary.main }}> {user.username?.charAt(0).toUpperCase()} </Avatar>
                </Toolbar>
            </AppBar>

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.background.default,
                    p: { xs: 2, sm: 3, md: 4 },
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 'calc(100vh - 64px)' // Adjust height considering AppBar
                }}
            >
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                    <Typography variant="h3" component="h1" gutterBottom sx={{ textAlign: 'center', fontWeight: 'bold', mt: 0, mb: 2 }}>
                        <WavingHandIcon fontSize="inherit" sx={{ verticalAlign: 'bottom', mr: 1, color: 'primary.main', transform: 'translateY(-2px)' }}/>
                        {/* <-- Begrüßung übersetzen mit zufälligem Schlüssel */}
                        {t(randomGreetingKey)}, {firstName}!
                    </Typography>
                    <Typography variant="h6" color="text.secondary" sx={{ textAlign: 'center', mb: 6 }}>
                        {/* <-- Untertitel übersetzen */}
                        {t('homepage.subtitle')}
                    </Typography>
                </motion.div>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', mx: theme.spacing(-flexSpacing / 2), maxWidth: '1000px', width: '100%' }}>
                    {cardItems.map((item, index) => {
                        // Check user role
                        if (item.adminOnly && user?.role !== 'Admin') {
                            // Du könntest hier stattdessen eine Box mit einem Hinweis oder so rendern,
                            // falls du sie nicht einfach weglassen willst.
                            return null;
                        }
                        return (
                            <Box key={item.titleKey} sx={{ width: { xs: '100%', sm: '50%', md: '33.3333%' }, p: theme.spacing(flexSpacing / 2), display: 'flex', }}>
                                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: index * 0.05 }} style={{ width: '100%', height: '100%' }}>
                                    <Card
                                        elevation={2}
                                        sx={{
                                            width: '100%',
                                            height: '100%',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            borderRadius: 3,
                                            transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
                                            '&:hover': {
                                                transform: 'translateY(-5px)',
                                                boxShadow: theme.shadows[8],
                                            },
                                            bgcolor: 'background.paper'
                                        }}
                                    >
                                        <CardActionArea
                                            sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 3, textAlign: 'center' }}
                                            onClick={item.action ? item.action : () => item.path && navigate(item.path)}
                                            aria-label={t(item.titleKey)} // <-- aria-label übersetzen
                                        >
                                            <ListItemIcon sx={{ justifyContent: 'center', color: 'primary.main', mb: 2 }}>
                                                {/* Sicherstellen, dass Icon-Elemente korrekt geklont werden */}
                                                {React.cloneElement(item.icon, { sx: { ...(item.icon.props.sx || {}), fontSize: 50 } })}
                                            </ListItemIcon>
                                            <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', mb: 1 }}>
                                                {/* <-- Titel übersetzen */}
                                                {t(item.titleKey)}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {/* <-- Beschreibung übersetzen */}
                                                {t(item.descriptionKey)}
                                            </Typography>
                                        </CardActionArea>
                                    </Card>
                                </motion.div>
                            </Box>
                        );
                    })}
                </Box>
            </Box>
        </Box>
    );
};

export default Homepage;