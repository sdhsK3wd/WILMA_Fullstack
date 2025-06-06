// src/i18n.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
    // Load translations using http backend (fetches files from public/locales)
    .use(Backend)
    // Detect user language
    .use(LanguageDetector)
    // Pass the i18n instance to react-i18next.
    .use(initReactI18next)
    // Initialize i18next
    .init({
        // Set default and fallback language
        fallbackLng: 'en',
        lng: localStorage.getItem('appLanguage') || 'en', // Use stored or default to EN

        // Namespace(s) - 'translation' is the default
        ns: ['translation'],
        defaultNS: 'translation',

        debug: process.env.NODE_ENV === 'development', // Enable debug output in development

        // Configuration for LanguageDetector
        detection: {
            // Order and from where user language should be detected
            order: ['localStorage', 'navigator'],
            // Cache user language in localStorage
            caches: ['localStorage'],
            // localStorage key
            lookupLocalStorage: 'appLanguage', // Use the same key as your old context
        },

        // Configuration for Backend
        backend: {
            // Path where translation files will be loaded from
            loadPath: '/locales/{{lng}}/{{ns}}.json', // Loads /locales/en/translation.json etc.
        },

        interpolation: {
            escapeValue: false, // React already safes from xss
        },

        // React specific configuration
        react: {
            useSuspense: true, // Recommended: use Suspense for loading translations
        }
    });

export default i18n;