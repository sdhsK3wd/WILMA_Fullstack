import React, { useState, useEffect } from 'react';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../context/ThemeContext';
import { useTranslation } from 'react-i18next';

import {
    Box, AppBar, Toolbar, Typography, CssBaseline, ListSubheader,
    Button, CircularProgress, Avatar, Drawer, List, ListItem,
    ListItemText, ListItemButton, ListItemIcon, Divider, Stack, alpha, Switch, Paper,
    ToggleButton, ToggleButtonGroup, Tooltip,
    Skeleton,
    IconButton
} from '@mui/material';

import {
    Home as HomeIcon,
    AccountCircle as ProfileIcon,
    Settings as SettingsIcon,
    Brightness4 as DarkModeIcon,
    Brightness7 as LightModeIcon,
    Language as LanguageIcon,
    VpnKeyOutlined,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

import ProfileNavbar from './ProfileNavbar';

const flagDePath = '/src/assets/de.svg';
const flagEnPath = '/src/assets/en.svg';

const Settings: React.FC = () => {
    const { user } = useAuth();
    const theme = useMuiTheme();
    const navigate = useNavigate();
    const { mode, toggleColorMode } = useAppTheme();
    const { t, i18n } = useTranslation();
    const currentLanguage = i18n.language.split('-')[0];

    const [isLoadingSettings, setIsLoadingSettings] = useState<boolean>(true);

    useEffect(() => {
        setIsLoadingSettings(true);
        if (user === undefined) return;
        if (user === null) {
            navigate('/login', { replace: true });
            setIsLoadingSettings(false);
            return;
        }
        const timer = setTimeout(() => {
            setIsLoadingSettings(false);
        }, 150);
        return () => clearTimeout(timer);

    }, [user, navigate]);

    const handleLanguageChange = (event: React.MouseEvent<HTMLElement>, newLanguage: 'de' | 'en' | null,) => {
        if (newLanguage !== null && newLanguage !== currentLanguage) {
            i18n.changeLanguage(newLanguage);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 15 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4 }}
    };

    const iconVariants = {
        initial: { opacity: 0, rotate: -90, scale: 0.5 },
        animate: { opacity: 1, rotate: 0, scale: 1, transition: { duration: 0.3, ease: 'easeOut' } },
        exit: { opacity: 0, rotate: 90, scale: 0.5, transition: { duration: 0.3, ease: 'easeIn' } }
    };

    if (user === undefined) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default' }}><CircularProgress /></Box>;
    }

    const renderSettingsContent = () => (
        <Stack spacing={3} component={motion.div} variants={containerVariants} initial="hidden" animate="visible">
            <motion.div variants={itemVariants}>
                <Paper elevation={0} variant="outlined" sx={{ p: {xs: 2, sm: 2.5}, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.5) }} >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} flexWrap="wrap">
                        <Box>
                            <Typography id="theme-label" variant="h6" component="div" gutterBottom sx={{ fontWeight: 'medium' }}>{t('darkMode')}</Typography>
                            {/* ANGEPASST: whiteSpace, overflow, textOverflow für einzeilige Anzeige */}
                            <Typography variant="body2" color="text.secondary"
                                        sx={{
                                            maxWidth: '350px',
                                            textAlign: 'left',
                                            whiteSpace: 'nowrap', // Verhindert Zeilenumbruch
                                            overflow: 'hidden',    // Schneidet Inhalt ab, der überläuft
                                            textOverflow: 'ellipsis' // Fügt '...' hinzu, wenn Text abgeschnitten wird
                                        }}>
                                {t('themeDesc')}
                            </Typography>
                        </Box>
                        <Tooltip title={mode === 'dark' ? t("settings.themeTooltipLight") : t("settings.themeTooltipDark")} placement="left">
                            <IconButton onClick={toggleColorMode} color="primary" aria-label={mode === 'dark' ? t("settings.themeTooltipLight") : t("settings.themeTooltipDark")} sx={{ width: 42, height: 42 }} >
                                <AnimatePresence mode="wait" initial={false}>
                                    {mode === 'dark' ? ( <motion.div key="moon" variants={iconVariants} initial="initial" animate="animate" exit="exit" > <DarkModeIcon sx={{ color: theme.palette.grey[400] }}/> </motion.div> )
                                        : ( <motion.div key="sun" variants={iconVariants} initial="initial" animate="animate" exit="exit" > <LightModeIcon sx={{ color: theme.palette.warning.main }}/> </motion.div> )}
                                </AnimatePresence>
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Paper>
            </motion.div>

            <motion.div variants={itemVariants}>
                <Paper elevation={0} variant="outlined" sx={{ p: {xs: 2, sm: 2.5}, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.5) }} >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} flexWrap="wrap">
                        <Box sx={{ mb: {xs: 1.5, sm: 0 }}}>
                            <Typography id="lang-label" variant="h6" component="div" gutterBottom sx={{ fontWeight: 'medium' }}>{t('language')}</Typography>
                            {/* ANGEPASST: whiteSpace, overflow, textOverflow für einzeilige Anzeige */}
                            <Typography variant="body2" color="text.secondary"
                                        sx={{
                                            maxWidth: '350px',
                                            textAlign: 'left',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                {t('langDesc')}
                            </Typography>
                        </Box>
                        <ToggleButtonGroup value={currentLanguage} exclusive onChange={handleLanguageChange} aria-labelledby="lang-label" size="medium" color="primary" >
                            <ToggleButton value="de" aria-label={t("settings.langButtonGerman")} sx={{ px: 2, py: 1, textTransform: 'none', lineHeight: 'normal' }}>
                                <Avatar variant="rounded" alt={t("settings.langAltDe")} src={flagDePath} sx={{ width: 22, height: 16, mr: 1, borderRadius: '2px' }} /> DE
                            </ToggleButton>
                            <ToggleButton value="en" aria-label={t("settings.langButtonEnglish")} sx={{ px: 2, py: 1, textTransform: 'none', lineHeight: 'normal' }}>
                                <Avatar variant="rounded" alt={t("settings.langAltEn")} src={flagEnPath} sx={{ width: 22, height: 16, mr: 1, borderRadius: '2px' }} /> EN
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </Stack>
                </Paper>
            </motion.div>

            <motion.div variants={itemVariants}>
                <Paper elevation={0} variant="outlined" sx={{ p: {xs: 2, sm: 2.5}, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.5) }} >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                        <Box>
                            <Typography variant="h6" component="div" gutterBottom sx={{ fontWeight: 'medium' }}>
                                <VpnKeyOutlined fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }}/>
                                {t('settings.account.title')}
                            </Typography>
                            {/* ANGEPASST: whiteSpace, overflow, textOverflow für einzeilige Anzeige */}
                            <Typography variant="body2" color="text.secondary"
                                        sx={{
                                            maxWidth: '350px',
                                            textAlign: 'left',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                {t('settings.account.description')}
                            </Typography>
                        </Box>
                        <Button size="small" variant="text" component={RouterLink} to="/forgot-password">
                            {t('settings.account.button')}
                        </Button>
                    </Stack>
                </Paper>
            </motion.div>
        </Stack>
    );

    const renderSkeletons = () => (
        <Stack spacing={3}>
            {[1, 2].map(i => (
                <Paper key={`load-${i}`} elevation={0} variant="outlined" sx={{ p: {xs: 2, sm: 2.5}, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.5) }} >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                        <Box sx={{ width: '70%'}}>
                            <Skeleton variant="text" height={30} width="40%" sx={{ mb: 1 }}/>
                            <Skeleton variant="text" height={20} width="90%" />
                        </Box>
                        <Skeleton variant={i === 1 ? "circular" : "rectangular"} width={i === 1 ? 42 : 120} height={i === 1 ? 42 : 36} sx={{ borderRadius: i === 1 ? '50%' : 1 }}/>
                    </Stack>
                </Paper>
            ))}
            <Paper key="ph-load-1" elevation={0} variant="outlined" sx={{ p: {xs: 2, sm: 2.5}, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.5) }} >
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                    <Box sx={{ width: '70%'}}>
                        <Skeleton variant="text" height={30} width="45%" sx={{ mb: 1 }}/>
                        <Skeleton variant="text" height={20} width="85%" />
                    </Box>
                    <Skeleton variant="text" width={80} height={30} sx={{ borderRadius: 1 }} />
                </Stack>
            </Paper>
        </Stack>
    );

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            <ProfileNavbar />

            <Box component="main" sx={{ flexGrow: 1, bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.background.default, minHeight: '100vh' }} >
                <AppBar position="fixed" sx={{ width: '100%', zIndex: theme.zIndex.drawer + 1, bgcolor: alpha(theme.palette.background.paper, 0.8), backdropFilter: 'blur(8px)', color: theme.palette.text.primary, boxShadow: theme.shadows[1], borderBottom: `1px solid ${theme.palette.divider}` }} >
                    <Toolbar>
                        <SettingsIcon sx={{ mr: 1.5, color: 'primary.main' }} />
                        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                            {t('settingsTitle')}
                        </Typography>
                        {user && ( <Typography sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}> {user.username} ({user.role}) </Typography> )}
                        <Avatar src={user?.profileImageUrl || undefined} sx={{ bgcolor: theme.palette.primary.main }}> {user?.username?.charAt(0).toUpperCase()} </Avatar>
                    </Toolbar>
                </AppBar>
                <Toolbar />

                <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: '800px', mx: 'auto' }}>
                    <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 4 }}>
                        {t('settings.pageTitle')}
                    </Typography>
                    <AnimatePresence mode="wait">
                        {isLoadingSettings ? renderSkeletons() : renderSettingsContent()}
                    </AnimatePresence>
                </Box>
            </Box>
        </Box>
    );
};

export default Settings;