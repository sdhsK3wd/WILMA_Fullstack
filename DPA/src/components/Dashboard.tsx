import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import axios from 'axios';
import axiosStatic from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL_KI } from '../apiConfigKI';

// --- MUI Imports ---
import {
    Box, AppBar, Toolbar, Typography, CssBaseline, Card, CardContent, CardHeader,
    Button, useTheme, CircularProgress, Avatar, Drawer, List, ListItem,
    ListItemText, ListItemButton, ListItemIcon, Divider, Stack, alpha,
    Select, MenuItem, FormControl, InputLabel, Paper, InputAdornment, ListSubheader, SelectChangeEvent
    // Palette nicht benötigt
} from '@mui/material';

// --- Recharts Imports ---
import {
    LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, Legend, Brush, ReferenceArea, ReferenceLine, Label, TooltipProps // TooltipProps importieren
} from 'recharts';
// Importiere Typen für Tooltip Props
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';


// --- Date-fns Import ---
// addDays nicht benötigt
import { parseISO, isAfter, isValid, format, addHours } from 'date-fns';

// --- Icons für Navbar & Header ---
import {
    Home as HomeIcon,
    UploadFile as UploadFileIcon,
    Analytics as AnalyseIcon,
    ModelTraining as ModelIcon,
    ShowChart as ChartIcon,
    Water as WaterIcon
} from '@mui/icons-material';

// --- Bild-Import für Logo ---
import logo from '../images/Logo.png';

// --- Navbar Komponente (ForecastNavbar) ---
const drawerWidth = 240;
interface ForecastNavItem { text: string; icon: React.ReactElement; path: string; }
const ForecastNavbar: React.FC = () => {
    const location = useLocation();
    const theme = useTheme();
    const navItems: ForecastNavItem[] = [ { text: 'Analyse', icon: <AnalyseIcon />, path: '/dashboard' }, ];

    return (
        <Drawer variant="permanent" sx={{ width: drawerWidth, flexShrink: 0, [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box', borderRight: `1px solid ${theme.palette.divider}` }, }}>
            <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1 }}> <img src={logo} alt="GWT Logo" style={{ height: 40, width: 'auto' }} /> </Toolbar>
            <Divider />
            <List sx={{ padding: 1 }}>
                <ListItem disablePadding sx={{ mb: 0.5 }}> <ListItemButton component={RouterLink} to="/home" sx={{ borderRadius: 1, '&:hover': { backgroundColor: theme.palette.action.hover, } }}> <ListItemIcon sx={{ minWidth: 40 }}> <HomeIcon /> </ListItemIcon> <ListItemText primary="Home" /> </ListItemButton> </ListItem>
                <Divider sx={{ my: 1 }}/>
                <ListSubheader sx={{ bgcolor: 'transparent', fontWeight: 'bold', color: 'text.primary' }}> Forecast </ListSubheader>
                {navItems.map((item) => { const isSelected = location.pathname === item.path; return ( <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}> <ListItemButton component={RouterLink} to={item.path} selected={isSelected} sx={{ borderRadius: 1, '&.Mui-selected': { backgroundColor: alpha(theme.palette.primary.light, 0.12), '&:hover': { backgroundColor: alpha(theme.palette.primary.light, 0.18), }, '& .MuiListItemIcon-root, & .MuiListItemText-primary': { color: theme.palette.primary.dark, fontWeight: 600, }, }, '&:hover': { backgroundColor: theme.palette.action.hover, } }}> <ListItemIcon sx={{ minWidth: 40, color: isSelected ? theme.palette.primary.dark : 'inherit' }}> {item.icon} </ListItemIcon> <ListItemText primary={item.text} /> </ListItemButton> </ListItem> ); })}
            </List>
        </Drawer>
    );
};
// --- Ende ForecastNavbar Komponente ---

// Interface für die Chart-Daten & Typen
interface ChartDataPoint { date: string; actual?: number | null; forecast?: number | null; isFuture?: boolean; }
type ForecastDuration = '1d' | '7d' | '30d' | '90d';
type ForecastModel = 'prophet' | 'tensorflow';
const waterContainers = [ "HB/DST Kleinhadersdorf (M616.F1)", "DST Kleinhadersdorf (M960.F1)", "Ortsnetz Poysdorf (M617.F1)", "Zulauf HB Poysdorf (M100.F1)", "Ablauf HB Poysdorf (M130.F1)", "DST Poysdorf (M150.F1)", "Zulauf v. Poysdorf HB Poysbrunn (M320.F1)", "Zulauf v. Bru. HB Poysbrunn (M310.F1)", "Ablauf HB Poysbrunn (M230.F1)", "Brunnen 3 Poysbrunn (M950.F1)" ];
const FORECAST_START_ISO_DATE = "2025-01-01T00:00:00Z";


// --- Dashboard Komponente ---
const Dashboard: React.FC = () => {
    // --- States ---
    const [selectedContainer, setSelectedContainer] = useState<string>(() => localStorage.getItem('dashboard_container') || waterContainers[0]);
    const [selectedForecastDuration, setSelectedForecastDuration] = useState<ForecastDuration>(() => (localStorage.getItem('dashboard_duration') as ForecastDuration) || '30d');
    const [selectedModel, setSelectedModel] = useState<ForecastModel>(() => (localStorage.getItem('dashboard_model') as ForecastModel) || 'prophet');
    const [uploadsDone, setUploadsDone] = useState<boolean>(() => localStorage.getItem('dashboard_uploadsDone') === 'true');

    const [historicalData, setHistoricalData] = useState<ChartDataPoint[]>([]);
    const [futureForecastData, setFutureForecastData] = useState<ChartDataPoint[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(uploadsDone);
    const [isGeneratingForecast, setIsGeneratingForecast] = useState<boolean>(false);
    const [chartKey, setChartKey] = useState<number>(0);
    const [isDataAvailable, setIsDataAvailable] = useState<boolean>(false);

    // --- Hooks ---
    const { user } = useAuth();
    const theme = useTheme();
    const navigate = useNavigate();

    // --- Speichere Auswahl im localStorage bei Änderung ---
    useEffect(() => { localStorage.setItem('dashboard_container', selectedContainer); }, [selectedContainer]);
    useEffect(() => { localStorage.setItem('dashboard_duration', selectedForecastDuration); }, [selectedForecastDuration]);
    useEffect(() => { localStorage.setItem('dashboard_model', selectedModel); }, [selectedModel]);
    useEffect(() => { if (uploadsDone) localStorage.setItem('dashboard_uploadsDone', 'true'); }, [uploadsDone]);

    // --- Daten laden (Historisch) ---
    const fetchHistoricalData = useCallback(async () => {
        console.log("fetchHistoricalData aufgerufen");
        setIsLoading(true);
        setIsDataAvailable(false);
        try {
            const res = await axios.get<Omit<ChartDataPoint, 'isFuture'>[]>(`${API_BASE_URL_KI}/forecast_vs_actual/`);
            console.log("Historische Daten empfangen:", res.data);
            if (res.data && res.data.length > 0) {
                const sortedData = res.data
                    .map(p => ({ ...p, date: p.date, isFuture: false }))
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                setHistoricalData(sortedData);
                setIsDataAvailable(true);
            } else {
                setHistoricalData([]);
                setIsDataAvailable(false);
                if (uploadsDone) {
                    toast('Keine historischen Daten gefunden, obwohl Upload markiert wurde. Bitte erneut hochladen.', { icon: 'ℹ️' });
                    localStorage.removeItem('dashboard_uploadsDone');
                    setUploadsDone(false);
                }
            }
        } catch (error) {
            console.error("Fehler beim Laden der historischen Daten:", error);
            toast.error("Fehler beim Laden der historischen Daten.");
            setHistoricalData([]);
            setIsDataAvailable(false);
        } finally {
            setIsLoading(false);
        }
    }, [uploadsDone]);

    // --- Forecast generieren ---
    const generateForecast = useCallback(async () => {
        if (!selectedContainer || !isDataAvailable) return;
        console.log("generateForecast aufgerufen");
        setIsGeneratingForecast(true);
        setFutureForecastData([]);
        const toastId = toast.loading(`Generiere ${selectedForecastDuration} Forecast (${selectedModel})...`);
        try {
            const payload = { containerId: selectedContainer, duration: selectedForecastDuration, model: selectedModel };
            const response = await axios.post<Omit<ChartDataPoint, 'actual' | 'isFuture'>[]>(`${API_BASE_URL_KI}/generate_forecast/`, payload);
            const forecastData = response.data.map(p => ({
                date: p.date, forecast: p.forecast, actual: null, isFuture: true
            })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setFutureForecastData(forecastData);
            setChartKey(prev => prev + 1);
            toast.success(`Forecast (${selectedModel}) für ${selectedForecastDuration} generiert.`, { id: toastId });
        } catch (error) {
            console.error("Fehler beim Generieren des Forecasts:", error);
            let errorMsg = "Fehler bei der Forecast-Generierung.";
            if (axiosStatic.isAxiosError(error)) { errorMsg = error.response?.data?.detail || error.response?.data?.message || error.message || errorMsg; }
            toast.error(errorMsg, { id: toastId });
            setFutureForecastData([]);
        } finally {
            setIsGeneratingForecast(false);
        }
    }, [selectedContainer, selectedForecastDuration, selectedModel, isDataAvailable]);

    // Effekt zum initialen Laden und bei User-Änderung
    useEffect(() => {
        if (user === undefined) return;
        if (user === null) { navigate('/login', { replace: true }); return; }
        if (uploadsDone) {
            fetchHistoricalData();
        }
    }, [user, navigate, fetchHistoricalData, uploadsDone]);

    // Effekt, der generateForecast aufruft
    useEffect(() => {
        if (isDataAvailable && selectedContainer) {
            generateForecast();
        }
    }, [selectedForecastDuration, selectedModel, selectedContainer, generateForecast, isDataAvailable]);

    // --- Kombinierte Daten für den Chart ---
    const chartDisplayData = useMemo(() => {
        if (!isDataAvailable) return [];
        const daysOfHistoryToShow = 90;
        const historicalWindow = historicalData.slice(-daysOfHistoryToShow);
        return [...historicalWindow, ...futureForecastData];
    }, [historicalData, futureForecastData, isDataAvailable]);

    // --- Berechne Ticks für die X-Achse ---
    const calculatedTicks = useMemo(() => {
        if (!isDataAvailable || chartDisplayData.length === 0) return [];
        const ticks: string[] = [];
        try {
            const startDate = parseISO(chartDisplayData[0].date);
            const endDate = parseISO(chartDisplayData[chartDisplayData.length - 1].date);
            let currentTickDate = new Date(startDate);
            currentTickDate.setMinutes(0, 0, 0);
            currentTickDate.setHours(Math.floor(startDate.getHours() / 6) * 6);
            while (currentTickDate <= endDate) {
                ticks.push(currentTickDate.toISOString());
                currentTickDate = addHours(currentTickDate, 6);
            }
        } catch (e) { console.error("Error calculating ticks:", e); }
        return ticks;
    }, [chartDisplayData, isDataAvailable]);

    // --- Upload Handler ---
    const handleUploadSuccess = useCallback(() => {
        localStorage.setItem('dashboard_uploadsDone', 'true');
        setUploadsDone(true);
        fetchHistoricalData();
    }, [fetchHistoricalData]);

    const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]; if (!file) return;
        const formData = new FormData(); formData.append("file", file);
        const toastId = toast.loading("Lade Forecast CSV hoch...");
        try {
            await axios.post(`${API_BASE_URL_KI}/upload_csv/`, formData, { headers: { "Content-Type": "multipart/form-data" } });
            handleUploadSuccess(); // Rufe gemeinsame Funktion auf
        } catch (err) {
            console.error("Fehler beim Forecast CSV Upload:", err);
            let errorMsg = "Upload fehlgeschlagen.";
            if (axiosStatic.isAxiosError(err)) { errorMsg = err.response?.data?.detail || err.message || errorMsg; }
            toast.error(errorMsg, { id: toastId });
        } finally { event.target.value = ''; }
    };
    const handleActualUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]; if (!file) return;
        const formData = new FormData(); formData.append("file", file);
        const toastId = toast.loading("Lade Actual CSV hoch...");
        try {
            await axios.post(`${API_BASE_URL_KI}/upload_actual/`, formData, { headers: { "Content-Type": "multipart/form-data" } });
            handleUploadSuccess(); // Rufe gemeinsame Funktion auf
        } catch (err) {
            console.error("Fehler beim Actual CSV Upload:", err);
            let errorMsg = "Upload fehlgeschlagen.";
            if (axiosStatic.isAxiosError(err)) { errorMsg = err.response?.data?.detail || err.message || errorMsg; }
            toast.error(errorMsg, { id: toastId });
        } finally { event.target.value = ''; }
    };

    // --- CustomTooltip Komponente ---
    // ✅ Definiert als React Functional Component mit korrekten Props
    const CustomTooltip: React.FC<TooltipProps<ValueType, NameType>> = ({ active, payload, label }) => {
        if (active && payload && payload.length && label) {
            try {
                const formattedDate = format(parseISO(label as string), 'dd.MM.yyyy HH:mm');
                return (
                    <Paper elevation={3} sx={{ padding: '10px', borderRadius: '8px', backgroundColor: alpha(theme.palette.background.paper, 0.95) }}>
                        <Typography variant="caption" display="block" gutterBottom sx={{ fontWeight: 'bold' }}>{formattedDate}</Typography>
                        {payload.map((entry, index) => ( // Typ für entry kann spezifischer sein, falls bekannt
                            <Typography key={`item-${index}`} variant="body2" sx={{ color: entry.color, display: 'flex', alignItems: 'center' }}>
                                <Box component="span" sx={{ width: 10, height: 10, backgroundColor: entry.color, marginRight: 1, borderRadius: '50%' }} />
                                {`${entry.name}: `}
                                <Typography component="span" sx={{ fontWeight: 'bold', ml: 0.5 }}>
                                    {entry.value != null ? (entry.value as number).toFixed(2) : 'N/A'}
                                </Typography>
                            </Typography>
                        ))}
                    </Paper>
                );
            } catch (e) { console.error("Error formatting date in tooltip:", label, e); return <Paper sx={{ padding: '5px' }}>Invalid Date</Paper>; }
        }
        return null;
    };


    // --- Rendering ---
    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            <ForecastNavbar />

            <Box component="main" sx={{ flexGrow: 1, bgcolor: theme.palette.grey[100], p: 3, minHeight: '100vh' }}>
                {/* AppBar */}
                <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1, backgroundColor: 'white', color: theme.palette.text.primary, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <Toolbar>
                        <ChartIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}> Forecast Analyse </Typography>
                        <Typography sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>{user?.username} ({user?.role})</Typography>
                        <Avatar src={user?.profileImageUrl || undefined} sx={{ bgcolor: theme.palette.primary.main }}>{user?.username?.charAt(0).toUpperCase()}</Avatar>
                    </Toolbar>
                </AppBar>
                <Toolbar />

                {/* Layout Container */}
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3, mt: 2 }}>
                    {/* Chart Sektion */}
                    <Paper sx={{ p: {xs: 1, sm: 2}, borderRadius: 3, boxShadow: theme.shadows[3], flexGrow: 1 }}>
                        {/* Steuerungselemente */}
                        {isDataAvailable && (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                                <Box sx={{ flexGrow: 1, minWidth: {xs: '100%', sm: '250px'} }}> <FormControl size="small" fullWidth> <InputLabel id="container-select-label">Wasserwerk/Container</InputLabel> <Select labelId="container-select-label" value={selectedContainer} label="Wasserwerk/Container" onChange={(e: SelectChangeEvent<string>) => setSelectedContainer(e.target.value as string)} startAdornment={ <InputAdornment position="start"><WaterIcon fontSize='small' color='action'/></InputAdornment> }> {waterContainers.map(container => ( <MenuItem key={container} value={container}>{container}</MenuItem> ))} </Select> </FormControl> </Box>
                                <Box sx={{ flexGrow: 1, minWidth: '180px' }}> <FormControl size="small" fullWidth> <InputLabel id="duration-select-label">Forecast Dauer</InputLabel> <Select labelId="duration-select-label" value={selectedForecastDuration} label="Forecast Dauer" onChange={(e: SelectChangeEvent<ForecastDuration>) => setSelectedForecastDuration(e.target.value as ForecastDuration)}> <MenuItem value="1d">Nächster Tag</MenuItem> <MenuItem value="7d">Nächste 7 Tage</MenuItem> <MenuItem value="30d">Nächste 30 Tage</MenuItem> <MenuItem value="90d">Nächste 90 Tage</MenuItem> </Select> </FormControl> </Box>
                                <Box sx={{ flexGrow: 1, minWidth: '200px' }}> <FormControl size="small" fullWidth> <InputLabel id="model-select-label">Forecast Modell</InputLabel> <Select labelId="model-select-label" value={selectedModel} label="Forecast Modell" onChange={(e: SelectChangeEvent<ForecastModel>) => setSelectedModel(e.target.value as ForecastModel)} startAdornment={ <InputAdornment position="start"><ModelIcon fontSize='small' color='action'/></InputAdornment> }> <MenuItem value="prophet">Facebook Prophet</MenuItem> <MenuItem value="tensorflow">TensorFlow/Keras</MenuItem> </Select> </FormControl> </Box>
                            </Box>
                        )}

                        {/* Chart Bereich */}
                        <Box sx={{ height: 450, width: '100%', position: 'relative' }}>
                            {isGeneratingForecast && ( <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: alpha(theme.palette.background.paper, 0.7), zIndex: 10, borderRadius: 'inherit' }}> <CircularProgress /> <Typography sx={{ ml: 2 }}>Generiere Forecast...</Typography> </Box> )}
                            {/* ✅ Korrigierte bedingte Anzeige */}
                            {isLoading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>
                            ) : !uploadsDone ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', textAlign: 'center' }}>
                                    <UploadFileIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                                    <Typography color="text.secondary">Bitte laden Sie zuerst die CSV-Dateien hoch,</Typography>
                                    <Typography color="text.secondary">um die Analyse und Prognose zu starten.</Typography>
                                </Box>
                            ) : !isDataAvailable && !isLoading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}> <Typography color="text.secondary">Keine Chart-Daten verfügbar.</Typography> </Box>
                            ) : isDataAvailable ? (
                                // ✅ Korrekte JSX-Struktur hier
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartDisplayData} key={chartKey} margin={{ top: 5, right: 30, left: 0, bottom: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.grey[300]}/>
                                        <XAxis dataKey="date" fontSize={10} tick={{ fill: theme.palette.text.secondary }} tickFormatter={(tick) => format(parseISO(tick), 'dd.MM HH:mm')} angle={-30} textAnchor="end" height={50} ticks={calculatedTicks} />
                                        <YAxis fontSize={10} tick={{ fill: theme.palette.text.secondary }}/>
                                        {/* ✅ CustomTooltip Komponente korrekt übergeben */}
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend verticalAlign="top" height={36}/>
                                        <Line type="monotone" dataKey="actual" name="Tatsächlich" stroke={theme.palette.secondary.dark} strokeWidth={1.5} dot={false} activeDot={{ r: 6 }} connectNulls={false} />
                                        <Line type="monotone" dataKey="forecast" name="Vorhersage" stroke={theme.palette.primary.main} strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 6 }} connectNulls={false} />
                                        <ReferenceLine x={FORECAST_START_ISO_DATE} stroke={theme.palette.error.main} strokeDasharray="3 3"> <Label value="Prognose Start" position="insideTopLeft" fill={theme.palette.error.main} fontSize={10} dy={-10} /> </ReferenceLine>
                                        {futureForecastData.length > 0 && ( <ReferenceArea x1={futureForecastData[0].date} stroke="none" fill={alpha(theme.palette.primary.light, 0.1)} ifOverflow="visible" label={{ value: "Forecast", position: "insideTopRight", fill: theme.palette.primary.dark, fontSize: 10, fontWeight: 'bold' }} /> )}
                                        <Brush dataKey="date" height={30} stroke={theme.palette.primary.main} travellerWidth={15} tickFormatter={(tick) => format(parseISO(tick), 'dd.MM')} gap={5} />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : null } {/* Fallback */}
                        </Box>
                    </Paper>

                    {/* Upload Sektion */}
                    {user?.role === "Admin" && (
                        <Card id="upload-card" sx={{ borderRadius: 3, boxShadow: theme.shadows[3], width: { xs: '100%', lg: '300px' }, flexShrink: 0 }}>
                            <CardHeader title="Daten hochladen" sx={{ bgcolor: alpha(theme.palette.grey[200], 0.4) }}/>
                            <CardContent>
                                <Stack spacing={2}>
                                    <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}> Forecast CSV <input type="file" hidden accept=".csv" onChange={handleCsvUpload} /> </Button>
                                    <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}> Actual CSV <input type="file" hidden accept=".csv" onChange={handleActualUpload} /> </Button>
                                </Stack>
                            </CardContent>
                        </Card>
                    )}
                </Box> {/* Ende Layout Container */}
            </Box> {/* Ende Haupt-Inhaltsbereich */}
        </Box> // Ende Haupt-Container
    );
};

export default Dashboard;
