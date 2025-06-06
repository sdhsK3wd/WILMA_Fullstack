import React, { Suspense } from 'react'; // Import Suspense
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import './styles/global.css';
// import './styles/GWTStyles.css';

// --- MUI Imports ---
// ThemeProvider is now handled by AppThemeProvider
// createTheme and responsiveFontSizes are used inside AppThemeProvider
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box'; // For Suspense fallback
import CircularProgress from '@mui/material/CircularProgress'; // For Suspense fallback

// --- Custom Theme Provider ---
import { AppThemeProvider } from './context/ThemeContext'; // Import your theme provider

// --- i18n Initialization ---
import './i18n'; // Import the i18n configuration file to initialize it

// --- Toaster ---
import { Toaster } from 'react-hot-toast'; // Keep Toaster import

// --- Remove Inline Theme Definition ---
// let theme = createTheme({ ... }); // This section is removed
// theme = responsiveFontSizes(theme); // This is removed

const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);

root.render(
    <React.StrictMode>
        {/* Wrap everything in Suspense for i18n loading */}
        <Suspense fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#121212' /* Initial dark bg */ }}>
                <CircularProgress color="primary"/>
            </Box>
        }>
            {/* Use AppThemeProvider instead of ThemeProvider + inline theme */}
            <AppThemeProvider>
                <CssBaseline enableColorScheme /> {/* enableColorScheme helps with default scrollbars etc. */}
                <BrowserRouter>
                    <AuthProvider>
                        <App />
                        {/* Place Toaster inside providers if it needs context, otherwise here is fine */}
                        <Toaster position="bottom-right" />
                    </AuthProvider>
                </BrowserRouter>
            </AppThemeProvider>
        </Suspense>
    </React.StrictMode>
);