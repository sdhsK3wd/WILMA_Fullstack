import React, { useEffect, useState } from 'react';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import axios from '../api/axiosInstance';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { AxiosError } from 'axios';
import API_BASE_URL from '../apiConfig';

// --- MUI Imports ---
import {
    Box, AppBar, Toolbar, Typography, CssBaseline, Paper,
    Button, useTheme, CircularProgress, Avatar, Drawer, List, ListItem,
    ListItemText, ListItemButton, ListItemIcon, Divider, alpha,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    IconButton, Chip, ListSubheader,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle
} from '@mui/material';

// --- Icons ---
import {
    Home as HomeIcon,
    PersonAdd as CreateUserIcon,
    ListAlt as ListAltIcon, // Sicherstellen, dass der Name korrekt ist
    Delete as DeleteIcon,
    Group as GroupIcon
} from '@mui/icons-material';

// --- Bild-Import für Logo & Default Profilbild ---
import logo from '../images/Logo.png';
// Pfad relativ zum 'public'-Ordner. Sicherstellen, dass die Datei dort ist und ausgeliefert wird.
import defaultProfileImage from '/Default.png';

// --- Interface für User (unverändert) ---
interface User { id: number; username: string; email: string; role: string; profileImageUrl?: string; }

// --- UserManagementNavbar Komponente ---
const drawerWidth = 240;
interface UserMgmtNavItem { text: string; icon: React.ReactElement; path: string; }

const UserManagementNavbar: React.FC = () => {
    const location = useLocation(); const navigate = useNavigate(); const { user } = useAuth(); const theme = useTheme();
    const navItems: UserMgmtNavItem[] = [
        { text: 'Benutzerliste', icon: <ListAltIcon />, path: '/user-list' },
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


const UserList: React.FC = () => {
    // --- States ---
    const [users, setUsers] = useState<User[]>([]); const [isLoading, setIsLoading] = useState<boolean>(true); const [userToDelete, setUserToDelete] = useState<User | null>(null); const [openDeleteDialog, setOpenDeleteDialog] = useState<boolean>(false);

    // --- Hooks ---
    const { user: loggedInUser } = useAuth(); const theme = useTheme();

    // --- Daten laden ---
    useEffect(() => {
        const fetchUsers = async () => {
            setIsLoading(true); try { const res = await axios.get(`${API_BASE_URL}/users/all`); setUsers(res.data); } catch (error) { console.error("Fehler beim Laden der Benutzer:", error); toast.error("Fehler beim Laden der Benutzerliste."); } finally { setIsLoading(false); }
        };
        fetchUsers();
    }, []);

    // --- Löschen Handling mit Dialog ---
    const handleDeleteClick = (user: User) => { setUserToDelete(user); setOpenDeleteDialog(true); };
    const handleCloseDeleteDialog = () => { setOpenDeleteDialog(false); setUserToDelete(null); };
    const handleConfirmDelete = async () => {
        if (!userToDelete) return; if (loggedInUser?.role !== "Admin" || userToDelete.role === "Admin") { toast.error("Aktion nicht erlaubt."); handleCloseDeleteDialog(); return; }
        const toastId = toast.loading("Lösche Benutzer..."); try { await axios.delete(`${API_BASE_URL}/users/${userToDelete.id}`); setUsers(users.filter(user => user.id !== userToDelete.id)); toast.success(`Benutzer "${userToDelete.username}" gelöscht.`, { id: toastId }); } catch (error) { console.error("Fehler beim Löschen:", error); toast.error("Fehler beim Löschen des Benutzers.", { id: toastId }); } finally { handleCloseDeleteDialog(); }
    };

    // --- Rendering ---
    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            <UserManagementNavbar />

            {/* Haupt-Inhaltsbereich */}
            <Box component="main" sx={{ flexGrow: 1, bgcolor: theme.palette.grey[100], p: 3, minHeight: '100vh' }}>
                {/* AppBar / Header */}
                <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1, backgroundColor: 'white', color: theme.palette.text.primary, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <Toolbar>
                        <ListAltIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}> Benutzerliste </Typography>
                        <Typography sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>{loggedInUser?.username} ({loggedInUser?.role})</Typography>
                        <Avatar src={loggedInUser?.profileImageUrl || undefined} sx={{ bgcolor: theme.palette.primary.main }}>{loggedInUser?.username?.charAt(0).toUpperCase()}</Avatar>
                    </Toolbar>
                </AppBar>
                <Toolbar /> {/* Abstandshalter */}

                {/* Container für die Tabelle */}
                <Paper sx={{ mt: 2, width: '100%', overflow: 'hidden', borderRadius: 2, boxShadow: theme.shadows[3] }}>
                    <TableContainer sx={{ maxHeight: 'calc(100vh - 160px)' }}>
                        <Table stickyHeader aria-label="Benutzerliste Tabelle">
                            <TableHead>
                                <TableRow sx={{ '& th': { backgroundColor: alpha(theme.palette.grey[200], 0.7), fontWeight: 'bold' } }}>
                                    <TableCell align="center" sx={{ width: '10%' }}>Profilbild</TableCell>
                                    <TableCell>Benutzername</TableCell>
                                    <TableCell>E-Mail</TableCell>
                                    <TableCell align="center">Rolle</TableCell>
                                    <TableCell align="center">Aktionen</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {isLoading ? ( <TableRow> <TableCell colSpan={5} align="center" sx={{ py: 4 }}> <CircularProgress /> </TableCell> </TableRow> ) : users.length === 0 ? ( <TableRow> <TableCell colSpan={5} align="center" sx={{ py: 4 }}> Keine Benutzer gefunden. </TableCell> </TableRow> ) : (
                                    users.map((user) => (
                                        <TableRow key={user.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                            <TableCell align="center"> <Avatar alt={user.username} src={user.profileImageUrl || defaultProfileImage} sx={{ width: 40, height: 40, margin: 'auto' }} /> </TableCell>
                                            <TableCell component="th" scope="row"> {user.username} </TableCell>
                                            <TableCell>{user.email}</TableCell>
                                            <TableCell align="center"> {user.role === "Admin" ? ( <Chip label="Admin" color="primary" size="small" variant="filled" /> ) : ( <Chip label="User" color="default" size="small" variant="outlined" /> )} </TableCell>
                                            <TableCell align="center">
                                                {loggedInUser?.role === "Admin" && user.role !== "Admin" ? ( <IconButton aria-label="delete user" color="error" size="small" onClick={() => handleDeleteClick(user)} title={`Benutzer ${user.username} löschen`}> <DeleteIcon /> </IconButton> ) : user.role === "Admin" ? ( <Typography variant="caption" color="text.disabled">-</Typography> ) : ( <Typography variant="caption" color="text.disabled">-</Typography> )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>

                {/* Lösch-Bestätigungsdialog */}
                <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog} aria-labelledby="alert-dialog-title" aria-describedby="alert-dialog-description">
                    <DialogTitle id="alert-dialog-title"> Benutzer löschen bestätigen </DialogTitle>
                    <DialogContent> <DialogContentText id="alert-dialog-description"> Möchtest du den Benutzer "{userToDelete?.username}" wirklich unwiderruflich löschen? </DialogContentText> </DialogContent>
                    <DialogActions sx={{ p: 2 }}> <Button onClick={handleCloseDeleteDialog} color="inherit"> Abbrechen </Button> <Button onClick={handleConfirmDelete} color="error" variant="contained" autoFocus> Löschen </Button> </DialogActions>
                </Dialog>

            </Box> {/* Ende Haupt-Inhaltsbereich */}
        </Box> // Ende Haupt-Container
    );
};

export default UserList; // Dies MUSS die letzte Zeile sein.