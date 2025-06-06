import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '@mui/material/styles';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { User } from '../context/AuthContext';
import { useTranslation } from 'react-i18next'; // useTranslation importieren

import {
    Box, AppBar, Toolbar, Typography, CssBaseline,
    Stack, alpha, Alert, AlertTitle, Chip, CircularProgress, Paper,
    LinearProgress, Avatar, Select, MenuItem, FormControl, InputLabel, SelectChangeEvent,
    InputAdornment,
    Skeleton, List, ListItem, ListItemText, ListItemIcon, Divider
} from '@mui/material';

import {
    Home as HomeIcon, // Nur in Navbar verwendet
    NotificationsActive as PageIcon, // Für AppBar Icon
    Analytics as AnalyseIcon, // Nur in Navbar verwendet
    ErrorOutline as HighSeverityIcon,
    WarningAmber as MediumSeverityIcon,
    InfoOutlined as LowSeverityIcon,
    CheckCircleOutline as OkStatusIcon,
    FilterList as FilterIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

import ForecastNavbar from './ForecastNavbar'; // Importiere die Navbar

// Interfaces (Behalten)
interface LeakWarning { id: string; location: string; probability: number; timeframe: string; severity: 'high' | 'medium' | 'low'; details?: string; }
interface OperationalSystem { id: string; location: string; statusText: string; lastCheck: string; }
type SeverityFilter = 'all' | 'high' | 'medium' | 'low';

const ForecastStatus: React.FC = () => {
    const [warnings, setWarnings] = useState<LeakWarning[]>([]);
    const [operationalSystems, setOperationalSystems] = useState<OperationalSystem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedSeverity, setSelectedSeverity] = useState<SeverityFilter>('all');

    const { user } = useAuth();
    const theme = useTheme();
    const navigate = useNavigate();
    const { t } = useTranslation(); // <-- t Funktion holen

    useEffect(() => {
        if (user === undefined) return;
        if (user === null) { navigate('/login', { replace: true }); return; }

        const fetchData = async () => {
            setIsLoading(true);
            await new Promise(resolve => setTimeout(resolve, 1200));

            // Dummy Daten (kommen aus Backend, nicht übersetzen)
            const dummyWarnings: LeakWarning[] = [
                { id: 'warn-005', location: 'Transfer Station Z-3', probability: 68, timeframe: 'next 24h', severity: 'high', details: 'Sudden pressure drop recorded.' },
                { id: 'warn-002', location: 'Pipeline Segment K-12', probability: 55, timeframe: 'next 48h', severity: 'high', details: 'Acoustic anomaly detected nearby.' },
                { id: 'warn-001', location: 'M616.F1', probability: 23, timeframe: 'next 72h', severity: 'medium', details: 'Sensor reading fluctuations detected.' },
                { id: 'warn-004', location: 'M508.A9', probability: 35, timeframe: 'next 24-48h', severity: 'medium', details: 'Flow rate inconsistent with pressure readings.' },
                { id: 'warn-003', location: 'Junction P-05', probability: 10, timeframe: 'next 7 days', severity: 'low' },
            ];
            const dummyOperational: OperationalSystem[] = [
                // statusText und lastCheck sind Daten, nicht übersetzen
                { id: 'op-001', location: 'Main Pump Station Alpha', statusText: 'Optimal', lastCheck: 'Just now' },
                { id: 'op-002', location: 'Reservoir Inlet Valve', statusText: 'Operational', lastCheck: '1 hour ago' },
                { id: 'op-003', location: 'Chlorination Unit B', statusText: 'Operational', lastCheck: '3 hours ago' },
            ];

            setWarnings(dummyWarnings.sort((a, b) => {
                const severityOrder = { high: 1, medium: 2, low: 3 };
                const orderA = severityOrder[a.severity] ?? 4;
                const orderB = severityOrder[b.severity] ?? 4;
                return orderA - orderB;
            }));
            setOperationalSystems(dummyOperational);
            setIsLoading(false);
        };
        fetchData();
    }, [user, navigate]);

    const handleSeverityChange = (event: SelectChangeEvent<SeverityFilter>) => { setSelectedSeverity(event.target.value as SeverityFilter); };

    const filteredWarnings = useMemo(() => {
        if (selectedSeverity === 'all') { return warnings; }
        return warnings.filter(warning => warning.severity === selectedSeverity);
    }, [warnings, selectedSeverity]);

    const getSeverityPresentation = useCallback((severity: LeakWarning['severity']): { color: string; icon: React.ReactElement; } => {
        switch (severity) {
            case 'high': return { color: theme.palette.error.main, icon: <HighSeverityIcon sx={{ fontSize: '1.5rem' }} /> };
            case 'medium': return { color: theme.palette.warning.main, icon: <MediumSeverityIcon sx={{ fontSize: '1.5rem' }} /> };
            case 'low': return { color: theme.palette.info.main, icon: <LowSeverityIcon sx={{ fontSize: '1.5rem' }} /> };
            default: return { color: theme.palette.info.main, icon: <LowSeverityIcon sx={{ fontSize: '1.5rem' }} /> };
        }
    }, [theme]);

    const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } };
    const itemVariants = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 }} };

    const renderWarningSkeletons = (count = 3) => ( <Stack spacing={2} sx={{ maxWidth: '1000px', mx: 'auto', mb: 5 }}> {[...Array(count)].map((_, index) => ( <Paper key={`skel-warn-${index}`} elevation={0} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', borderColor: alpha(theme.palette.divider, 0.5), borderLeft: `5px solid ${theme.palette.grey[500]}` }} > <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}> <Skeleton variant="circular" width={30} height={30} /> <Box sx={{ width: '100%' }}> <Skeleton variant="text" height={28} width="60%" sx={{ mb: 0.5 }}/> <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 2 }} alignItems={{ sm: 'center' }} sx={{ mb: 1 }} > <Skeleton variant="text" height={20} width="30%" /> <Skeleton variant="text" height={20} width="40%" /> </Stack> <Skeleton variant="text" height={20} width="80%" /> </Box> </Box> </Paper> ))} </Stack> );
    const renderOperationalSkeletons = (count = 3) => ( <> <Skeleton variant="text" height={30} width="30%" sx={{ mb: 1.5, mt: 5, maxWidth: '1000px', mx: 'auto' }} /> <Paper variant='outlined' sx={{ maxWidth: '1000px', mx: 'auto', p:1, borderRadius: 2, borderColor: alpha(theme.palette.divider, 0.5) }}> <List disablePadding> {[...Array(count)].map((_, index) => ( <React.Fragment key={`skel-op-${index}`}> <ListItem> <ListItemIcon sx={{ minWidth: 40 }}> <Skeleton variant="circular" width={24} height={24} /> </ListItemIcon> <ListItemText primary={<Skeleton variant="text" width="40%" height={20}/>} secondary={<Skeleton variant="text" width="60%" height={18}/>} /> </ListItem> {index < count - 1 && <Divider variant="inset" component="li" sx={{ borderColor: alpha(theme.palette.divider, 0.3) }}/>} </React.Fragment> ))} </List> </Paper> </> );


    // --- Rendering Logic ---
    if (user === undefined) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default' }}><CircularProgress /></Box>
        );
    }
    if (user === null) {
        navigate('/login', { replace: true });
        return null;
    }


    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            {/* Navbar verwenden */}
            <ForecastNavbar />
            {/* AppBar */}
            <AppBar position="fixed" sx={{ width: '100%', zIndex: theme.zIndex.drawer + 1, bgcolor: alpha(theme.palette.background.paper, 0.8), backdropFilter: 'blur(8px)', color: 'text.primary', boxShadow: theme.shadows[1], borderBottom: `1px solid ${theme.palette.divider}` }} >
                <Toolbar>
                    <PageIcon sx={{ mr: 1.5, color: 'primary.main' }} />
                    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}> {t('status.appBarTitle')} </Typography>
                    {user && ( <Typography sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}> {user.username} ({user.role}) </Typography> )}
                    <Avatar src={user?.profileImageUrl || undefined} sx={{ bgcolor: theme.palette.primary.main }}> {user?.username?.charAt(0).toUpperCase()} </Avatar>
                </Toolbar>
            </AppBar>

            {/* Main Content Area */}
            <Box component="main" sx={{ flexGrow: 1, bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.background.default, minHeight: '100vh' }} >
                <Toolbar /> {/* Spacer für fixed AppBar */}
                <Box sx={{ p: { xs: 2, md: 3 } }}>
                    {/* Seiten Titel und Filter */}
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
                        <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold' }}> {t('status.pageTitle')} </Typography>
                        {/* Severity Filter */}
                        <FormControl sx={{ minWidth: 180 }} size="small">
                            <InputLabel id="severity-filter-label">{t('status.filters.severityLabel')}</InputLabel>
                            <Select labelId="severity-filter-label" value={selectedSeverity} label={t('status.filters.severityLabel')} onChange={handleSeverityChange} startAdornment={<InputAdornment position="start"><FilterIcon color="action" /></InputAdornment>} sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(theme.palette.divider, 0.5) } }} >
                                <MenuItem value="all">{t('status.filters.severityAll')}</MenuItem>
                                <MenuItem value="high">{t('status.filters.severityHigh')}</MenuItem>
                                <MenuItem value="medium">{t('status.filters.severityMedium')}</MenuItem>
                                <MenuItem value="low">{t('status.filters.severityLow')}</MenuItem>
                            </Select>
                        </FormControl>
                    </Stack>

                    {/* Warnungen und Status Anzeigen */}
                    <AnimatePresence mode="wait">
                        {isLoading ? (
                            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                {renderWarningSkeletons()}
                                {renderOperationalSkeletons()}
                            </motion.div>
                        ) : (
                            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                {/* Meldung, wenn Warnungen gefiltert sind, aber keine gefunden */}
                                {filteredWarnings.length === 0 && selectedSeverity !== 'all' && (
                                    <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', mb: 3, bgcolor: alpha(theme.palette.background.paper, 0.5), borderColor: alpha(theme.palette.divider, 0.5), borderRadius: 2 }}>
                                        <Typography color="text.secondary"> {t('status.noWarningsFoundForSeverity', { severity: selectedSeverity })} </Typography>
                                    </Paper>
                                )}
                                {/* Meldung, wenn KEINE Warnungen vorhanden sind (im All-Filter) */}
                                {warnings.length === 0 && selectedSeverity === 'all' && (
                                    <Paper variant="outlined" sx={{ p: 3, textAlign: 'center', mb: 3, bgcolor: alpha(theme.palette.background.paper, 0.5), borderColor: alpha(theme.palette.divider, 0.5), borderRadius: 2 }}>
                                        <OkStatusIcon sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                                        <Typography color="text.secondary"> {t('status.noWarningsDetected')} </Typography>
                                    </Paper>
                                )}

                                {/* Liste der Warnungen */}
                                {warnings.length > 0 && (
                                    <Stack spacing={2} sx={{ maxWidth: '1000px', mx: 'auto', mb: 5 }} component={motion.div} variants={containerVariants} initial="hidden" animate="visible">
                                        {filteredWarnings.map((warning) => {
                                            const severityUI = getSeverityPresentation(warning.severity);
                                            return (
                                                <motion.div key={warning.id} variants={itemVariants}>
                                                    <Paper elevation={0} variant="outlined" sx={{ borderLeft: `5px solid ${severityUI.color}`, borderRadius: 2, overflow: 'hidden', borderColor: alpha(theme.palette.divider, 0.5) }}>
                                                        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                                                            <Box sx={{ color: severityUI.color, lineHeight: 0, mt: '2px' }}>{severityUI.icon}</Box>
                                                            <Box sx={{ width: '100%' }}>
                                                                <Typography variant="h6" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                                                                    {warning.location}
                                                                    <Chip label={`${t(`status.severity.${warning.severity}` as any)?.toUpperCase()} ${t('status.warning.riskSuffix')}`} size="small" sx={{ ml: 1.5, bgcolor: alpha(severityUI.color, 0.15), color: theme.palette.mode === 'dark' ? severityUI.color : theme.palette.getContrastText(alpha(severityUI.color, 0.15)), fontWeight: 'medium', border: 'none', height: '20px', fontSize: '0.7rem', textTransform: 'uppercase' }} />
                                                                </Typography>
                                                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 2 }} alignItems={{ sm: 'center' }} sx={{ mb: warning.details ? 1 : 0 }} flexWrap="wrap" >
                                                                    <Chip label={`${warning.probability}% ${t('status.warning.probabilitySuffix')}`} size="small" variant="outlined" sx={{ color: 'text.secondary', borderColor: alpha(theme.palette.divider, 0.5), fontWeight: 'regular', }} />
                                                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}> {t('status.warning.timeframePrefix')}: {warning.timeframe} </Typography>
                                                                </Stack>
                                                                {warning.details && ( <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5, pl: '2px' }}> {warning.details} </Typography> )}
                                                            </Box>
                                                        </Box>
                                                    </Paper>
                                                </motion.div>
                                            );
                                        })}
                                    </Stack>
                                )}

                                {operationalSystems.length > 0 && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 'medium', mb: 1.5, mt: warnings.length > 0 ? 5 : 0, maxWidth: '1000px', mx: 'auto' }}>
                                            {t('status.operationalSystems.title')}
                                        </Typography>
                                        <Paper variant='outlined' sx={{ maxWidth: '1000px', mx: 'auto', p:1, borderRadius: 2, borderColor: alpha(theme.palette.divider, 0.5) }}>
                                            <List disablePadding>
                                                {operationalSystems.map((sys, index) => (
                                                    <React.Fragment key={sys.id}>
                                                        <ListItem>
                                                            <ListItemIcon sx={{ minWidth: 40, color: theme.palette.success.main }}> <OkStatusIcon /> </ListItemIcon>
                                                            <ListItemText primary={sys.location} secondary={`${t('status.operationalSystems.statusPrefix')}: ${sys.statusText} (${t('status.operationalSystems.lastCheckPrefix')}: ${sys.lastCheck})`} primaryTypographyProps={{ fontWeight: 'medium' }} secondaryTypographyProps={{ color: 'text.secondary' }} />
                                                        </ListItem>
                                                        {index < operationalSystems.length - 1 && <Divider variant="inset" component="li" sx={{ borderColor: alpha(theme.palette.divider, 0.3) }}/>}
                                                    </React.Fragment>
                                                ))}
                                            </List>
                                        </Paper>
                                    </motion.div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Box>
            </Box>
        </Box>
    );
};

export default ForecastStatus;