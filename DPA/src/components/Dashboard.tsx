import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import axios from '../api/axiosInstance';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { AxiosError } from 'axios';
import API_BASE_URL from '../apiConfig';

// --- MUI Imports ---
import {
    Box, AppBar, Toolbar, Typography, CssBaseline, Card, CardContent, CardHeader,
    Button, useTheme, CircularProgress, Avatar, Drawer, List, ListItem,
    ListItemText, ListItemButton, ListItemIcon, Divider, Stack, alpha,
    Select, MenuItem, FormControl, InputLabel, Paper, InputAdornment, ListSubheader
} from '@mui/material';
import { LoadingButton } from '@mui/lab';

// --- Recharts Imports ---
import {
    LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, Legend, Brush, ReferenceArea
} from 'recharts';

// --- Date-fns Import ---
import { subDays, addDays, parseISO, isAfter, isValid, format } from 'date-fns';

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

// --- NEUE, SPEZIFISCHE Navbar für Forecast/Dashboard ---
const drawerWidth = 240;
interface ForecastNavItem { text: string; icon: React.ReactElement; path: string; }

const ForecastNavbar: React.FC = () => {
    const location = useLocation(); const navigate = useNavigate(); const { user } = useAuth(); const theme = useTheme();
    const navItems: ForecastNavItem[] = [
        { text: 'Analyse', icon: <AnalyseIcon />, path: '/dashboard' },
        // { text: 'CSV Upload', icon: <UploadFileIcon />, path: '#upload-section' }, // Example for scroll link or modal trigger
    ];

    return (
        <Drawer variant="permanent" sx={{ width: drawerWidth, flexShrink: 0, [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box', borderRight: `1px solid ${theme.palette.divider}` }, }}>
            <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1 }}> <img src={logo} alt="GWT Logo" style={{ height: 40, width: 'auto' }} /> </Toolbar>
            <Divider />
            <List sx={{ padding: 1 }}>
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton component={RouterLink} to="/home" sx={{ borderRadius: 1, '&:hover': { backgroundColor: theme.palette.action.hover, } }}>
                        <ListItemIcon sx={{ minWidth: 40 }}> <HomeIcon /> </ListItemIcon>
                        <ListItemText primary="Home" />
                    </ListItemButton>
                </ListItem>
                <Divider sx={{ my: 1 }}/>
                <ListSubheader sx={{ bgcolor: 'transparent', fontWeight: 'bold', color: 'text.primary' }}> Forecast </ListSubheader>
                {navItems.map((item) => {
                    const isSelected = location.pathname === item.path;
                    return (
                        <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                            <ListItemButton component={RouterLink} to={item.path} selected={isSelected} sx={{ borderRadius: 1, '&.Mui-selected': { backgroundColor: alpha(theme.palette.primary.light, 0.12), '&:hover': { backgroundColor: alpha(theme.palette.primary.light, 0.18), }, '& .MuiListItemIcon-root, & .MuiListItemText-primary': { color: theme.palette.primary.dark, fontWeight: 600, }, }, '&:hover': { backgroundColor: theme.palette.action.hover, } }}>
                                <ListItemIcon sx={{ minWidth: 40, color: isSelected ? theme.palette.primary.dark : 'inherit' }}> {item.icon} </ListItemIcon>
                                <ListItemText primary={item.text} />
                            </ListItemButton>
                        </ListItem>
                    );
                })}
                {/* Optional: Upload trigger in Navbar */}
                {/* {user?.role === 'Admin' && (
                     <ListItem disablePadding sx={{ mt: 2 }}>
                         <ListItemButton onClick={() => document.getElementById('upload-card')?.scrollIntoView({ behavior: 'smooth' })}>
                             <ListItemIcon sx={{ minWidth: 40 }}> <UploadFileIcon /> </ListItemIcon>
                             <ListItemText primary="CSV Upload" />
                         </ListItemButton>
                     </ListItem>
                 )} */}
            </List>
        </Drawer>
    );
};
// --- Ende ForecastNavbar Komponente ---

// Interface für die Chart-Daten
interface ChartDataPoint { date: string; actual?: number | null; forecast?: number | null; isFuture?: boolean; }
type ForecastDuration = '1d' | '7d' | '30d' | '90d';
type ForecastModel = 'prophet' | 'tensorflow';
const waterContainers = [ "HB/DST Kleinhadersdorf (M616.F1)", "DST Kleinhadersdorf (M960.F1)", "Ortsnetz Poysdorf (M617.F1)", "Zulauf HB Poysdorf (M100.F1)", "Ablauf HB Poysdorf (M130.F1)", "DST Poysdorf (M150.F1)", "Zulauf v. Poysdorf HB Poysbrunn (M320.F1)", "Zulauf v. Bru. HB Poysbrunn (M310.F1)", "Ablauf HB Poysbrunn (M230.F1)", "Brunnen 3 Poysbrunn (M950.F1)" ];


const Dashboard: React.FC = () => {
    // --- States ---
    const [historicalData, setHistoricalData] = useState<ChartDataPoint[]>([]); const [futureForecastData, setFutureForecastData] = useState<ChartDataPoint[]>([]); const [selectedContainer, setSelectedContainer] = useState<string>(waterContainers[0]); const [selectedForecastDuration, setSelectedForecastDuration] = useState<ForecastDuration>('30d');
    const [selectedModel, setSelectedModel] = useState<ForecastModel>('prophet'); // NEU
    const [isLoading, setIsLoading] = useState<boolean>(true); const [isGeneratingForecast, setIsGeneratingForecast] = useState<boolean>(false); const [chartKey, setChartKey] = useState<number>(0);

    // --- Hooks ---
    const { user } = useAuth(); const theme = useTheme(); const navigate = useNavigate();

    // --- Daten laden (Historisch) ---
    const fetchHistoricalData = async () => {
        setIsLoading(true); try { const res = await axios.get<Omit<ChartDataPoint, 'isFuture'>[]>(`${API_BASE_URL}/forecast_vs_actual/?container=${encodeURIComponent(selectedContainer)}`); const sortedData = res.data .map(p => ({ ...p, date: p.date, isFuture: false })) .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); setHistoricalData(sortedData); } catch (error) { console.error("Fehler beim Laden der historischen Daten:", error); toast.error("Fehler beim Laden der historischen Daten."); setHistoricalData([]); } finally { setIsLoading(false); }
    };
    useEffect(() => { fetchHistoricalData(); setFutureForecastData([]); setChartKey(prev => prev + 1); }, [selectedContainer]);

    // --- Forecast generieren (Simulation) ---
    const generateForecast = async () => {
        if (!selectedContainer || historicalData.length === 0) return;
        setIsGeneratingForecast(true); setFutureForecastData([]);
        const toastId = toast.loading(`Generiere ${selectedForecastDuration} Forecast (${selectedModel}) für ${selectedContainer}...`);
        // *** ECHTER API CALL HIER EINFÜGEN ***
        // const payload = { containerId: selectedContainer, duration: selectedForecastDuration, model: selectedModel };
        // const response = await axios.post(`${API_BASE_URL}/generate_forecast/`, payload);
        // setFutureForecastData(response.data.map(p => ({...p, isFuture: true})));
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulation
        const lastHistoricalPoint = historicalData[historicalData.length - 1]; const lastDate = parseISO(lastHistoricalPoint.date); const dummyFutureData: ChartDataPoint[] = []; let daysToAdd = 0; switch (selectedForecastDuration) { case '1d': daysToAdd = 1; break; case '7d': daysToAdd = 7; break; case '30d': daysToAdd = 30; break; case '90d': daysToAdd = 90; break; }
        let lastValue = lastHistoricalPoint.actual ?? lastHistoricalPoint.forecast ?? 500;
        for (let i = 1; i <= daysToAdd; i++) { const nextDate = addDays(lastDate, i); lastValue += (Math.random() - 0.5) * (selectedModel === 'tensorflow' ? 70 : 50); if (lastValue < 0) lastValue = 0; dummyFutureData.push({ date: nextDate.toISOString(), forecast: Math.round(lastValue), actual: null, isFuture: true }); }
        setFutureForecastData(dummyFutureData); setChartKey(prev => prev + 1); toast.success(`Forecast (${selectedModel}) für ${selectedForecastDuration} generiert (Simulation).`, { id: toastId });
        setIsGeneratingForecast(false);
    };
    useEffect(() => { if (!isLoading && historicalData.length > 0) { generateForecast(); } }, [selectedForecastDuration, selectedModel, isLoading, historicalData]);


    // --- Kombinierte Daten für den Chart ---
    const chartDisplayData = useMemo(() => { const daysOfHistoryToShow = 90; const historicalWindow = historicalData.slice(-daysOfHistoryToShow); return [...historicalWindow, ...futureForecastData]; }, [historicalData, futureForecastData]);

    // --- Upload Handler ---
    const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const formData = new FormData(); formData.append("file", file); const toastId = toast.loading("Lade Forecast CSV hoch..."); try { await axios.post(`${API_BASE_URL}/upload_csv/`, formData, { headers: { "Content-Type": "multipart/form-data" } }); toast.success("Forecast CSV erfolgreich hochgeladen!", { id: toastId }); fetchHistoricalData(); } catch (err) { toast.error("Upload fehlgeschlagen.", { id: toastId }); } finally { event.target.value = ''; } };
    const handleActualUpload = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const formData = new FormData(); formData.append("file", file); const toastId = toast.loading("Lade Actual CSV hoch..."); try { await axios.post(`${API_BASE_URL}/upload_actual/`, formData, { headers: { "Content-Type": "multipart/form-data" } }); toast.success("Actual CSV erfolgreich hochgeladen!", { id: toastId }); fetchHistoricalData(); } catch (err) { toast.error("Upload fehlgeschlagen.", { id: toastId }); } finally { event.target.value = ''; } };

    // --- Rendering ---
    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            {/* Verwendet die NEUE ForecastNavbar */}
            <ForecastNavbar />

            {/* Haupt-Inhaltsbereich */}
            <Box component="main" sx={{ flexGrow: 1, bgcolor: theme.palette.grey[100], p: 3, minHeight: '100vh' }}>
                {/* AppBar / Header */}
                <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1, backgroundColor: 'white', color: theme.palette.text.primary, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <Toolbar> <ChartIcon sx={{ mr: 1, color: 'primary.main' }} /> <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}> Forecast Analyse </Typography> <Typography sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>{user?.username} ({user?.role})</Typography> <Avatar src={user?.profileImageUrl || undefined} sx={{ bgcolor: theme.palette.primary.main }}>{user?.username?.charAt(0).toUpperCase()}</Avatar> </Toolbar>
                </AppBar>
                <Toolbar /> {/* Abstandshalter */}

                {/* Layout Container */}
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3, mt: 2 }}>

                    {/* Chart Sektion */}
                    <Paper sx={{ p: {xs: 1, sm: 2}, borderRadius: 3, boxShadow: theme.shadows[3], flexGrow: 1 }}>
                        {/* Steuerungselemente mit Flexbox */}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                            {/* Container Select */}
                            <Box sx={{ flexGrow: 1, minWidth: {xs: '100%', sm: '250px'} }}>
                                <FormControl size="small" fullWidth>
                                    <InputLabel id="container-select-label">Wasserwerk/Container</InputLabel>
                                    <Select labelId="container-select-label" value={selectedContainer} label="Wasserwerk/Container" onChange={(e) => setSelectedContainer(e.target.value as string)} startAdornment={ <InputAdornment position="start"><WaterIcon fontSize='small' color='action'/></InputAdornment> }>
                                        {waterContainers.map(container => ( <MenuItem key={container} value={container}>{container}</MenuItem> ))}
                                    </Select>
                                </FormControl>
                            </Box>
                            {/* Dauer Select */}
                            <Box sx={{ flexGrow: 1, minWidth: '180px' }}>
                                <FormControl size="small" fullWidth>
                                    <InputLabel id="duration-select-label">Forecast Dauer</InputLabel>
                                    <Select labelId="duration-select-label" value={selectedForecastDuration} label="Forecast Dauer" onChange={(e) => setSelectedForecastDuration(e.target.value as ForecastDuration)}>
                                        <MenuItem value="1d">Nächster Tag</MenuItem> <MenuItem value="7d">Nächste 7 Tage</MenuItem> <MenuItem value="30d">Nächste 30 Tage</MenuItem> <MenuItem value="90d">Nächste 90 Tage</MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>
                            {/* NEU: Modell Select */}
                            <Box sx={{ flexGrow: 1, minWidth: '200px' }}>
                                <FormControl size="small" fullWidth>
                                    <InputLabel id="model-select-label">Forecast Modell</InputLabel>
                                    <Select labelId="model-select-label" value={selectedModel} label="Forecast Modell" onChange={(e) => setSelectedModel(e.target.value as ForecastModel)} startAdornment={ <InputAdornment position="start"><ModelIcon fontSize='small' color='action'/></InputAdornment> }>
                                        <MenuItem value="prophet">Facebook Prophet</MenuItem>
                                        <MenuItem value="tensorflow">TensorFlow/Keras</MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>
                        </Box>

                        {/* Chart Bereich */}
                        <Box sx={{ height: 450, width: '100%', position: 'relative' }}>
                            {isGeneratingForecast && ( <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: alpha(theme.palette.background.paper, 0.7), zIndex: 10 }}> <CircularProgress /> <Typography sx={{ ml: 2 }}>Generiere Forecast...</Typography> </Box> )}
                            {isLoading ? ( <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box> ) : chartDisplayData.length === 0 && !isGeneratingForecast ? ( <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}> <Typography color="text.secondary">Keine Daten verfügbar.</Typography> </Box> ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartDisplayData} key={chartKey} margin={{ top: 5, right: 30, left: 0, bottom: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.grey[300]}/>
                                        <XAxis dataKey="date" fontSize={10} tick={{ fill: theme.palette.text.secondary }} tickFormatter={(tick) => format(parseISO(tick), 'dd.MM HH:mm')} angle={-30} textAnchor="end" height={50} interval="preserveStartEnd" />
                                        <YAxis fontSize={10} tick={{ fill: theme.palette.text.secondary }}/>
                                        <Tooltip contentStyle={{ backgroundColor: alpha(theme.palette.background.paper, 0.9), borderRadius: '8px' }} labelFormatter={(label) => format(parseISO(label), 'dd.MM.yyyy HH:mm')} />
                                        <Legend verticalAlign="top" height={36}/>
                                        <Line type="monotone" dataKey="actual" name="Tatsächlich" stroke={theme.palette.secondary.dark} strokeWidth={1.5} dot={false} activeDot={{ r: 6 }} connectNulls={false} />
                                        <Line type="monotone" dataKey="forecast" name="Vorhersage (Zukunft)" stroke={theme.palette.primary.main} strokeWidth={2} dot={false} activeDot={{ r: 6 }} connectNulls={false} />
                                        {futureForecastData.length > 0 && ( <ReferenceArea x1={futureForecastData[0].date} x2={futureForecastData[futureForecastData.length - 1].date} stroke="none" fill={alpha(theme.palette.primary.light, 0.1)} ifOverflow="visible" label={<Typography variant="caption" sx={{fill: theme.palette.primary.dark, fontWeight:'bold'}}>Forecast</Typography>} /> )}
                                        <Brush dataKey="date" height={30} stroke={theme.palette.primary.main} travellerWidth={15} tickFormatter={(tick) => format(parseISO(tick), 'dd.MM')} />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </Box>
                    </Paper>

                    {/* Upload Sektion (Nur für Admin) */}
                    {user?.role === "Admin" && (
                        <Card id="upload-card" sx={{ borderRadius: 3, boxShadow: theme.shadows[3], width: { xs: '100%', lg: '300px' }, flexShrink: 0 }}>
                            <CardHeader title="Daten hochladen" sx={{ bgcolor: alpha(theme.palette.grey[200], 0.4) }}/>
                            <CardContent> <Stack spacing={2}> <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}> Forecast CSV <input type="file" hidden accept=".csv" onChange={handleCsvUpload} /> </Button> <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}> Actual CSV <input type="file" hidden accept=".csv" onChange={handleActualUpload} /> </Button> </Stack> </CardContent>
                        </Card>
                    )}
                </Box> {/* Ende Layout Container */}

            </Box> {/* Ende Haupt-Inhaltsbereich */}
        </Box> // Ende Haupt-Container
    );
};

export default Dashboard;