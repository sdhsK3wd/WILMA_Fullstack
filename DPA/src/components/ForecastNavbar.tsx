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
    Analytics as AnalyseIcon, // Icon für Analyse/Dashboard
    NotificationsActive as StatusIcon, // Icon für Status
    // Füge hier weitere Icons hinzu, falls deine Forecast-Navbar mehr Links bekommen soll
} from '@mui/icons-material';

const drawerWidth = 240;

// NavItem Interface verwenden (oder importieren, falls du eine zentrale Datei hast)
interface NavItem { textKey: string; icon: React.ReactElement; path: string; }


const ForecastNavbar: React.FC = () => {
    const location = useLocation();
    const theme = useMuiTheme();
    const { t } = useTranslation(); // t Funktion holen

    // Navigationspunkte mit Übersetzungsschlüsseln
    const navItems: NavItem[] = [
        { textKey: 'navbar.forecastAnalyse', icon: <AnalyseIcon />, path: '/dashboard' },
        { textKey: 'navbar.forecastStatus', icon: <StatusIcon />, path: '/forecast-status' },
        // Füge hier weitere spezifische Links für den Forecast-Bereich hinzu, falls nötig
    ];

    // Sortieren nach übersetztem Text
    const sortedNavItems = navItems.sort((a, b) => t(a.textKey).localeCompare(t(b.textKey)));

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


    return (
        <Drawer variant="permanent" sx={{ width: drawerWidth, flexShrink: 0, [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box', borderRight: `1px solid ${theme.palette.divider}` }, }}>
            {/* Toolbar als Platzhalter */}
            <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1, minHeight: '64px !important' }}>
                {/* Logo oder Titel hier */}
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

                {/* Forecast Sektion */}
                <Divider sx={{ my: 1 }}/>
                {/* Überschrift übersetzen */}
                <ListSubheader sx={{ bgcolor: 'transparent', fontWeight: 'bold', color: 'text.primary' }}> {t('navbar.forecastTitle')} </ListSubheader> {/* Übersetzung verwenden */}

                {/* Forecast Links */}
                {renderNavItems(sortedNavItems)}

            </List>
        </Drawer>
    );
};

export default ForecastNavbar;
