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
    HowToVote as PollsIcon,
    // Füge hier weitere Icons hinzu, falls deine Polls-Navbar mehr Links bekommen soll
} from '@mui/icons-material';


const drawerWidth = 240;

interface NavItem { textKey: string; icon: React.ReactElement; path: string; } // Generischeres Interface

const PollsNavbar: React.FC = () => {
    const location = useLocation();
    const theme = useMuiTheme();
    const { t } = useTranslation(); // t Funktion holen

    // Navigationspunkte für den Abstimmungs-Bereich
    const pollsNavItems: NavItem[] = [
        { textKey: 'navbar.polls', icon: <PollsIcon />, path: '/polls' },
        // Füge hier weitere spezifische Links für den Polls-Bereich hinzu, falls nötig
    ];

    // Keine Sortierung für eine feste Reihenfolge
    // const sortedPollsNavItems = pollsNavItems.sort((a, b) => t(a.textKey).localeCompare(t(b.textKey)));

    // Helper function to render nav items (kann beibehalten oder aus einem gemeinsamen Ort importiert werden)
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

                {/* Abstimmungs Sektion */}
                <Divider sx={{ my: 1 }}/>
                {/* Überschrift übersetzen - Annahme Key 'navbar.forecastTitle' war ein Fehler, verwenden 'navbar.pollsTitle' oder ähnlich */}
                <ListSubheader sx={{ bgcolor: 'transparent', fontWeight: 'bold', color: 'text.primary' }}> {t('navbar.pollsTitle')} </ListSubheader> {/* Überschrift übersetzen */}
                {/* Verwende die pollsNavItems in ihrer definierten Reihenfolge */}
                {renderNavItems(pollsNavItems)}

            </List>
        </Drawer>
    );
};

export default PollsNavbar;