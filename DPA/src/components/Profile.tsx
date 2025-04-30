import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import axios from '../api/axiosInstance';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
// Annahme: User Typ wird hier importiert und definiert die Struktur
import type { User } from '../context/AuthContext'; // Passe Pfad/Namen ggf. an!
import { AxiosError } from 'axios';
import DOMPurify from 'dompurify';
import API_BASE_URL from '../apiConfig';

// --- MUI Imports ---
import {
    Box, AppBar, Toolbar, Typography, CssBaseline, Card, CardContent, CardHeader, CardActions,
    Button, useTheme, CircularProgress, Avatar, Drawer, List, ListItem,
    ListItemText, ListItemButton, ListItemIcon, Divider, Stack, alpha,
    TextField, IconButton, Tooltip, ListSubheader, // ListSubheader für Navbar
    Dialog, DialogActions, DialogContent, DialogTitle
} from '@mui/material';
import { LoadingButton } from '@mui/lab';

// --- Icons ---
import {
    Home as HomeIcon, // Für Navbar
    AccountCircle as ProfileIcon, // Für Navbar & Header
    Edit as EditIcon, CameraAlt as CameraAltIcon, // CameraAltIcon wird nicht mehr direkt angezeigt
    Phone as PhoneIcon, LocationOn as LocationIcon, Email as EmailIcon,
    Badge as BadgeIcon // Beispiel für Username/Rolle
} from '@mui/icons-material';

// --- Bild-Import für Logo ---
import logo from '../images/Logo.png';
// --- Default Profilbild Path ---
const defaultProfileImage = '/Default.png'; // Wie gewünscht

// --- Navbar Komponente (Unverändert) ---
const drawerWidth = 240;
interface ProfileNavItem { text: string; icon: React.ReactElement; path: string; }

const ProfileNavbar: React.FC = () => {
    const location = useLocation(); const navigate = useNavigate(); const { user } = useAuth(); const theme = useTheme();
    const navItems: ProfileNavItem[] = [
        { text: 'Mein Profil', icon: <ProfileIcon />, path: '/profile' },
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
                <ListSubheader sx={{ bgcolor: 'transparent', fontWeight: 'bold', color: 'text.primary' }}> Profil </ListSubheader>
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
// --- Ende ProfileNavbar Komponente ---


const Profile: React.FC = () => {
    // --- States (unverändert) ---
    const [userId, setUserId] = useState<number | null>(null); const [username, setUsername] = useState(""); const [email, setEmail] = useState(""); const [phoneNumber, setPhoneNumber] = useState(""); const [location, setLocation] = useState(""); const [profileImage, setProfileImage] = useState<string | null>(null); const [initialPhoneNumber, setInitialPhoneNumber] = useState(""); const [initialLocation, setInitialLocation] = useState(""); const [openEditDialog, setOpenEditDialog] = useState(false); const [loading, setLoading] = useState(false); const [imageUploadLoading, setImageUploadLoading] = useState(false);

    // --- Hooks (unverändert) ---
    const navigate = useNavigate(); const theme = useTheme(); const { user: contextUser, login: updateUserContext } = useAuth(); const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Effekt zum Laden der User-Daten (unverändert) ---
    useEffect(() => {
        let userToLoad: any = null; if (contextUser) { userToLoad = contextUser; } else { const storedUser = localStorage.getItem("user"); if (storedUser) { try { userToLoad = JSON.parse(storedUser); } catch { toast.error("Sitzungsinformationen fehlerhaft."); navigate("/login"); return; } } else { navigate("/login"); return; } }
        if (userToLoad) { setUserId(userToLoad.id); setUsername(userToLoad.username); setEmail(userToLoad.email); setProfileImage(userToLoad.profileImageUrl || null); setPhoneNumber(userToLoad.phoneNumber || ""); setLocation(userToLoad.location || ""); }
    }, [contextUser, navigate]);

    // --- Validierung (unverändert) ---
    const validatePhoneNumber = (number: string) => /^\+?[0-9\s\-()]{7,20}$/.test(number);

    // --- Bild-Upload Handler (unverändert) ---
    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file || !userId || !contextUser || typeof contextUser.id !== 'number') { toast.error("Benutzerdaten nicht vollständig geladen."); return; }
        const formData = new FormData(); formData.append("file", file); setImageUploadLoading(true); const toastId = toast.loading("Lade Profilbild hoch...");
        try {
            const res = await axios.post(`${API_BASE_URL}/users/upload-profile-image`, formData, { headers: { "Content-Type": "multipart/form-data" } }); const newImageUrl = res.data.imageUrl; setProfileImage(newImageUrl);
            const updatedUserData: User = { ...contextUser, id: contextUser.id, profileImageUrl: newImageUrl || undefined, username: contextUser.username ?? "", email: contextUser.email ?? "", role: contextUser.role ?? "User", token: contextUser.token ?? "", phoneNumber: contextUser.phoneNumber ?? "", location: contextUser.location ?? "" };
            if (typeof updatedUserData.id !== 'number' || !updatedUserData.username || !updatedUserData.email || !updatedUserData.role || !updatedUserData.token) { console.error("Fehlende erforderliche Benutzerdaten für Context Update:", updatedUserData); toast.error("Fehler beim Aktualisieren der Benutzerdaten im Context."); return; }
            updateUserContext(updatedUserData); localStorage.setItem("user", JSON.stringify(updatedUserData)); toast.success("Bild erfolgreich hochgeladen!", { id: toastId });
        } catch (error) { console.error("Fehler beim Bild-Upload:", error); toast.error("Bild konnte nicht hochgeladen werden.", { id: toastId }); } finally { setImageUploadLoading(false); }
    };

    // --- Edit Dialog öffnen/schließen (unverändert) ---
    const handleOpenEditDialog = () => { setInitialPhoneNumber(phoneNumber); setInitialLocation(location); setOpenEditDialog(true); };
    const handleCloseEditDialog = (saved = false) => { setOpenEditDialog(false); if (!saved) { setPhoneNumber(initialPhoneNumber); setLocation(initialLocation); } };

    // --- Profil speichern Handler (unverändert) ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); if (phoneNumber && !validatePhoneNumber(phoneNumber)) { toast.error("Bitte gib eine gültige Telefonnummer ein."); return; } if (location && location.trim() === "") { toast.error("Standort darf nicht nur aus Leerzeichen bestehen."); return; }
        if (!contextUser || typeof contextUser.id !== 'number') { toast.error("Benutzerdaten nicht vollständig geladen."); return; }
        const sanitizedPhoneNumber = phoneNumber ? DOMPurify.sanitize(phoneNumber.trim()) : ""; const sanitizedLocation = location ? DOMPurify.sanitize(location.trim()) : "";
        setLoading(true); const toastId = toast.loading("Speichere Profil...");
        try {
            await axios.put(`${API_BASE_URL}/users/update-profile`, { phoneNumber: sanitizedPhoneNumber, location: sanitizedLocation, }); toast.success("Profil erfolgreich aktualisiert!", { id: toastId });
            const updatedUserData: User = { ...contextUser, id: contextUser.id, phoneNumber: sanitizedPhoneNumber || undefined, location: sanitizedLocation || undefined, profileImageUrl: profileImage || undefined, username: contextUser.username ?? "", email: contextUser.email ?? "", role: contextUser.role ?? "User", token: contextUser.token ?? "", };
            if (typeof updatedUserData.id !== 'number' || !updatedUserData.username || !updatedUserData.email || !updatedUserData.role || !updatedUserData.token) { console.error("Fehlende erforderliche Benutzerdaten für Context Update:", updatedUserData); toast.error("Fehler beim Aktualisieren der Benutzerdaten im Context."); return; }
            updateUserContext(updatedUserData); localStorage.setItem("user", JSON.stringify(updatedUserData)); handleCloseEditDialog(true);
        } catch (error) { console.error("Fehler beim Aktualisieren des Profils:", error); toast.error("Fehler beim Aktualisieren des Profils.", { id: toastId }); } finally { setLoading(false); }
    };

    // --- Trigger für versteckten File Input (unverändert) ---
    const handleAvatarClick = () => {
        // Verhindere Klick, wenn gerade hochgeladen wird
        if (imageUploadLoading) return;
        fileInputRef.current?.click();
    };

    // --- Rendering ---
    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            <ProfileNavbar />

            {/* Haupt-Inhaltsbereich */}
            <Box component="main" sx={{ flexGrow: 1, bgcolor: theme.palette.grey[100], p: 3, minHeight: '100vh' }}>
                {/* AppBar / Header */}
                <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1, backgroundColor: 'white', color: theme.palette.text.primary, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <Toolbar> <ProfileIcon sx={{ mr: 1, color: 'primary.main' }} /> <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}> Mein Profil </Typography> <Typography sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>{username} ({contextUser?.role})</Typography> <Avatar src={profileImage || defaultProfileImage} alt={username} sx={{ bgcolor: theme.palette.primary.main }}>{username?.charAt(0).toUpperCase()}</Avatar> </Toolbar>
                </AppBar>
                <Toolbar />

                {/* Profil-Karte Container */}
                <Box sx={{ maxWidth: '800px', margin: 'auto', mt: 4 }}>
                    <Card elevation={5} sx={{ borderRadius: 4, overflow: 'hidden' }}>
                        {/* Header mit Hintergrund & Avatar */}
                        <Box sx={{ p: 3, background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`, color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                            {/* Profilbild prominent im Header */}
                            <Box sx={{ position: 'relative', mb: 2 }}>
                                {/* Tooltip jetzt um den Avatar gelegt */}
                                <Tooltip title="Profilbild ändern (klicken)" placement="top">
                                    <Avatar
                                        alt={username}
                                        src={profileImage || defaultProfileImage}
                                        sx={{
                                            width: 140, height: 140,
                                            border: `4px solid ${theme.palette.background.paper}`,
                                            cursor: imageUploadLoading ? 'default' : 'pointer', // Cursor ändern bei Upload
                                            transition: 'transform 0.3s ease, box-shadow 0.3s ease, opacity 0.2s ease',
                                            opacity: imageUploadLoading ? 0.6 : 1, // Leichte Transparenz bei Upload
                                            '&:hover': {
                                                transform: imageUploadLoading ? 'none' : 'scale(1.05)', // Kein Hover-Effekt bei Upload
                                                boxShadow: imageUploadLoading ? 'none' : theme.shadows[8]
                                            }
                                        }}
                                        onClick={handleAvatarClick} // Klick löst Upload aus
                                    />
                                </Tooltip>
                                {/* Versteckter Input */}
                                <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageChange} />
                                {/* Ladeanzeige */}
                                {imageUploadLoading && ( <CircularProgress size={152} sx={{ color: 'white', position: 'absolute', top: -6, left: -6, zIndex: 1, }} /> )}
                                {/* --- Kamera-Icon Button ENTFERNT --- */}
                                {/* <Tooltip title="Profilbild ändern">...</Tooltip> */}
                            </Box>
                            {/* Username und Rolle im Header */}
                            <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', textAlign: 'center' }}> {username} </Typography>
                            <Typography variant="body1" sx={{ textAlign: 'center', opacity: 0.9 }}> {contextUser?.role} </Typography>
                        </Box>

                        {/* Detail-Sektion */}
                        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', mb: 2 }}> Kontaktdetails </Typography>
                            <Stack spacing={2}>
                                <Box sx={{ display: 'flex', alignItems: 'center', p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.grey[500], 0.05) }}> <EmailIcon sx={{ mr: 2, color: 'text.secondary' }} /> <Box> <Typography variant="caption" color="text.secondary">E-Mail</Typography> <Typography variant="body1" sx={{ wordBreak: 'break-all' }}>{email}</Typography> </Box> </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.grey[500], 0.05) }}> <PhoneIcon sx={{ mr: 2, color: 'text.secondary' }} /> <Box> <Typography variant="caption" color="text.secondary">Telefonnummer</Typography> <Typography variant="body1">{phoneNumber || <Typography component="span" fontStyle="italic" color="text.disabled">Nicht angegeben</Typography>}</Typography> </Box> </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', p: 1.5, borderRadius: 1, bgcolor: alpha(theme.palette.grey[500], 0.05) }}> <LocationIcon sx={{ mr: 2, color: 'text.secondary' }} /> <Box> <Typography variant="caption" color="text.secondary">Standort</Typography> <Typography variant="body1">{location || <Typography component="span" fontStyle="italic" color="text.disabled">Nicht angegeben</Typography>}</Typography> </Box> </Box>
                            </Stack>
                        </CardContent>
                        <Divider />
                        <CardActions sx={{ justifyContent: 'flex-end', p: 2, bgcolor: theme.palette.grey[50] }}> <Button variant="contained" startIcon={<EditIcon />} onClick={handleOpenEditDialog}> Kontaktdaten Bearbeiten </Button> </CardActions>
                    </Card>
                </Box>

                {/* Edit Dialog (unverändert) */}
                <Dialog open={openEditDialog} onClose={() => handleCloseEditDialog(false)} maxWidth="xs" fullWidth>
                    <DialogTitle sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>Kontaktdaten bearbeiten</DialogTitle>
                    <Box component="form" onSubmit={handleSubmit}>
                        <DialogContent sx={{ pt: '20px !important' }}>
                            <Stack spacing={3}>
                                <TextField label="Telefonnummer" type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} fullWidth variant="outlined" placeholder="+43 123 45678" helperText={phoneNumber && !validatePhoneNumber(phoneNumber) ? "Ungültiges Format" : ""} error={!!(phoneNumber && !validatePhoneNumber(phoneNumber))} />
                                <TextField label="Standort" type="text" value={location} onChange={e => setLocation(e.target.value)} fullWidth variant="outlined" placeholder="z.B. Wien, Österreich" />
                            </Stack>
                        </DialogContent>
                        <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}> <Button onClick={() => handleCloseEditDialog(false)} color="inherit"> Abbrechen </Button> <LoadingButton type="submit" variant="contained" color="primary" loading={loading}> Speichern </LoadingButton> </DialogActions>
                    </Box>
                </Dialog>

            </Box> {/* Ende Haupt-Inhaltsbereich */}
        </Box> // Ende Haupt-Container
    );
};

export default Profile;
