import React, { useEffect } from 'react'; // useEffect für die Umleitungslogik
import { useTheme as useMuiTheme } from '@mui/material/styles';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; // useTranslation importieren
import toast from 'react-hot-toast'; // Für Toast-Nachrichten
import { useAuth } from '../context/AuthContext'; // Für User und isAdmin Check

import {
    Box, Toolbar, Drawer, List, ListItem,
    ListItemText, ListItemButton, ListItemIcon, Divider,
    ListSubheader, alpha
} from '@mui/material';

import {
    Home as HomeIcon,
    PersonAdd as CreateUserIconMui, // Icon für Benutzer erstellen
    ListAlt as UserListIcon // Icon für Benutzerliste
} from '@mui/icons-material';

// import logo from '../images/Logo.png'; // Importiere Logo falls in Navbar benötigt

const drawerWidth = 240;

// NavItem Interface verwenden (oder importieren, falls du eine zentrale Datei hast)
interface NavItem { textKey: string; icon: React.ReactElement; path: string; }


const UserManagementNavbar: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, isAdmin } = useAuth(); // user und isAdmin holen
    const theme = useMuiTheme(); // Verwende useMuiTheme für Konsistenz mit anderen Komponenten
    const { t } = useTranslation(); // t Funktion holen

    // Navigationspunkte mit Übersetzungsschlüsseln
    const navItems: NavItem[] = [
        { textKey: 'navbar.userList', icon: <UserListIcon />, path: '/user-list' },
        { textKey: 'navbar.createUser', icon: <CreateUserIconMui />, path: '/create-user' },
    ];

    // Sortieren nach übersetztem Text (wie in ProfileNavbar)
    const sortedNavItems = navItems.sort((a, b) => t(a.textKey).localeCompare(t(b.textKey)));

    // Berechtigungsprüfung (wie in UserList/CreateUser)
    useEffect(() => {
        // Warte bis User-Status geladen ist (user !== undefined)
        // Wenn User geladen ist UND nicht Admin ist
        if (user !== undefined && !isAdmin) {
            toast.error(t('common.accessDenied')); // <-- Toast übersetzen (Reuse)
            navigate('/home', { replace: true }); // Nutze replace: true nach Umleitung
        }
        // Optional: Prüfen, ob User null ist und ggf. zum Login leiten, falls noch nicht global behandelt
        if (user === null) {
            // toast.error(t('common.authTokenMissingToast')); // Optional Toast
            // navigate('/login', { replace: true });
        }

    }, [user, isAdmin, navigate, t]); // Abhängigkeiten: user, isAdmin, navigate, t


    // Helper function to render nav items
    const renderNavItems = (items: NavItem[]) => (
        items.map((item) => {
            const isSelected = location.pathname === item.path;
            return (
                <ListItem key={item.textKey} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton component={RouterLink} to={item.path} selected={isSelected} sx={{
                        borderRadius: 1,
                        '&.Mui-selected': {
                            backgroundColor: alpha(theme.palette.primary.light, 0.12),
                            '&:hover': { backgroundColor: alpha(theme.palette.primary.light, 0.18), },
                            '& .MuiListItemIcon-root, & .MuiListItemText-primary': { color: theme.palette.primary.main, fontWeight: 600, },
                        },
                        '&:hover': { backgroundColor: theme.palette.action.hover }
                    }}>
                        <ListItemIcon sx={{ minWidth: 40, color: isSelected ? theme.palette.primary.main : 'inherit' }}>
                            {item.icon}
                        </ListItemIcon>
                        {/* Übersetzung verwenden */}
                        <ListItemText primary={t(item.textKey)} />
                    </ListItemButton>
                </ListItem>
            );
        })
    );


    // Rendere null oder einen Ladeindikator, solange der User-Status nicht geladen ist
    // Dies verhindert ein kurzes Aufblitzen der Navbar bevor die Umleitung stattfindet
    if (user === undefined) {
        return null; // Oder ein kleines Lade-Skeleton für die Navbar
    }


    // Rendere die Navbar nur, wenn der User Admin ist
    if (!isAdmin) {
        return null; // User ist nicht Admin, zeige keine Navbar an (Umleitung findet in useEffect statt)
    }


    return (
        <Drawer variant="permanent" sx={{ width: drawerWidth, flexShrink: 0, [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box', borderRight: `1px solid ${theme.palette.divider}` }, }}>
            {/* Toolbar als Platzhalter oder für Logo */}
            <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1, minHeight: '64px !important' }}>
                {/* Beispiel Logo: <img src={logo} alt="GWT Logo" style={{ height: 40, width: 'auto' }} /> */}
            </Toolbar>
            <Divider />
            <List sx={{ padding: 1 }}>
                {/* Startseite Link */}
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton component={RouterLink} to="/home" sx={{ borderRadius: 1, '&:hover': { backgroundColor: theme.palette.action.hover, } }}>
                        <ListItemIcon sx={{ minWidth: 40 }}> <HomeIcon /> </ListItemIcon>
                        <ListItemText primary={t('common.home')} /> {/* Übersetzung verwenden */}
                    </ListItemButton>
                </ListItem>

                {/* Benutzerverwaltung Sektion */}
                <Divider sx={{ my: 1 }}/>
                {/* Überschrift übersetzen */}
                <ListSubheader sx={{ bgcolor: 'transparent', fontWeight: 'bold', color: 'text.primary' }}> {t('navbar.userManagementTitle')} </ListSubheader> {/* Übersetzung verwenden */}

                {/* Benutzerverwaltungs-Links */}
                {renderNavItems(sortedNavItems)}

            </List>
        </Drawer>
    );
};

export default UserManagementNavbar;