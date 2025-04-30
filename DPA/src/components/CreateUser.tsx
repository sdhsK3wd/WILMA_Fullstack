import React, { useState, useEffect } from 'react';
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
    TextField, Select, MenuItem, FormControl, InputLabel, OutlinedInput,
    InputAdornment, IconButton, ListSubheader // ListSubheader hinzugefügt
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import { Visibility, VisibilityOff, PersonAddAlt1 as AddUserIcon } from '@mui/icons-material';

// --- Icons für Navbar ---
import {
    Home as HomeIcon, // Für Home Link
    PersonAdd as CreateUserIcon, ListAlt as UserListIcon // Für User Mgmt Links
} from '@mui/icons-material';

// --- Bild-Import für Logo ---
import logo from '../images/Logo.png';

// --- NEUE, SPEZIFISCHE Navbar für Benutzerverwaltung ---
const drawerWidth = 240;
interface UserMgmtNavItem { text: string; icon: React.ReactElement; path: string; }

const UserManagementNavbar: React.FC = () => {
    const location = useLocation(); const navigate = useNavigate(); const { user } = useAuth(); const theme = useTheme();
    const navItems: UserMgmtNavItem[] = [
        { text: 'Benutzerliste', icon: <UserListIcon />, path: '/user-list' },
        { text: 'Benutzer erstellen', icon: <CreateUserIcon />, path: '/create-user' },
    ];
    useEffect(() => { if (user && user.role !== 'Admin') { toast.error("Zugriff verweigert."); navigate('/home'); } }, [user, navigate]);

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
                <ListSubheader sx={{ bgcolor: 'transparent', fontWeight: 'bold', color: 'text.primary' }}> Benutzerverwaltung </ListSubheader>
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
            </List>
        </Drawer>
    );
};
// --- Ende UserManagementNavbar Komponente ---


const CreateUser: React.FC = () => {
    // --- States ---
    const [username, setUsername] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [role, setRole] = useState("User"); const [showPassword, setShowPassword] = useState(false); const [adminEmail, setAdminEmail] = useState(""); const [loading, setLoading] = useState(false); const [loggedInUserRole, setLoggedInUserRole] = useState<string | null>(null);

    // --- Hooks ---
    const navigate = useNavigate(); const theme = useTheme(); const { user } = useAuth();

    // --- Effekt zum Setzen der Admin-Infos & Rollen-Check ---
    useEffect(() => {
        // Redirect wird jetzt in der Navbar gehandhabt, hier nur Email setzen
        if (user) { setAdminEmail(user.email); setLoggedInUserRole(user.role); } else { const storedUser = localStorage.getItem("user"); if (storedUser) { try { const parsedUser = JSON.parse(storedUser); setAdminEmail(parsedUser.email); setLoggedInUserRole(parsedUser.role); } catch { navigate("/login"); } } else { navigate("/login"); } }
    }, [user, navigate]);

    // --- Handler ---
    const handleCreateUser = async () => {
        if (!username || !email || !password || !role || !adminEmail) { toast.error("Bitte alle erforderlichen Felder ausfüllen!"); return; }
        if (loggedInUserRole !== "Admin") { toast.error("Nur Admins können Benutzer erstellen!"); return; } // Sicherheitscheck bleibt
        setLoading(true);
        try { const response = await axios.post(`${API_BASE_URL}/users/register`, { username, email, password, role, adminEmail }); toast.success(response.data.message || "Benutzer erfolgreich erstellt!"); setUsername(""); setEmail(""); setPassword(""); setRole("User"); } catch (err) { const error = err as AxiosError<{ message?: string }>; console.error("Fehler beim Benutzer erstellen:", error.response?.data || error.message); toast.error(error.response?.data?.message || "Fehler beim Erstellen des Benutzers"); } finally { setLoading(false); }
    };
    const handleClickShowPassword = () => setShowPassword((show) => !show);
    const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => { event.preventDefault(); };

    // --- Rendering ---
    // Ladeanzeige, bis Rolle klar ist
    if (loggedInUserRole === null) { return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>; }
    // Falls kein Admin (sollte durch Navbar-Redirect verhindert werden)
    if (loggedInUserRole !== "Admin") { return <Box sx={{ p: 3 }}>Zugriff verweigert.</Box>; }

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            {/* Verwendet die NEUE UserManagementNavbar */}
            <UserManagementNavbar />

            {/* Haupt-Inhaltsbereich */}
            <Box component="main" sx={{ flexGrow: 1, bgcolor: theme.palette.grey[100], p: 3, minHeight: '100vh' }}>
                {/* AppBar / Header */}
                <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1, backgroundColor: 'white', color: theme.palette.text.primary, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <Toolbar>
                        <CreateUserIcon sx={{ mr: 1, color: 'primary.main' }} /> {/* Angepasstes Icon */}
                        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}> Neuen Benutzer erstellen </Typography>
                        <Typography sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>{user?.username} ({user?.role})</Typography>
                        <Avatar
                            src={user?.profileImageUrl || '/Default.png'}
                            alt={user?.username}
                            sx={{ bgcolor: theme.palette.primary.main }}
                        >
                            {user?.username?.charAt(0).toUpperCase()}
                        </Avatar>

                    </Toolbar>
                </AppBar>
                <Toolbar /> {/* Abstandshalter */}

                {/* Formular Container */}
                <Box sx={{ maxWidth: '600px', margin: 'auto', mt: 4 }}>
                    <Card elevation={3} sx={{ backgroundColor: alpha(theme.palette.background.paper, 0.9) }}>
                        <CardHeader title="Benutzerdetails eingeben" titleTypographyProps={{ variant: 'h6', align: 'center' }} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), p: 2 }} />
                        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                            <Stack spacing={3} component="form" onSubmit={(e) => { e.preventDefault(); handleCreateUser(); }}>
                                <TextField label="Admin-E-Mail (Ersteller)" value={adminEmail} fullWidth disabled variant="standard" InputProps={{ readOnly: true, disableUnderline: true }} size="small" sx={{ pb: 1 }} />
                                <TextField variant="outlined" label="Benutzername" value={username} onChange={(e) => setUsername(e.target.value)} required fullWidth autoComplete='off' sx={{ '& .MuiOutlinedInput-root': { '&:hover fieldset': { borderColor: theme.palette.primary.light, }, '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, }, }, }} />
                                <TextField variant="outlined" label="E-Mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth autoComplete='off' sx={{ '& .MuiOutlinedInput-root': { '&:hover fieldset': { borderColor: theme.palette.primary.light, }, '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, }, }, }} />
                                <FormControl required fullWidth variant="outlined">
                                    <InputLabel htmlFor="create-user-password">Passwort</InputLabel>
                                    <OutlinedInput id="create-user-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} label="Passwort" endAdornment={ <InputAdornment position="end"> <IconButton aria-label="toggle password visibility" onClick={handleClickShowPassword} onMouseDown={handleMouseDownPassword} edge="end"> {showPassword ? <VisibilityOff /> : <Visibility />} </IconButton> </InputAdornment> } sx={{ '&:hover fieldset': { borderColor: theme.palette.primary.light, }, '&.Mui-focused fieldset': { borderColor: theme.palette.primary.main, }, }} />
                                </FormControl>
                                <FormControl fullWidth required variant="outlined">
                                    <InputLabel id="role-select-label">Rolle</InputLabel>
                                    <Select labelId="role-select-label" id="role-select" value={role} label="Rolle" onChange={(e) => setRole(e.target.value)} sx={{ '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.primary.light, }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.primary.main, }, }}>
                                        <MenuItem value="User">User</MenuItem> <MenuItem value="Admin">Admin</MenuItem>
                                    </Select>
                                </FormControl>
                                <LoadingButton type="submit" variant="contained" color="primary" loading={loading} fullWidth size="large" sx={{ mt: 3, py: 1.5, fontWeight: 'bold', letterSpacing: '0.5px', borderRadius: 2, transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out', '&:hover': { transform: 'scale(1.03)', boxShadow: theme.shadows[6], } }}>
                                    Benutzer erstellen
                                </LoadingButton>
                            </Stack>
                        </CardContent>
                    </Card>
                </Box> {/* Ende Formular Container */}
            </Box> {/* Ende Haupt-Inhaltsbereich */}
        </Box> // Ende Haupt-Container
    );
};

export default CreateUser;
