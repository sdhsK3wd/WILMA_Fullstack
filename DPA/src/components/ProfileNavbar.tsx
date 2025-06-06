import React from 'react';
import { useTheme as useMuiTheme } from '@mui/material/styles';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next'; // useTranslation importieren

import {
    Box, Toolbar, Drawer, List, ListItem,
    ListItemText, ListItemButton, ListItemIcon, Divider,
    ListSubheader, alpha
} from '@mui/material';

import {
    Home as HomeIcon,
    AccountCircle as ProfileIcon,
    Settings as SettingsIcon,
    // Andere Icons entfernt, da sie hier nicht benötigt werden
} from '@mui/icons-material';


const drawerWidth = 240;

interface NavItem { textKey: string; icon: React.ReactElement; path: string; } // Generischerer Name


const ProfileNavbar: React.FC = () => {
    const location = useLocation();
    const theme = useMuiTheme();
    const { t } = useTranslation(); // t Funktion holen

    // Navigationspunkte NUR für den Profil-Bereich
    // Definiere die gewünschte Reihenfolge hier.
    // Zum Beispiel: "Mein Profil" vor "Einstellungen"
    const profileNavItems: NavItem[] = [
        { textKey: 'navbar.myProfile', icon: <ProfileIcon />, path: '/profile' },
        { textKey: 'navbar.profileSettings', icon: <SettingsIcon />, path: '/profile/settings' },
    ];
    // Oder wenn du "Einstellungen" vor "Mein Profil" haben möchtest, ändere die Reihenfolge im Array oben.


    // KORREKTUR: KEINE Sortierung mehr basierend auf übersetztem Text
    // Die Zeile "const sortedProfileNavItems = profileNavItems.sort(...)" wurde entfernt.
    // Die Reihenfolge ergibt sich nun aus der Definition im Array 'profileNavItems'.


    // Helper function to render nav items (Diese Funktion bleibt gleich)
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
                        <ListItemIcon sx={{ minWidth: 40 }}> {item.icon} </ListItemIcon>
                        {/* Übersetzung verwenden */}
                        <ListItemText primary={t(item.textKey)} />
                    </ListItemButton>
                </ListItem>
            );
        })
    );


    return (
        <Drawer variant="permanent" sx={{ width: drawerWidth, flexShrink: 0, [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box', borderRight: `1px solid ${theme.palette.divider}` }, }}>
            <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1, minHeight: '64px !important' }}>
                {/* Hier könntest du z.B. ein Logo oder App-Namen anzeigen */}
            </Toolbar>
            <Divider />
            <List sx={{ padding: 1 }}>
                {/* Startseite ist oft immer da und sollte übersetzt werden */}
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton component={RouterLink} to="/home" sx={{ borderRadius: 1, '&:hover': { backgroundColor: theme.palette.action.hover, } }}>
                        <ListItemIcon sx={{ minWidth: 40 }}> <HomeIcon /> </ListItemIcon>
                        {/* Übersetzung verwenden */}
                        <ListItemText primary={t('common.home')} />
                    </ListItemButton>
                </ListItem>

                {/* Profil Sektion */}
                <Divider sx={{ my: 1 }}/>
                {/* Überschrift übersetzen */}
                <ListSubheader sx={{ bgcolor: 'transparent', fontWeight: 'bold', color: 'text.primary' }}> {t('navbar.profileTitle')} </ListSubheader>
                {/* KORRIGIERT: Verwende profileNavItems direkt (nicht die sortierte Version) */}
                {renderNavItems(profileNavItems)}

                {/* Keine weiteren Sektionen wie Benutzerverwaltung, Forecast etc. hier */}

            </List>
        </Drawer>
    );
};

export default ProfileNavbar;