// src/theme/AppThemeProvider.tsx (or wherever this file is)
import React, { createContext, useState, useMemo, useContext, ReactNode } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider, ThemeOptions } from '@mui/material/styles';
import { PaletteMode, CssBaseline, alpha } from '@mui/material';

// Define custom blue-ish palette colors
const primaryMain = '#1565c0'; // Blue 700 (Base for Light Mode Main)
const primaryLight = '#5e92f3'; // Lighter Blue (Used for Dark Mode Main)
const primaryDark = '#003c8f'; // Darker Blue
const secondaryMain = '#757575'; // Grey 600 (Base for Light Mode Main)
const secondaryLight = '#a4a4a4'; // Lighter Grey (Used for Dark Mode Main)
const secondaryDark = '#494949'; // Darker Grey

const getDesignTokens = (mode: PaletteMode): ThemeOptions => ({
    palette: {
        mode,
        ...(mode === 'light'
            ? {
                // --- Light Mode Palette ---
                primary: {
                    main: primaryMain,    // #1565c0
                    light: primaryLight,  // #5e92f3
                    dark: primaryDark,    // #003c8f
                },
                secondary: {
                    main: secondaryMain,  // #757575
                    light: secondaryLight,// #a4a4a4
                    dark: secondaryDark,  // #494949
                },
                divider: alpha(primaryDark, 0.12), // Subtle divider based on primary
                background: {
                    default: '#f4f6f8', // Very light grey
                    paper: '#ffffff',   // White
                },
                text: {
                    primary: '#212121', // Almost black
                    secondary: '#616161', // Dark grey
                },
                // You could add specific colors for success, warning, error, info if needed
                // success: { main: '#4caf50' },
                // warning: { main: '#ff9800' },
                // error: { main: '#f44336' },
                // info: { main: '#2196f3' },
            }
            : {
                // --- Dark Mode Palette ---
                primary: {
                    main: primaryLight,   // #5e92f3 (Lighter blue for better contrast)
                    light: primaryLight,  // #5e92f3
                    dark: primaryDark,    // #003c8f (Can be used for hover/selected states)
                },
                secondary: {
                    main: secondaryLight, // #a4a4a4 (Lighter grey for better contrast)
                    light: secondaryLight,// #a4a4a4
                    dark: secondaryDark,  // #494949
                },
                divider: alpha('#ffffff', 0.12), // Standard white divider with transparency
                background: {
                    default: '#121212', // Standard dark background
                    paper: '#1e1e1e',   // Slightly lighter for elevated surfaces (cards, appbar, etc.)
                },
                text: {
                    primary: '#ffffff',           // White
                    secondary: alpha('#ffffff', 0.7), // White with transparency
                },
                // Define dark mode specific status colors if needed, often slightly lighter/desaturated
                // success: { main: '#66bb6a' },
                // warning: { main: '#ffa726' },
                // error: { main: '#ef5350' },
                // info: { main: '#42a5f5' },
            }),
    },
    shape: {
        borderRadius: 8, // Consistent rounded corners
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        // You might define h6, button, etc. styles globally here if desired
        // h6: { fontWeight: 500 } // Example
    },
    // Example: Global component style overrides
    components: {
        MuiPaper: {
            styleOverrides: {
                // Example: Default elevation background in dark mode slightly lighter
                // root: ({ theme, ownerState }) => ({
                //   ...(ownerState.elevation && ownerState.elevation > 0 && theme.palette.mode === 'dark' && {
                //     backgroundImage: `linear-gradient(${alpha('#fff', 0.05)}, ${alpha('#fff', 0.05)})`, // Subtle gradient to mimic elevation
                //   }),
                // }),
                outlined: ({ theme }) => ({ // Ensure outlined paper has consistent border
                    borderColor: theme.palette.divider
                }),
            }
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none' // Example: Keep button text case as defined
                }
            }
        },
        MuiAppBar: {
            styleOverrides: {
                // Apply default background blur similar to your dashboard's app bar
                // You might need to adjust the alpha value
                root: ({theme}) => ({
                    ...(theme.palette.mode === 'dark' && {
                        backgroundColor: alpha(theme.palette.background.paper, 0.75),
                        backdropFilter: 'blur(6px)',
                    })
                    // Note: You might need conditional logic if not all AppBars should have this effect
                })
            }
        },
        // You can add overrides for Drawer, ListItems, etc. if needed
        // MuiListItemButton: {
        //     styleOverrides: {
        //         root: ({theme}) => ({
        //             '&.Mui-selected': {
        //                 backgroundColor: alpha(theme.palette.primary.main, 0.08), // Use primary.main for consistency
        //                 '&:hover': {
        //                     backgroundColor: alpha(theme.palette.primary.main, 0.12),
        //                 },
        //                  // Adjust text color if needed based on primary.main used above
        //                 // '& .MuiListItemIcon-root, & .MuiListItemText-primary': {
        //                 //    color: theme.palette.primary.main, // or theme.palette.text.primary
        //                 // },
        //             }
        //         })
        //     }
        // }
    }
});

// --- Context Provider and Hook (Keep as is) ---
interface ThemeContextProps {
    toggleColorMode: () => void;
    mode: PaletteMode;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const AppThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [mode, setMode] = useState<PaletteMode>(() => {
        const storedMode = localStorage.getItem('appThemeMode');
        // Default to light mode if nothing is stored or value is invalid
        return (storedMode === 'dark' || storedMode === 'light') ? storedMode : 'light';
    });

    const toggleColorMode = () => {
        setMode((prevMode) => {
            const newMode = prevMode === 'light' ? 'dark' : 'light';
            localStorage.setItem('appThemeMode', newMode);
            return newMode;
        });
    };

    // Regenerate the theme only when the mode changes
    const theme = useMemo(() => createTheme(getDesignTokens(mode)), [mode]);

    return (
        <ThemeContext.Provider value={{ toggleColorMode, mode }}>
            <MuiThemeProvider theme={theme}>
                {/* CssBaseline applies base styles & enables color scheme preference */}
                <CssBaseline enableColorScheme />
                {children}
            </MuiThemeProvider>
        </ThemeContext.Provider>
    );
};

export const useAppTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useAppTheme must be used within an AppThemeProvider');
    }
    return context;
};