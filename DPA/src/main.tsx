import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import './styles/global.css';
// import './styles/GWTStyles.css'; // Konsti style enable

// --- MUI Imports Start ---
import { ThemeProvider, createTheme, responsiveFontSizes } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
// --- MUI Imports Ende ---

// --- Theme Definition Start ---
// (Kopiere die Theme-Definition von meinem vorherigen Post hierher)
let theme = createTheme({
    palette: {
        primary: {
            main: '#007bff', // Passe dies an GWT-Blau an!
            light: '#69a1ff',
            dark: '#0051cb',
        },
        secondary: {
            main: '#80d8ff', // Helles Blau
            light: '#b5ffff',
            dark: '#49a7cc',
        },
        background: {
            default: '#ffffff',
            paper: '#f8f9fa',
        },
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        h1: { fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif' },
        h2: { fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif' },
        h3: { fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif' },
        h4: { fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif' },
        h5: { fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif' },
        h6: { fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif' },
        button: {
            textTransform: 'none',
            fontWeight: 'bold',
        }
    },
    components: {
        MuiButton: {
            defaultProps: {
                variant: 'contained',
            }
        },
        MuiTextField: {
            defaultProps: {
                variant: 'outlined',
                margin: 'normal',
            }
        }
    }
});
theme = responsiveFontSizes(theme); // Responsive Fonts aktivieren
// --- Theme Definition Ende ---

// --- WICHTIG: Google Fonts Link in public/index.html nicht vergessen! ---
/*
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
*/


const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);

root.render(
    <React.StrictMode>
        {/* 1. ThemeProvider umschließt alles andere */}
        <ThemeProvider theme={theme}>
            {/* 2. CssBaseline direkt nach ThemeProvider */}
            <CssBaseline />
            {/* 3. Deine bestehenden Provider */}
            <BrowserRouter>
                <AuthProvider>
                    {/* 4. Deine App */}
                    <App />
                    {/* Der Toaster in App.tsx ist okay, da App.tsx jetzt innerhalb des ThemeProviders gerendert wird */}
                </AuthProvider>
            </BrowserRouter>
        </ThemeProvider>
    </React.StrictMode>
);