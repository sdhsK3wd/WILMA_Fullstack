// src/components/Dashboard.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import forecastApi from '../api/forecastApi';
import axiosStatic, { AxiosError } from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

import {
    Box, AppBar, Toolbar, Typography, CssBaseline, CardContent, CardHeader, Skeleton,
    Button, useTheme, CircularProgress, Avatar,
    Stack, alpha,
    Select, MenuItem, FormControl, InputLabel, Paper, InputAdornment,
    TextField,
    List, ListItem, ListItemText, Alert, AlertTitle,
    IconButton,
    Tooltip as MuiTooltip,
    Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import {
    LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, Legend, Brush, ReferenceArea, ReferenceLine, Label, TooltipProps, Dot
} from 'recharts';
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

import { parseISO, format, addHours, differenceInDays, addDays, addMonths, startOfDay, startOfWeek, startOfMonth, startOfYear } from 'date-fns';
import { de, enUS } from 'date-fns/locale';
const locales = { en: enUS, de: de };
import {
    UploadFile as UploadFileIcon,
    Analytics as AnalyseIcon,
    Water as WaterIcon,
    CalendarMonth as CalendarIcon,
    ModelTraining as ModelIcon,
    Science as TensorFlowIcon,
    QueryStats as ProphetIcon,
    ErrorOutline as ErrorIcon,
    CheckCircleOutline as CheckCircleIcon,
    ReportProblemOutlined as ReportProblemOutlinedIcon,
    PublishedWithChanges as AnalyzeAndMarkIcon,
    TaskAlt as MarkAsNotAnomalyIcon,
    ReportProblem as IsAnomalyIcon,
    CleaningServices as CleaningIcon,
    InfoOutlined as InfoIcon,
    Close as CloseIcon,
    AddCircleOutline as AddCircleOutlineIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import ForecastNavbar from './ForecastNavbar';

// WICHTIG: Importiere sanitize_filename aus der config.py (oder einer äquivalenten JS/TS-Version)
// Da du Python-Backend hast, musst du diese Logik entweder in src/config.ts replizieren
// oder sie vom Backend über eine API holen, um Konsistenz zu gewährleisten.
// Für dieses Beispiel gehen wir davon aus, dass du eine JS/TS-Version dieser Funktion hast.
// Wenn nicht, müsstest du diese Funktion hier implementieren.
// Hier als Platzhalter:
const sanitizeFilenameFrontend = (name: string): string => {
    let sanitized = name.trim();
    sanitized = sanitized.replace(/[/\\:*?"<>|]/g, '_'); // Ersetze ungültige Dateisystemzeichen
    sanitized = sanitized.replace(/\s+/g, '_'); // Ersetze Leerzeichen durch Unterstriche
    sanitized = sanitized.replace(/_+/g, '_'); // Mehrere Unterstriche zu einem machen
    sanitized = sanitized.replace(/^-+|-+$/g, ''); // Bindestriche am Anfang/Ende entfernen
    return sanitized;
};


interface ChartDataPoint {
    date: string;
    actual?: number | null;
    forecast?: number | null;
    isFuture?: boolean;
    is_anomaly?: boolean;
    yhat_lower?: number | null;
    yhat_upper?: number | null;
    trend?: number | null;
}
type ForecastDuration = '1d' | '7d' | '30d' | '90d';
type ForecastModel = 'prophet' | 'tensorflow';

const defaultWaterContainers = [ "HB/DST Kleinhadersdorf (M616.F1)", "DST Kleinhadersdorf (M960.F1)", "Ortsnetz Poysdorf (M617.F1)", "Zulauf HB Poysdorf (M100.F1)", "Ablauf HB Poysdorf (M130.F1)", "DST Poysdorf (M150.F1)", "Zulauf v. Poysdorf HB Poysbrunn (M320.F1)", "Zulauf v. Bru. HB Poysbrunn (M310.F1)", "Ablauf HB Poysbrunn (M230.F1)", "Brunnen 3 Poysbrunn (M950.F1)" ];

interface CsvValidationError {
    row: number; column?: string; message: string; value?: string; isWarning?: boolean;
}
interface AnomalySamplePoint { date: string; value: number; }

interface CleaningReport {
    values_imputed: number; db_rows_updated: number; nans_before: number;
    nans_after: number; message: string; detail?: string;
}

interface ModelTrainingReport {
    changepoint_prior_scale_used?: number;
    seasonality_prior_scale_used?: number;
    seasonality_mode_used?: string;
    holidays_prior_scale_used?: number | null;
    detected_changepoints_count?: number;
    active_seasonalities?: string[];
    active_regressors?: string[];
    daily_seasonality_setting?: boolean;
    holidays_configured_count?: number;
    training_loss?: number | string | null;
    validation_loss?: number | null;
    look_back_window?: number;
    lstm_units_layer1?: number;
    lstm_units_layer2?: number;
    dropout_rate?: number;
    epochs_trained?: number;
    early_stopping_patience?: number;
    batch_size?: number;
    features_used_count?: number;
}

interface ForecastApiResponse {
    forecast_data: ChartDataPoint[];
    message?: string;
    model_training_report?: ModelTrainingReport;
}

const cleanCsvCell = (cellValue: string | undefined): string => {
    if (typeof cellValue !== 'string') return '';
    let cleaned = cellValue;
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.substring(1, cleaned.length - 1);
    }
    cleaned = cleaned.replace(/""/g, '"');
    return cleaned.trim();
};


const Dashboard: React.FC = () => {
    const [availableContainers, setAvailableContainers] = useState<string[]>(defaultWaterContainers);

    const [selectedContainer, setSelectedContainer] = useState<string>(() => localStorage.getItem('dashboard_container') || defaultWaterContainers[0]);
    const [selectedForecastDuration, setSelectedForecastDuration] = useState<ForecastDuration>(() => (localStorage.getItem('dashboard_duration') as ForecastDuration) || '30d');
    const [selectedModel, setSelectedModel] = useState<ForecastModel>(() => (localStorage.getItem('dashboard_model') as ForecastModel) || 'prophet');
    const [uploadsDoneState, setUploadsDoneState] = useState<Record<string, boolean>>(() => {
        try { const stored = localStorage.getItem('dashboard_uploadsDone_by_container'); return stored ? JSON.parse(stored) : {};}
        catch (e) { console.error("Failed to parse uploadsDone_by_container from localStorage:", e); return {}; }
    });
    const [historicalData, setHistoricalData] = useState<ChartDataPoint[]>([]);
    const [futureForecastData, setFutureForecastData] = useState<ChartDataPoint[]>([]);
    const [isFetchingHistorical, setIsFetchingHistorical] = useState<boolean>(true);
    const [isGeneratingForecast, setIsGeneratingForecast] = useState<boolean>(false);
    const [chartKey, setChartKey] = useState<number>(0);
    const [isDataAvailable, setIsDataAvailable] = useState<boolean>(false);
    const { user } = useAuth();
    const theme = useTheme();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [isValidatingFile, setIsValidatingFile] = useState<boolean>(false);
    const [fileValidationIssues, setFileValidationIssues] = useState<CsvValidationError[]>([]);
    const [isFileValidated, setIsFileValidated] = useState<boolean>(false);
    const [isAnalyzingAnomalies, setIsAnalyzingAnomalies] = useState<boolean>(false);
    const [anomalyAnalysisResult, setAnomalyAnalysisResult] = useState<{ count: number; sample: AnomalySamplePoint[] } | null>(null);
    const [isUpdatingDataPoint, setIsUpdatingDataPoint] = useState<string | null>(null);
    const [isCleaningData, setIsCleaningData] = useState<boolean>(false);
    const [cleaningResult, setCleaningResult] = useState<CleaningReport | null>(null);
    const [modelTrainingReport, setModelTrainingReport] = useState<ModelTrainingReport | null>(null);
    const [prophetUseAnomalies, setProphetUseAnomalies] = useState<boolean>(false);

    const [openContainerDialog, setOpenContainerDialog] = useState(false);
    const [newContainerName, setNewContainerName] = useState('');
    const [isEditingContainer, setIsEditingContainer] = useState(false);
    const [originalContainerName, setOriginalContainerName] = useState('');

    const dateLocale = useMemo(() => (locales[i18n.language.split('-')[0] as keyof typeof locales] || locales['en']), [i18n.language]);
    const selectedContainerHasUploadedData = useMemo(() => uploadsDoneState[selectedContainer] === true, [uploadsDoneState, selectedContainer]);

    // Effekt zur Speicherung des Upload-Status im localStorage
    useEffect(() => { localStorage.setItem('dashboard_uploadsDone_by_container', JSON.stringify(uploadsDoneState)); }, [uploadsDoneState]);
    // Effekt zur Speicherung der Prognosedauer und des Modells im localStorage
    useEffect(() => { localStorage.setItem('dashboard_duration', selectedForecastDuration); }, [selectedForecastDuration]);
    useEffect(() => { localStorage.setItem('dashboard_model', selectedModel); }, [selectedModel]);

    // fetchHistoricalData - Wichtig: Diese Funktion muss vor fetchAvailableContainers definiert werden,
    // da fetchAvailableContainers indirekt die Aktualisierung von selectedContainer beeinflusst,
    // was dann diesen Hook triggern soll.
    const fetchHistoricalData = useCallback(async () => {
        console.log(`Fetching historical data for container: ${selectedContainer}`);
        setIsFetchingHistorical(true); setIsDataAvailable(false); setFutureForecastData([]); setHistoricalData([]);
        setModelTrainingReport(null);

        // Do not fetch if container is not recognized from the available list
        // and availableContainers has already been loaded (i.e., it's not empty and still doesn't include selectedContainer)
        if (!availableContainers.includes(selectedContainer) && availableContainers.length > 0) {
            console.warn(`Container '${selectedContainer}' not found in available list. Skipping historical data fetch.`);
            setIsFetchingHistorical(false);
            setHistoricalData([]);
            setIsDataAvailable(false);
            return;
        }

        // Skip fetch if no upload is marked for the selected container
        if (!selectedContainerHasUploadedData) {
            console.log(`No upload marked for ${selectedContainer}, skipping fetch.`);
            setIsFetchingHistorical(false);
            return;
        }

        try {
            const res = await forecastApi.get<ChartDataPoint[]>(`/historical_data/${selectedContainer}`);
            if (res.data && res.data.length > 0) {
                const sortedData = res.data.map(p => ({ ...p, date: p.date, actual: p.actual === null ? null : Number(p.actual), isFuture: false })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                setHistoricalData(sortedData); setIsDataAvailable(true);
            } else { setHistoricalData([]); setIsDataAvailable(false); toast(t('dashboard.toast.noHistoricalDataForContainer', { container: selectedContainer }), { icon: 'ℹ️' });}
        } catch (error) {
            console.error("Error loading historical data:", error);
            let errorMsg = t('dashboard.toast.errorLoadingHistorical');
            if (axiosStatic.isAxiosError(error)) { const axiosError = error as AxiosError<any>; errorMsg = axiosError.response?.data?.detail || axiosError.response?.data?.message || axiosError.message || errorMsg;}
            toast.error(errorMsg); setHistoricalData([]); setIsDataAvailable(false);
        } finally { setIsFetchingHistorical(false); }
    }, [selectedContainer, selectedContainerHasUploadedData, t, availableContainers]);

    // fetchAvailableContainers - Ruft nicht direkt fetchHistoricalData auf, sondern ändert `selectedContainer`,
    // was dann den `useEffect` für `fetchHistoricalData` triggert.
    const fetchAvailableContainers = useCallback(async () => {
        try {
            const res = await forecastApi.get<string[]>('/containers');
            let fetchedContainers = res.data || [];
            const combinedContainers = Array.from(new Set([...defaultWaterContainers, ...fetchedContainers]));
            setAvailableContainers(combinedContainers);

            // Aktualisiere selectedContainer, falls der aktuelle nicht mehr in der Liste ist
            // oder initial kein Container ausgewählt ist.
            if (!combinedContainers.includes(selectedContainer) || !selectedContainer) {
                const newSelected = combinedContainers.length > 0 ? combinedContainers[0] : '';
                setSelectedContainer(newSelected);
            }

            if (fetchedContainers.length === 0 && defaultWaterContainers.length > 0) {
                toast(t('dashboard.toast.noCustomContainersLoaded'), { icon: 'ℹ️' });
            }

        } catch (error) {
            console.error("Error loading available containers:", error);
            toast.error(t('dashboard.toast.errorLoadingContainers'));
            setAvailableContainers(defaultWaterContainers); // Fallback auf Standardbehälter bei Fehler
            setSelectedContainer(defaultWaterContainers[0]); // Sicherstellen, dass ein Behälter ausgewählt ist
        }
    }, [t, selectedContainer]);


    const generateForecast = useCallback(async () => {
        if (!selectedContainer || !isDataAvailable || isFetchingHistorical) {
            setFutureForecastData([]); setModelTrainingReport(null); return;
        }
        setIsGeneratingForecast(true); setFutureForecastData([]); setModelTrainingReport(null);
        const toastId = toast.loading(t('dashboard.toast.generating', { duration: selectedForecastDuration, model: selectedModel }));
        try {
            const payload: any = { containerId: selectedContainer, duration: selectedForecastDuration, model: selectedModel };
            if (selectedModel === 'prophet') { payload.prophet_train_with_anomalies = prophetUseAnomalies; }

            const response = await forecastApi.post<ForecastApiResponse>(`/generate_forecast/`, payload);

            if (response.data && response.data.forecast_data) {
                if (response.data.forecast_data.length > 0) {
                    const forecastData = response.data.forecast_data.map(p => ({ ...p, actual: null, isFuture: true, is_anomaly: false })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    setFutureForecastData(forecastData); setChartKey(prev => prev + 1);
                    toast.success(response.data.message || t('dashboard.toast.forecastGenerated', { model: selectedModel }), { id: toastId });
                } else {
                    toast.success(response.data.message || t('dashboard.toast.forecastGeneratedNoFuturePoints'), { id: toastId, icon: 'ℹ️' });
                    setFutureForecastData([]);
                }
                if (response.data.model_training_report) { setModelTrainingReport(response.data.model_training_report); }
                else { setModelTrainingReport(null); }
            } else {
                console.warn("Unexpected response structure from generate_forecast:", response.data);
                toast.error(t('dashboard.toast.unexpectedResponse'), { id: toastId });
                setFutureForecastData([]); setModelTrainingReport(null);
            }
        } catch (error) {
            console.error("Error generating forecast:", error);
            let errorMsg = t('dashboard.toast.errorGeneratingForecast');
            if (axiosStatic.isAxiosError(error)) { const axiosError = error as AxiosError<any>; errorMsg = axiosError.response?.data?.detail || axiosError.response?.data?.message || (error as Error).message || errorMsg;
            } else if (error instanceof Error) { errorMsg = error.message; }
            toast.error(errorMsg, { id: toastId });
            setFutureForecastData([]); setModelTrainingReport(null);
        } finally { setIsGeneratingForecast(false); }
    }, [selectedContainer, selectedForecastDuration, selectedModel, isDataAvailable, isFetchingHistorical, t, prophetUseAnomalies]);


    // Initialer Lade-Effekt: Benutzerauthentifizierung und Laden der Behälterliste
    useEffect(() => {
        if (user === undefined) return; // Warten, bis der Benutzerstatus bekannt ist
        if (user === null) { navigate('/login', { replace: true }); return; }
        fetchAvailableContainers(); // Behälterliste beim Start laden
    }, [user, navigate, fetchAvailableContainers]);

    // Effekt zum Laden historischer Daten, wenn sich selectedContainer oder availableContainers ändert
    useEffect(() => {
        // Sicherstellen, dass selectedContainer nicht leer ist und in der Liste der verfügbaren Behälter enthalten ist
        if (selectedContainer && availableContainers.includes(selectedContainer)) {
            fetchHistoricalData();
        } else if (availableContainers.length > 0 && !selectedContainer) {
            // Wenn Behälter geladen sind, aber kein selectedContainer gesetzt ist (z.B. nach Löschen des aktiven Behälters)
            setSelectedContainer(availableContainers[0]);
        }
    }, [selectedContainer, availableContainers, fetchHistoricalData]);


    // Effekt zum Generieren der Prognose, wenn sich Dauer, Modell oder Datenverfügbarkeit ändern
    useEffect(() => {
        if (isDataAvailable && !isFetchingHistorical && selectedContainerHasUploadedData) {
            const timer = setTimeout(() => { generateForecast(); }, 200);
            return () => clearTimeout(timer);
        } else if ((!isDataAvailable || !selectedContainerHasUploadedData) && !isFetchingHistorical) {
            setFutureForecastData([]); setModelTrainingReport(null);
        }
    }, [selectedForecastDuration, selectedModel, generateForecast, isDataAvailable, isFetchingHistorical, selectedContainerHasUploadedData, prophetUseAnomalies ]);

    const chartDisplayData = useMemo(() => {
        if (!selectedContainerHasUploadedData || !isDataAvailable) return [];
        const daysOfHistoryToShow = 90; const now = new Date();
        let relevantHistoricalData = historicalData;
        if (futureForecastData.length > 0 && futureForecastData[0]) {
            const firstForecastDate = parseISO(futureForecastData[0].date);
            relevantHistoricalData = historicalData.filter(p => parseISO(p.date) < firstForecastDate);
        }
        const lastRelevantDate = relevantHistoricalData.length > 0 ? parseISO(relevantHistoricalData[relevantHistoricalData.length - 1].date) : now;
        const historyStartDateLimit = new Date(lastRelevantDate);
        historyStartDateLimit.setDate(historyStartDateLimit.getDate() - daysOfHistoryToShow);
        const historicalWindow = historicalData.filter(p => parseISO(p.date) >= historyStartDateLimit);
        return [...historicalWindow, ...futureForecastData];
    }, [historicalData, futureForecastData, isDataAvailable, selectedContainerHasUploadedData]);

    const calculatedTicks = useMemo(() => {
        if (!isDataAvailable || !selectedContainerHasUploadedData || chartDisplayData.length === 0) return [];
        const ticks: string[] = [];
        try {
            const firstDate = parseISO(chartDisplayData[0]?.date);
            const lastDate = parseISO(chartDisplayData[chartDisplayData.length - 1]?.date);
            if (!firstDate || !lastDate) return [];

            const totalDurationDays = differenceInDays(lastDate, firstDate);
            let intervalFunc: (date: Date, amount: number) => Date;
            let tickStartFunc: (date: Date) => Date;

            if (totalDurationDays <= 2) { // 1-2 Tage: Ticks alle 2 Stunden
                intervalFunc = (d, amount) => addHours(d, amount);
                tickStartFunc = startOfDay;
            } else if (totalDurationDays <= 14) { // Bis 2 Wochen: Ticks jeden Tag (Tagesanfang)
                intervalFunc = (d, amount) => addDays(d, amount);
                tickStartFunc = startOfDay;
            } else if (totalDurationDays <= 90) { // Bis 3 Monate: Ticks jede Woche (Montag)
                intervalFunc = (d, amount) => addDays(d, amount * 7);
                tickStartFunc = (d) => startOfWeek(d, { locale: dateLocale });
            } else if (totalDurationDays <= 365 * 2) { // Bis 2 Jahre: Ticks jeden Monat (Monatsanfang)
                intervalFunc = (d, amount) => addMonths(d, amount);
                tickStartFunc = startOfMonth;
            } else { // Über 2 Jahre: Ticks jedes Jahr (Jahresanfang)
                intervalFunc = (d, amount) => addMonths(d, amount * 12);
                tickStartFunc = startOfYear;
            }

            let currentTickDate = tickStartFunc(firstDate);
            while (currentTickDate <= lastDate) {
                ticks.push(currentTickDate.toISOString());
                currentTickDate = intervalFunc(currentTickDate, 1);
            }
            // Sicherstellen, dass das letzte Datum immer enthalten ist, wenn es nicht genau auf einen Tick fällt
            if (ticks.length > 0 && new Date(ticks[ticks.length - 1]) < lastDate ) {
                ticks.push(lastDate.toISOString());
            }
        } catch (e) { console.error("Error calculating ticks:", e); }
        return [...new Set(ticks)];
    }, [chartDisplayData, isDataAvailable, selectedContainerHasUploadedData, dateLocale]);

    // tickFormatter für die X-Achse
    const xAxisTickFormatter = useCallback((tick: string) => {
        try {
            const date = parseISO(tick);
            // Immer ein detaillierteres Format, z.B. Tag.Monat.Jahr Stunde:Minute
            return format(date, 'dd.MM.yyyy HH:mm', { locale: dateLocale });
        } catch {
            return tick;
        }
    }, [dateLocale]);

    // Dynamische Rotation der X-Achsen-Beschriftung
    const xAxisAngle = useMemo(() => {
        // Bei immer vollem Datum brauchen wir fast immer eine Rotation
        return -45; // Fester Winkel für bessere Lesbarkeit des vollen Datums
    }, []);

    const xAxisHeight = useMemo(() => {
        // Mehr Höhe für stärkere Rotation und längere Beschriftungen
        return 70; // Erhöhte Höhe
    }, []);

    const handleUploadSuccess = useCallback(() => {
        setUploadsDoneState(prevState => ({ ...prevState, [selectedContainer]: true }));
        toast.success(t('dashboard.toast.uploadSuccess', { container: selectedContainer }));
        fetchHistoricalData(); setSelectedFile(null); setFileValidationIssues([]);
        setIsFileValidated(false); setAnomalyAnalysisResult(null); setCleaningResult(null);
        setModelTrainingReport(null);
    }, [selectedContainer, t, fetchHistoricalData]);

    const validateCsvFile = useCallback(async (file: File): Promise<{ errors: CsvValidationError[], warnings: CsvValidationError[] }> => {
        setIsValidatingFile(true); const MAX_CLIENT_PLAUSIBLE_VALUE = 10000.0;
        return new Promise((resolve) => {
            const errors: CsvValidationError[] = []; const warnings: CsvValidationError[] = [];
            const reader = new FileReader();
            reader.onload = (e) => {
                let text = e.target?.result as string;
                if (!text) { errors.push({ row: 1, message: t('dashboard.validation.emptyFile'), value: '', isWarning: false }); resolve({ errors, warnings }); setIsValidatingFile(false); return; }
                const lines = text.split(/\r\n|\n|\r/);
                if (lines.length === 0 || (lines.length === 1 && !lines[0].trim())) { errors.push({ row: 1, message: t('dashboard.validation.emptyFile'), value: '', isWarning: false }); resolve({ errors, warnings }); setIsValidatingFile(false); return; }
                let headerLineOriginal = lines[0]; let headerLineProcessed = lines[0];
                if (headerLineProcessed.charCodeAt(0) === 0xFEFF) { headerLineProcessed = headerLineProcessed.substring(1); }
                const headersFromFile = headerLineProcessed.split(';').map(h_raw => cleanCsvCell(h_raw).toLowerCase());
                const dateHeaderVariants = ['date', 'datum', 'zeitstempel', 'timestamp', 'ds'];
                const valueHeaderVariants = ['value', 'wert', 'verbrauch', 'y'];
                let matchedDateVariant: string | undefined; dateHeaderVariants.forEach(v => { if(headersFromFile.includes(v)) matchedDateVariant = v; });
                let matchedValueVariant: string | undefined; valueHeaderVariants.forEach(v => { if(headersFromFile.includes(v)) matchedValueVariant = v; });
                let actualDateHeaderInFile = ''; if (!matchedDateVariant) errors.push({ row: 1, column: 'Header', message: t('dashboard.validation.missingDateColumn'), value: headerLineOriginal, isWarning: false }); else actualDateHeaderInFile = headersFromFile.find(h => h === matchedDateVariant) || '';
                let actualValueHeaderInFile = ''; if (!matchedValueVariant) errors.push({ row: 1, column: 'Header', message: t('dashboard.validation.missingValueColumn'), value: headerLineOriginal, isWarning: false }); else actualValueHeaderInFile = headersFromFile.find(h => h === matchedValueVariant) || '';
                if (!matchedDateVariant || !matchedValueVariant) { resolve({ errors, warnings }); setIsValidatingFile(false); return; }
                const dateColIndex = headersFromFile.indexOf(actualDateHeaderInFile);
                const valueColIndex = headersFromFile.indexOf(actualValueHeaderInFile);
                if (dateColIndex === -1 || valueColIndex === -1) { errors.push({ row: 1, column: 'Header', message: t('dashboard.validation.columnIndexError'), value: headerLineOriginal, isWarning: false }); resolve({ errors, warnings }); setIsValidatingFile(false); return; }
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i]; if (!line.trim()) continue;
                    const columns = line.split(';'); const rowNumForDisplay = i + 1;
                    const dateStrRaw = columns[dateColIndex]; const valueStrRaw = columns[valueColIndex];
                    const dateStr = cleanCsvCell(dateStrRaw); const valueStr = cleanCsvCell(valueStrRaw);
                    if (!dateStr && columns.length > Math.max(dateColIndex, valueColIndex)) { errors.push({ row: rowNumForDisplay, column: actualDateHeaderInFile || 'Date', message: t('dashboard.validation.missingDateValue'), value: dateStrRaw || '', isWarning: false }); }
                    else if (dateStr && isNaN(new Date(dateStr).getTime())) { errors.push({ row: rowNumForDisplay, column: actualDateHeaderInFile || 'Date', message: t('dashboard.validation.invalidDateFormat'), value: dateStrRaw || '', isWarning: false }); }
                    if (dateStr || valueStr || columns.some(c => cleanCsvCell(c).length > 0)) {
                        if (!valueStr && valueStr !== "0") {
                            if (dateStr || columns.filter(c => cleanCsvCell(c).length > 0).length > 1) { warnings.push({ row: rowNumForDisplay, column: actualValueHeaderInFile || 'Value', message: t('dashboard.validation.missingNumericValueClientWarn'), value: valueStrRaw || '', isWarning: true }); }
                        } else if (valueStr) {
                            const valueAsFloat = parseFloat(valueStr.replace(',', '.'));
                            if (isNaN(valueAsFloat)) { errors.push({ row: rowNumForDisplay, column: actualValueHeaderInFile || 'Value', message: t('dashboard.validation.notANumber'), value: valueStrRaw || '', isWarning: false }); }
                            else {
                                if (valueAsFloat < 0) errors.push({row: rowNumForDisplay,column: actualValueHeaderInFile || 'Value',message: t('dashboard.validation.negativeValueNotAllowed', { value: valueAsFloat }),value: valueStrRaw || '', isWarning: false });
                                if (valueAsFloat > MAX_CLIENT_PLAUSIBLE_VALUE) errors.push({row: rowNumForDisplay,column: actualValueHeaderInFile || 'Value',message: t('dashboard.validation.valueTooHigh', { value: valueAsFloat, maxVal: MAX_CLIENT_PLAUSIBLE_VALUE }),value: valueStrRaw || '', isWarning: false });
                            }
                        }
                    }
                }
                resolve({ errors, warnings }); setIsValidatingFile(false);
            };
            reader.onerror = () => { errors.push({ row: 1, message: t('dashboard.validation.fileReadError'), value: '', isWarning: false }); resolve({ errors, warnings }); setIsValidatingFile(false); };
            reader.readAsText(file, "UTF-8");
        });
    }, [t]);

    const handleFileSelection = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]; if (event.target) event.target.value = '';
        if (!file) { setSelectedFile(null); setFileValidationIssues([]); setIsFileValidated(false); return; }
        if (!file.name.toLowerCase().endsWith('.csv')) { toast.error(t('dashboard.toast.onlyCsvAllowed')); setSelectedFile(null); setFileValidationIssues([{ row: 0, message: t('dashboard.toast.onlyCsvAllowed'), value: file.name, isWarning: false }]); setIsFileValidated(false); return; }
        setSelectedFile(file); setFileValidationIssues([]); setIsFileValidated(false); setAnomalyAnalysisResult(null); setCleaningResult(null); setModelTrainingReport(null);
        const toastId = toast.loading(t('dashboard.validation.validatingFile'));
        const { errors: validationBlockers, warnings: validationWarnings } = await validateCsvFile(file);
        toast.dismiss(toastId);
        const allIssues = [...validationBlockers, ...validationWarnings]; setFileValidationIssues(allIssues);
        if (validationBlockers.length > 0) { toast.error(t('dashboard.validation.errorsFoundInFile')); setIsFileValidated(false); }
        else { if (validationWarnings.length > 0) { toast.success(t('dashboard.validation.fileHasWarningsProceedUpload'), {icon: '⚠️', duration: 4000}); } else { toast.success(t('dashboard.validation.fileReadyForUpload')); } setIsFileValidated(true); }
    }, [t, validateCsvFile]);

    const performActualUpload = useCallback(async () => {
        const hardErrors = fileValidationIssues.filter(issue => !issue.isWarning);
        if (!selectedFile || !isFileValidated || hardErrors.length > 0) {
            if (hardErrors.length > 0) { toast.error(t('dashboard.validation.cannotUploadInvalidFileFixErrors'));}
            else if (!selectedFile) { toast.error(t('dashboard.validation.noFileSelectedForUpload'));}
            else { toast.error(t('dashboard.validation.fileNotValidatedOrInvalid'));} return;
        }
        const formData = new FormData(); formData.append("file", selectedFile); formData.append("container_id", selectedContainer);
        setIsUploading(true); const toastId = toast.loading(t('dashboard.toast.uploadingData', { container: selectedContainer }));
        setAnomalyAnalysisResult(null); setCleaningResult(null); setModelTrainingReport(null);
        try {
            await forecastApi.post(`/upload_data/`, formData, { headers: { "Content-Type": "multipart/form-data" } });
            handleUploadSuccess();
        } catch (err) {
            console.error("Fehler beim Daten-Upload (Backend):", err); let errorMsg = t('dashboard.toast.uploadFailedFull');
            if (axiosStatic.isAxiosError(err)) {
                const axiosError = err as AxiosError<any>;
                if (axiosError.response?.data?.errors && Array.isArray(axiosError.response.data.errors)) {
                    const backendErrors: any[] = axiosError.response.data.errors;
                    const formattedBackendErrors: CsvValidationError[] = backendErrors.map((be, index) => ({ row: be.row_csv || (index + 1), column: be.column_name || "Backend-Prüfung", message: be.error_message || "Unbekannter serverseitiger Fehler in Zeile.", value: be.original_value || be.value_snippet || "N/A", isWarning: false }));
                    setFileValidationIssues(prev => [...prev.filter(p => p.isWarning), ...formattedBackendErrors]);
                    errorMsg = axiosError.response?.data?.message || axiosError.response?.data?.detail || t('dashboard.validation.errorsFoundInFile');
                    setIsFileValidated(false);
                } else { errorMsg = axiosError.response?.data?.detail || axiosError.response?.data?.message || axiosError.message || errorMsg;}
            }
            toast.error(errorMsg, { id: toastId });
        } finally { setIsUploading(false); }
    }, [selectedFile, isFileValidated, fileValidationIssues, selectedContainer, t, handleUploadSuccess]);

    const handleAnalyzeAndMarkAnomalies = useCallback(async () => {
        if (!selectedContainer) { toast.error(t('dashboard.toast.noContainerSelected')); return; }
        setIsAnalyzingAnomalies(true); setAnomalyAnalysisResult(null);
        const toastId = toast.loading(t('dashboard.adminActions.analyzingAnomalies', { container: selectedContainer }));
        try {
            const response = await forecastApi.post<{anomalies_marked_count: number; anomaly_sample: AnomalySamplePoint[]}>(`/actuals/${selectedContainer}/analyze_and_mark_anomalies`);
            const { anomalies_marked_count: markedCount = 0, anomaly_sample: sample = [] } = response.data || {};
            setAnomalyAnalysisResult({ count: markedCount, sample });
            if (markedCount > 0) { toast.success(t('dashboard.adminActions.analyzeSuccess', { count: markedCount, container: selectedContainer }), { id: toastId }); }
            else { toast.success(t('dashboard.adminActions.noAnomaliesFound', { container: selectedContainer }), { id: toastId }); }
            fetchHistoricalData();
        } catch (error) {
            console.error("Error analyzing and marking anomalies:", error); let errorMsg = t('dashboard.adminActions.analyzeError', { container: selectedContainer });
            if (axiosStatic.isAxiosError(error)) {
                const axiosError = error as AxiosError<any>; errorMsg = axiosError.response?.data?.detail || axiosError.response?.data?.message || axiosError.message || errorMsg;
                if (axiosError.response?.status === 404) { errorMsg = t('dashboard.toast.endpointNotFound', {path: `/actuals/${selectedContainer}/analyze_and_mark_anomalies`}); }
            }
            toast.error(errorMsg, { id: toastId }); setAnomalyAnalysisResult({ count: -1, sample: [] });
        } finally { setIsAnalyzingAnomalies(false); }
    }, [selectedContainer, t, fetchHistoricalData]);

    const handleToggleDataPointAnomaly = useCallback(async (dateISO: string, currentIsAnomaly: boolean) => {
        if (!selectedContainer) return;
        const newAnomalyStatus = !currentIsAnomaly;
        setIsUpdatingDataPoint(dateISO);
        const toastMessageKey = newAnomalyStatus ? 'dashboard.toast.markingAsAnomaly' : 'dashboard.toast.markingAsNotAnomaly';
        const toastId = toast.loading(t(toastMessageKey));
        try {
            await forecastApi.post(`/actuals/${selectedContainer}/update_anomaly_datapoint`, { date: dateISO, is_anomaly: newAnomalyStatus });
            toast.success(t('dashboard.toast.dataPointStatusUpdated'), { id: toastId });
            fetchHistoricalData();
            if (anomalyAnalysisResult) {
                if (newAnomalyStatus) {
                    setAnomalyAnalysisResult(prev => ({...prev!, count: prev!.count +1 }));
                } else {
                    const updatedSample = anomalyAnalysisResult.sample.filter(s => s.date !== dateISO);
                    const updatedCount = Math.max(0, anomalyAnalysisResult.count - 1);
                    setAnomalyAnalysisResult({ count: updatedCount, sample: updatedSample });
                }
            }
        } catch (error) {
            console.error("Error updating data point anomaly status:", error);
            let errorMsg = t('dashboard.toast.errorUpdatingDataPoint');
            if (axiosStatic.isAxiosError(error)) { const axiosError = error as AxiosError<any>; errorMsg = axiosError.response?.data?.detail || axiosError.response?.data?.message || axiosError.message || errorMsg; }
            toast.error(errorMsg, { id: toastId });
        } finally { setIsUpdatingDataPoint(null); }
    }, [selectedContainer, t, fetchHistoricalData, anomalyAnalysisResult]);

    const handleCleanData = useCallback(async () => {
        if (!selectedContainer) { toast.error(t('dashboard.toast.noContainerSelected')); return; }
        if (!selectedContainerHasUploadedData) { toast.error(t('dashboard.adminActions.uploadDataFirstForCleaning', { container: selectedContainer })); return; }
        setIsCleaningData(true); setCleaningResult(null);
        const toastId = toast.loading(t('dashboard.adminActions.cleaningData', { container: selectedContainer }));
        try {
            const response = await forecastApi.post<CleaningReport>(`/actuals/${selectedContainer}/clean_data`);
            setCleaningResult(response.data);
            let toastMessage = response.data.message || (response.data.values_imputed > 0 ? t('dashboard.adminActions.cleaningSuccessCount', { count: response.data.values_imputed }) : t('dashboard.adminActions.noDataToClean'));
            let toastIcon: string | undefined = (response.data.values_imputed > 0 && response.data.nans_after === 0) ? undefined : 'ℹ️';
            let toastDuration = 4000;

            if (response.data.detail) {
                toastMessage = `${response.data.message} ${response.data.detail}`;
                toastDuration = 6000;
                if (response.data.nans_after > 0 && response.data.nans_before > 0) {
                    toastIcon = '⚠️';
                }
            }
            toast.success(toastMessage, { id: toastId, icon: toastIcon, duration: toastDuration });
            fetchHistoricalData();
        } catch (error) {
            console.error("Error cleaning data:", error);
            let errorMsg = t('dashboard.adminActions.cleaningError');
            if (axiosStatic.isAxiosError(error)) { const axiosError = error as AxiosError<any>; errorMsg = axiosError.response?.data?.detail || axiosError.response?.data?.message || axiosError.message || errorMsg; }
            toast.error(errorMsg, { id: toastId });
            setCleaningResult({ message: errorMsg, values_imputed: -1, db_rows_updated: -1, nans_before: -1, nans_after: -1, detail: errorMsg });
        } finally { setIsCleaningData(false); }
    }, [selectedContainer, selectedContainerHasUploadedData, t, fetchHistoricalData]);

    // Container Management Handlers
    const handleAddEditContainer = useCallback(async () => {
        if (!newContainerName.trim()) {
            toast.error(t('dashboard.containerManagement.nameEmpty'));
            return;
        }

        const toastId = toast.loading(isEditingContainer ? t('dashboard.containerManagement.updatingContainer') : t('dashboard.containerManagement.addingContainer'));
        try {
            // WICHTIG: Verwende sanitizeFilenameFrontend HIER, BEVOR der Name an das Backend gesendet wird.
            const sanitizedName = sanitizeFilenameFrontend(newContainerName);
            if (!sanitizedName) { // Wenn der Name nach Bereinigung leer ist
                toast.error(t('dashboard.containerManagement.nameEmptyAfterSanitize')); // Neue Übersetzungszeichenkette hinzufügen
                toast.dismiss(toastId);
                return;
            }

            if (isEditingContainer) {
                await forecastApi.put(`/containers/${originalContainerName}`, { new_name: sanitizedName });
                toast.success(t('dashboard.containerManagement.containerUpdated'), { id: toastId });
            } else {
                await forecastApi.post('/containers', { name: sanitizedName });
                toast.success(t('dashboard.containerManagement.containerAdded'), { id: toastId });
            }
            setOpenContainerDialog(false);
            setNewContainerName('');
            setIsEditingContainer(false);
            setOriginalContainerName('');
            fetchAvailableContainers(); // Refresh the list of containers
            if (isEditingContainer && originalContainerName === selectedContainer) {
                setSelectedContainer(sanitizedName); // Update selected if name changed
            } else if (!isEditingContainer && availableContainers.length === 0) {
                // If it's the first container added, select it
                setSelectedContainer(sanitizedName);
            }
        } catch (error) {
            console.error("Error adding/editing container:", error);
            let errorMsg = t('dashboard.containerManagement.addEditError');
            if (axiosStatic.isAxiosError(error)) {
                const axiosError = error as AxiosError<any>;
                // Spezifischere Fehlermeldung, falls der Server sagt, dass der Name bereits existiert
                if (axiosError.response?.status === 409) { // 409 Conflict ist ein gängiger Status für Duplikate
                    errorMsg = t('dashboard.containerManagement.containerAlreadyExists'); // Neue Übersetzungszeichenkette
                } else {
                    errorMsg = axiosError.response?.data?.detail || axiosError.response?.data?.message || axiosError.message || errorMsg;
                }
            }
            toast.error(errorMsg, { id: toastId });
        }
    }, [newContainerName, isEditingContainer, originalContainerName, t, fetchAvailableContainers, selectedContainer, availableContainers]);

    const handleDeleteContainer = useCallback(async (containerToDelete: string) => {
        if (!window.confirm(t('dashboard.containerManagement.confirmDelete', { container: containerToDelete }))) {
            return;
        }
        const toastId = toast.loading(t('dashboard.containerManagement.deletingContainer', { container: containerToDelete }));
        try {
            await forecastApi.delete(`/containers/${containerToDelete}`);
            toast.success(t('dashboard.containerManagement.containerDeleted', { container: containerToDelete }), { id: toastId });
            fetchAvailableContainers(); // Refresh the list of containers
            // If the deleted container was currently selected, switch to the first available one
            if (selectedContainer === containerToDelete) {
                setSelectedContainer(prev => {
                    const updatedContainers = availableContainers.filter(c => c !== containerToDelete);
                    // Fallback to a default if no custom containers are left
                    return updatedContainers.length > 0 ? updatedContainers[0] : defaultWaterContainers[0];
                });
            }
            setUploadsDoneState(prevState => { // Clear upload status for the deleted container
                const newState = { ...prevState };
                delete newState[containerToDelete];
                return newState;
            });
        } catch (error) {
            console.error("Error deleting container:", error);
            let errorMsg = t('dashboard.containerManagement.deleteError');
            if (axiosStatic.isAxiosError(error)) {
                const axiosError = error as AxiosError<any>;
                errorMsg = axiosError.response?.data?.detail || axiosError.response?.data?.message || axiosError.message || errorMsg;
            }
            toast.error(errorMsg, { id: toastId });
        }
    }, [t, fetchAvailableContainers, selectedContainer, availableContainers]);

    const animationVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };
    const CustomAnomalyDotComponent: React.FC<any> = (props: any) => {  const { cx, cy, stroke, payload } = props; if (payload.is_anomaly) { return <Dot cx={cx} cy={cy} r={4} fill={theme.palette.error.main} stroke={theme.palette.error.dark} strokeWidth={1}/>; } return <Dot cx={cx} cy={cy} r={1.5} fill={stroke || theme.palette.secondary.main} />; };
    const CustomTooltip: React.FC<TooltipProps<ValueType, NameType>> = ({ active, payload, label }) => { if (active && payload && payload.length && label) { try { const formattedDate = format(parseISO(label as string), 'dd.MM.yyyy HH:mm', { locale: dateLocale }); return ( <Paper elevation={3} sx={{ padding: '10px', borderRadius: '8px', backgroundColor: alpha(theme.palette.background.paper, 0.95) }}> <Typography variant="caption" display="block" gutterBottom sx={{ fontWeight: 'bold' }}>{formattedDate}</Typography> {payload.map((entry, index) => { const dataPoint = entry.payload as ChartDataPoint; const translatedName = entry.name === 'actual' ? t('dashboard.chart.lineNameActual') : entry.name === 'forecast' ? t('dashboard.chart.lineNameForecast') : entry.name; const valueDisplay = entry.value != null ? (typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value) : 'N/A'; return ( <Typography key={`item-${index}`} variant="body2" sx={{ color: entry.color || theme.palette.text.primary, display: 'flex', alignItems: 'center' }}> {dataPoint.is_anomaly && entry.name === 'actual' && <ReportProblemOutlinedIcon color="error" sx={{ fontSize: '1rem', mr: 0.5 }}/>} <Box component="span" sx={{ width: 10, height: 10, backgroundColor: entry.color, marginRight: 1, borderRadius: '50%' }} /> {`${translatedName}: `} <Typography component="span" sx={{ fontWeight: 'bold', ml: 0.5 }}> {valueDisplay} </Typography> </Typography> ); })} </Paper> ); } catch (e) { return <Paper sx={{ padding: '5px' }}><Typography variant="caption">{t('dashboard.tooltip.invalidDate')}</Typography></Paper>; } } return null; };

    const handleClearAnomalyResult = () => { setAnomalyAnalysisResult(null); };
    const handleClearCleaningResult = () => { setCleaningResult(null); };
    const handleClearModelTrainingReport = () => { setModelTrainingReport(null); };

    if (user === undefined) { return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default' }}><CircularProgress size={40} /></Box>; }

    const blockingValidationErrors = fileValidationIssues.filter(issue => !issue.isWarning);
    const warningValidationIssues = fileValidationIssues.filter(issue => issue.isWarning);

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            <ForecastNavbar />
            <AppBar position="fixed" sx={{ width: '100%', zIndex: theme.zIndex.drawer + 1, bgcolor: alpha(theme.palette.background.paper, 0.8), backdropFilter: 'blur(8px)', color: theme.palette.text.primary, boxShadow: theme.shadows[1], borderBottom: `1px solid ${theme.palette.divider}` }} >
                <Toolbar>
                    <AnalyseIcon sx={{ mr: 1.5, color: 'primary.main' }} />
                    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}> {t('dashboard.appBarTitle')} </Typography>
                    <Typography sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>{user?.username} ({user?.role})</Typography>
                    <Avatar src={user?.profileImageUrl || undefined} sx={{ bgcolor: theme.palette.primary.main }}>{user?.username?.charAt(0).toUpperCase()}</Avatar>
                </Toolbar>
            </AppBar>

            <Box component="main" sx={{ flexGrow: 1, bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.background.default, minHeight: '100vh' }}>
                <Toolbar />
                <Box sx={{ p: { xs: 2, md: 3 } }}>
                    <motion.div initial="hidden" animate="visible" variants={animationVariants}>
                        <Paper elevation={0} variant='outlined' sx={{ p: 2, mb: 3, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.5), bgcolor: alpha(theme.palette.background.paper, 0.6) }}>
                            {isFetchingHistorical && historicalData.length === 0 ? (
                                <Stack
                                    direction={{ xs: 'column', sm: 'row' }}
                                    spacing={2}
                                    alignItems="stretch"
                                    flexWrap="wrap"
                                    sx={{ width: '100%' }}
                                >
                                    <Skeleton variant="rounded" height={56} sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 220 } }} />
                                    <Skeleton variant="rounded" height={56} sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 160 } }} />
                                    <Skeleton variant="rounded" height={56} sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 160 } }} />
                                </Stack>
                            ) : (
                                <Stack
                                    direction={{xs: "column", sm: "row"}}
                                    spacing={2}
                                    alignItems="flex-start"
                                    flexWrap="wrap"
                                    sx={{ width: '100%' }}
                                >
                                    <TextField
                                        select
                                        fullWidth
                                        label={t('dashboard.filters.containerLabel')}
                                        value={selectedContainer}
                                        onChange={(e) => {setSelectedContainer(e.target.value);}}
                                        size="small"
                                        InputProps={{
                                            startAdornment: <InputAdornment position="start"><WaterIcon color="action" /></InputAdornment>
                                        }}
                                        sx={{
                                            width: { xs: '100%', sm: 'auto' },
                                            flexGrow: {sm: 1},
                                            minWidth: { sm: 220 }
                                        }}
                                    >
                                        {availableContainers.map(container => (
                                            <MenuItem key={container} value={container}>{container}</MenuItem>
                                        ))}
                                    </TextField>
                                    <TextField
                                        select
                                        fullWidth
                                        label={t('dashboard.filters.durationLabel')}
                                        value={selectedForecastDuration}
                                        onChange={(e) => setSelectedForecastDuration(e.target.value as ForecastDuration)}
                                        size="small"
                                        InputProps={{
                                            startAdornment: <InputAdornment position="start"><CalendarIcon color="action" /></InputAdornment>
                                        }}
                                        sx={{
                                            width: { xs: '100%', sm: 'auto' },
                                            flexGrow: {sm: 1},
                                            minWidth: { sm: 160 }
                                        }}
                                    >
                                        <MenuItem value="1d">{t('dashboard.filters.durationOption1d')}</MenuItem>
                                        <MenuItem value="7d">{t('dashboard.filters.durationOption7d')}</MenuItem>
                                        <MenuItem value="30d">{t('dashboard.filters.durationOption30d')}</MenuItem>
                                        <MenuItem value="90d">{t('dashboard.filters.durationOption90d')}</MenuItem>
                                    </TextField>
                                    <TextField
                                        select
                                        fullWidth
                                        label={t('dashboard.filters.modelLabel')}
                                        value={selectedModel}
                                        onChange={(e) => setSelectedModel(e.target.value as ForecastModel)}
                                        size="small"
                                        InputProps={{
                                            startAdornment: <InputAdornment position="start"><ModelIcon color="action" /></InputAdornment>
                                        }}
                                        sx={{
                                            width: { xs: '100%', sm: 'auto' },
                                            flexGrow: {sm: 1},
                                            minWidth: { sm: 160 }
                                        }}
                                    >
                                        <MenuItem value="prophet" sx={{display:'flex', alignItems:'center', gap: 1}}>
                                            <ProphetIcon fontSize="small" color="info"/> {t('dashboard.filters.modelOptionProphet')}
                                        </MenuItem>
                                        <MenuItem value="tensorflow" sx={{display:'flex', alignItems:'center', gap: 1}}>
                                            <TensorFlowIcon fontSize="small" color="warning"/> {t('dashboard.filters.modelOptionTensorflow')}
                                        </MenuItem>
                                    </TextField>
                                    {selectedModel === 'prophet' && user?.role === "Admin" && (
                                        <Box
                                            sx={{
                                                width: { xs: '100%', sm: 'auto' },
                                                flexGrow: {sm: 1},
                                                minWidth: { sm: 180 }
                                            }}
                                        >
                                            <FormControl fullWidth size="small">
                                                <InputLabel id="prophet-anomaly-label">{t('dashboard.filters.prophetAnomalyLabel')}</InputLabel>
                                                <Select
                                                    labelId="prophet-anomaly-label"
                                                    value={prophetUseAnomalies ? 'yes' : 'no'}
                                                    label={t('dashboard.filters.prophetAnomalyLabel')}
                                                    onChange={(e) => setProphetUseAnomalies(e.target.value === 'yes')}
                                                >
                                                    <MenuItem value="no">{t('dashboard.filters.prophetAnomalyNo')}</MenuItem>
                                                    <MenuItem value="yes">{t('dashboard.filters.prophetAnomalyYes')}</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Box>
                                    )}
                                </Stack>
                            )}
                        </Paper>
                    </motion.div>

                    <motion.div initial="hidden" animate="visible" variants={animationVariants} transition={{ delay: 0.1 }}>
                        <Paper sx={{ p: {xs: 1, sm: 2}, borderRadius: 3, elevation: 0, variant: 'outlined', borderColor: alpha(theme.palette.divider, 0.5), overflow: 'hidden', mt:3 }}>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'medium' }}>{t('dashboard.chart.title')}</Typography>
                            <Box sx={{ height: 450, width: '100%', position: 'relative' }}>
                                {(isGeneratingForecast || isFetchingHistorical) && ( <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: alpha(theme.palette.background.paper, 0.7), zIndex: 10, borderRadius: 'inherit' }}><CircularProgress size={30} /><Typography sx={{ ml: 2 }} variant="body2">{t('dashboard.chart.generatingOverlay')}</Typography></Box>)}
                                {!isFetchingHistorical && !selectedContainerHasUploadedData ? ( <Stack justifyContent="center" alignItems="center" sx={{ height: '100%', p: 3, textAlign: 'center' }}><UploadFileIcon sx={{ fontSize: 50, color: 'text.secondary', mb: 2 }} /><Typography color="text.secondary" variant="h6" gutterBottom>{t('dashboard.chart.uploadRequiredTitle')}</Typography><Typography color="text.secondary">{t('dashboard.chart.uploadRequiredTextForContainer', { container: selectedContainer })}</Typography></Stack>
                                ) : !isFetchingHistorical && !isDataAvailable && selectedContainerHasUploadedData ? ( <Stack justifyContent="center" alignItems="center" sx={{ height: '100%', p: 3, textAlign: 'center' }}><ErrorIcon sx={{ fontSize: 50, color: 'warning.main', mb: 2 }} /><Typography color="text.secondary" variant="h6" gutterBottom>{t('dashboard.chart.noDataTitle')}</Typography><Typography color="text.secondary">{t('dashboard.chart.noDataTextForContainer', { container: selectedContainer })}</Typography></Stack>
                                ) : (isDataAvailable || historicalData.length > 0) ? (
                                    <AnimatePresence mode="wait">
                                        <motion.div key={chartKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} style={{ width: '100%', height: '100%' }} >
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={chartDisplayData} margin={{ top: 5, right: 35, left: 20, bottom: 40 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider}/>
                                                    {/* HIER IST DIE VERBESSERTE X-ACHSE */}
                                                    <XAxis
                                                        dataKey="date"
                                                        fontSize={10}
                                                        tick={{ fill: theme.palette.text.secondary }}
                                                        tickFormatter={xAxisTickFormatter}
                                                        angle={xAxisAngle}
                                                        textAnchor={xAxisAngle === 0 ? "middle" : "end"}
                                                        height={xAxisHeight}
                                                        ticks={calculatedTicks}
                                                        interval="equidistantPreserveStart"
                                                    />
                                                    <YAxis fontSize={10} tick={{ fill: theme.palette.text.secondary }} domain={['auto', 'auto']} label={{ value: 'm³', angle: -90, position: 'insideLeft', fill: theme.palette.text.primary, style: { textAnchor: 'middle' } }} />
                                                    <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 1200 }}/>
                                                    <Legend verticalAlign="top" height={36}/>
                                                    <Line type="monotone" dataKey="actual" name={t('dashboard.chart.lineNameActual')} stroke={theme.palette.secondary.main} strokeWidth={1.5} dot={<CustomAnomalyDotComponent />} activeDot={{ r: 6, stroke: theme.palette.secondary.dark, strokeWidth: 2 }} connectNulls={true}/>
                                                    {chartDisplayData.some(p => p.yhat_lower != null && p.yhat_upper != null) && (
                                                        <>
                                                            <Line type="monotone" dataKey="yhat_upper" stroke={alpha(theme.palette.primary.main, 0.2)} strokeWidth={0} dot={false} legendType="none" connectNulls={false} name="_forecast_upper_bound" fillOpacity={1} fill="url(#confidenceArea)" />
                                                            <Line type="monotone" dataKey="yhat_lower" stroke={alpha(theme.palette.primary.main, 0.2)} strokeWidth={0} dot={false} legendType="none" connectNulls={false} name="_forecast_lower_bound" fillOpacity={1} fill="url(#confidenceArea)" />
                                                            <defs>
                                                                <linearGradient id="confidenceArea" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="0%" stopColor={alpha(theme.palette.primary.main, 0.2)} stopOpacity={0.4}/>
                                                                    <stop offset="100%" stopColor={alpha(theme.palette.primary.main, 0.2)} stopOpacity={0.1}/>
                                                                </linearGradient>
                                                            </defs>
                                                        </>
                                                    )}
                                                    <Line type="monotone" dataKey="forecast" name={t('dashboard.chart.lineNameForecast')} stroke={theme.palette.primary.main} strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 5 }} connectNulls={false} />

                                                    {historicalData.length > 0 && futureForecastData.length > 0 && historicalData[historicalData.length -1]?.date && ( <ReferenceLine x={historicalData[historicalData.length -1].date } stroke={theme.palette.warning.light} strokeDasharray="4 4"><Label value={t('dashboard.chart.refLineLabel')} position="insideTopLeft" fill={theme.palette.warning.dark} fontSize={10} dy={-10} /></ReferenceLine>)}
                                                    {futureForecastData.length > 0 && chartDisplayData.find(d => d.date === futureForecastData[0]?.date) && ( <ReferenceArea x1={futureForecastData[0].date} stroke="none" fill={alpha(theme.palette.primary.light, 0.05)} ifOverflow="visible" label={{ value: t('dashboard.chart.refAreaLabel'), position: "insideTopRight", fill: theme.palette.primary.dark, fontSize: 10, fontWeight: 'bold' }} />)}
                                                    {chartDisplayData.length > 10 && ( <Brush dataKey="date" height={30} stroke={theme.palette.primary.main} travellerWidth={15} tickFormatter={(tick) => { try { return format(parseISO(tick), 'dd.MM', { locale: dateLocale }); } catch { return tick; }}} gap={5} y={450 - 35 - 5} />)}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </motion.div>
                                    </AnimatePresence>
                                ) : null }
                            </Box>
                        </Paper>
                    </motion.div>

                    {user?.role === "Admin" && (
                        <motion.div initial="hidden" animate="visible" variants={animationVariants} transition={{ delay: 0.2 }}>
                            <Paper id="upload-card" variant="outlined" elevation={0} sx={{ borderRadius: 3, mt: 3, borderColor: alpha(theme.palette.divider, 0.5) }} >
                                <CardHeader title={t('dashboard.uploadCard.titleSingle')} sx={{ borderBottom: `1px solid ${theme.palette.divider}` }} titleTypographyProps={{ variant: 'h6', fontWeight: 'medium'}} />
                                <CardContent>
                                    <Stack spacing={2}>
                                        <Button component="label" variant="outlined" size="medium" startIcon={<UploadFileIcon />} disabled={isUploading || isValidatingFile} >
                                            <Box component="span" sx={{ display: 'contents' }}> {selectedFile ? selectedFile.name : t('dashboard.uploadCard.buttonSelectFile')} <input type="file" hidden accept=".csv" onChange={handleFileSelection} /> </Box>
                                        </Button>
                                        {isValidatingFile && (<Stack direction="row" alignItems="center" spacing={1} sx={{mt:1, color: 'text.secondary'}}><CircularProgress size={16} color="inherit"/><Typography variant="caption">{t('dashboard.validation.validatingFile')}</Typography></Stack>)}
                                        {fileValidationIssues.length > 0 && ( <Box> {blockingValidationErrors.length > 0 && ( <Alert severity="error" sx={{ mt: 2, mb:1 }}> <AlertTitle>{t('dashboard.validation.errorsFoundInFile')}</AlertTitle> <React.Fragment> <List dense sx={{ maxHeight: 100, overflow: 'auto', pl:0, pr:0 }}> {blockingValidationErrors.map((err, index) => ( <ListItem key={`err-${index}`} disableGutters sx={{pt:0, pb:0}}> <ListItemText primaryTypographyProps={{fontSize: '0.875rem'}} secondaryTypographyProps={{fontSize: '0.75rem'}} primary={t('dashboard.validation.errorDetail', {row: err.row, message: err.message})} secondary={err.column ? t('dashboard.validation.errorColumnValue', {column: err.column, value: String(err.value).substring(0,50) || 'N/A'}) : `Wert: ${String(err.value).substring(0,50) || 'N/A'}`} /> </ListItem> ))} </List> <Typography variant="caption" display="block" sx={{mt:1}}> {t('dashboard.validation.pleaseCorrectAndReupload')} </Typography> </React.Fragment> </Alert> )} {warningValidationIssues.length > 0 && ( <Alert severity="warning" sx={{ mt: blockingValidationErrors.length > 0 ? 1 : 2, mb:1 }}> <AlertTitle>{t('dashboard.validation.warningsFoundInFileTitle')}</AlertTitle> <React.Fragment> <List dense sx={{ maxHeight: 100, overflow: 'auto', pl:0, pr:0 }}> {warningValidationIssues.map((warn, index) => ( <ListItem key={`warn-${index}`} disableGutters sx={{pt:0, pb:0}}> <ListItemText primaryTypographyProps={{fontSize: '0.875rem'}} secondaryTypographyProps={{fontSize: '0.75rem'}} primary={t('dashboard.validation.errorDetail', {row: warn.row, message: warn.message})} secondary={warn.column ? t('dashboard.validation.errorColumnValue', {column: warn.column, value: String(warn.value).substring(0,50) || 'N/A'}) : `Wert: ${String(warn.value).substring(0,50) || 'N/A'}`} /> </ListItem> ))} </List> </React.Fragment> </Alert> )} </Box> )}
                                        {isFileValidated && selectedFile && ( <> {blockingValidationErrors.length === 0 && warningValidationIssues.length === 0 && ( <Alert severity="success" sx={{ mt: 2, mb: 1 }} icon={<CheckCircleIcon fontSize="inherit" />}> <AlertTitle>{t('dashboard.validation.fileReadyForUploadTitle')}</AlertTitle> <React.Fragment>{t('dashboard.validation.fileReadyForUploadText', { filename: selectedFile.name })}</React.Fragment> </Alert> )} <Button variant="contained" color="primary" onClick={performActualUpload} disabled={isUploading} startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : <UploadFileIcon />} > {isUploading ? t('dashboard.uploadCard.buttonUploading') : t('dashboard.uploadCard.buttonUploadValidatedFile')} </Button> </> )}
                                    </Stack>
                                </CardContent>
                            </Paper>
                        </motion.div>
                    )}

                    {user?.role === "Admin" && (
                        <motion.div initial="hidden" animate="visible" variants={animationVariants} transition={{ delay: 0.3 }}>
                            <Paper id="admin-actions-card" variant="outlined" elevation={0} sx={{ borderRadius: 3, mt: 3, borderColor: alpha(theme.palette.divider, 0.5) }} >
                                <CardHeader title={t('dashboard.adminActions.title')} sx={{ borderBottom: `1px solid ${theme.palette.divider}` }} titleTypographyProps={{ variant: 'h6', fontWeight: 'medium'}} />
                                <CardContent>
                                    <Stack spacing={3} direction="column" alignItems="flex-start">
                                        <Box sx={{width: '100%'}}>
                                            <Typography variant="subtitle1" gutterBottom sx={{fontWeight: 'medium'}}> {t('dashboard.adminActions.anomalyAnalysisTitle')} </Typography>
                                            <Stack spacing={2} direction="row" alignItems="center"> <Button variant="outlined" color="secondary" onClick={handleAnalyzeAndMarkAnomalies} disabled={isAnalyzingAnomalies || !selectedContainerHasUploadedData || isFetchingHistorical} startIcon={isAnalyzingAnomalies ? <CircularProgress size={20} color="inherit" /> : <AnalyzeAndMarkIcon />} > {isAnalyzingAnomalies ? t('dashboard.adminActions.analyzingAnomaliesShort') : t('dashboard.adminActions.analyzeButton')} </Button> {isAnalyzingAnomalies && <CircularProgress size={24} />} </Stack> {!selectedContainerHasUploadedData && !isAnalyzingAnomalies && ( <Typography variant="caption" color="text.secondary" display="block" sx={{mt:1}}> {t('dashboard.adminActions.uploadDataFirst', {container: selectedContainer})} </Typography> )} {anomalyAnalysisResult && !isAnalyzingAnomalies && ( <Box sx={{ mt: 2, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, maxWidth: 450 }}> <Typography variant="subtitle2" gutterBottom> {t('dashboard.adminActions.analysisResultTitle')} </Typography> <Alert severity={(anomalyAnalysisResult.count > 0) ? "warning" : "info"}> <AlertTitle>{(anomalyAnalysisResult.count > 0) ? t('dashboard.adminActions.anomaliesFoundCount', { count: anomalyAnalysisResult.count, container: selectedContainer }) : t('dashboard.adminActions.noAnomaliesFound', { container: selectedContainer })}</AlertTitle> {anomalyAnalysisResult.count > 0 && ( <> <Typography variant="body2"> {t('dashboard.adminActions.anomaliesFoundCount', { count: anomalyAnalysisResult.count, container: selectedContainer })} </Typography> <Typography variant="caption" sx={{mt:1, mb:0.5}} display="block"> {t('dashboard.adminActions.anomalySampleTitle')} </Typography> <List dense disablePadding sx={{maxHeight: 150, overflowY: 'auto'}}> {anomalyAnalysisResult.sample.map((anom, index) => (
                                            <ListItem key={index} disableGutters dense sx={{pt:0,pb:0, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                                <ListItemText primaryTypographyProps={{fontSize: '0.8rem'}} primary={
                                                    <Box component="span" sx={{ display: 'flex', alignItems: 'center'}}>
                                                        <IsAnomalyIcon color="error" sx={{ fontSize: '1rem', mr: 0.5 }} />
                                                        {`${format(parseISO(anom.date), 'dd.MM.yy HH:mm', { locale: dateLocale })}: ${anom.value.toFixed(2)}`}
                                                    </Box>
                                                } />
                                                <MuiTooltip title={t(historicalData.some(d => d.date === anom.date && d.is_anomaly) ? 'dashboard.adminActions.markAsNotAnomalyTooltip' : 'dashboard.adminActions.markAsAnomalyTooltip')}>
                                                    <Box component="span" sx={{ display: 'inline-block' }}>
                                                        <IconButton size="small" onClick={() => handleToggleDataPointAnomaly(anom.date, true)} disabled={isUpdatingDataPoint === anom.date} color="primary" >
                                                            {isUpdatingDataPoint === anom.date ? <CircularProgress size={16} /> : <MarkAsNotAnomalyIcon fontSize="small" />}
                                                        </IconButton>
                                                    </Box>
                                                </MuiTooltip>
                                            </ListItem> ))} </List> </> )} </Alert> <Button onClick={handleClearAnomalyResult} size="small" sx={{mt:1}}> {t('dashboard.adminActions.clearResultsButton')} </Button> </Box> )}
                                        </Box>

                                        <Box sx={{width: '100%', pt: 2, mt:2, borderTop: `1px solid ${theme.palette.divider}`}}>
                                            <Typography variant="subtitle1" gutterBottom sx={{fontWeight: 'medium'}}> {t('dashboard.adminActions.dataCleaningTitle')} </Typography>
                                            <Stack spacing={2} direction="row" alignItems="center"> <Button variant="outlined" color="info" onClick={handleCleanData} disabled={isCleaningData || !selectedContainerHasUploadedData || isFetchingHistorical} startIcon={isCleaningData ? <CircularProgress size={20} color="inherit" /> : <CleaningIcon />} > {isCleaningData ? t('dashboard.adminActions.cleaningInProgressButton') : t('dashboard.adminActions.cleanDataButton')} </Button> {isCleaningData && <CircularProgress size={24} />} </Stack> {!selectedContainerHasUploadedData && !isCleaningData && ( <Typography variant="caption" color="text.secondary" display="block" sx={{mt:1}}> {t('dashboard.adminActions.uploadDataFirstForCleaning', {container: selectedContainer})} </Typography> )} {cleaningResult && !isCleaningData && ( <Box sx={{ mt: 2, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, maxWidth: 450 }}> <Typography variant="subtitle2" gutterBottom> {t('dashboard.adminActions.cleaningResultTitle')} </Typography> <Alert severity={(cleaningResult.nans_before > 0 && cleaningResult.nans_after > 0 && cleaningResult.nans_after < cleaningResult.nans_before && cleaningResult.values_imputed > 0) ? "warning" : ((cleaningResult.values_imputed > 0 && cleaningResult.nans_after === 0) ? "success" : "info")}> <AlertTitle>{(cleaningResult.nans_before > 0 && cleaningResult.nans_after > 0) ? t('dashboard.adminActions.cleaningReportPartialTitle') : t('dashboard.adminActions.cleaningReportTitle')}</AlertTitle> <React.Fragment> <Typography variant="body2"> {t('dashboard.adminActions.cleaningReportNansBefore', {count: cleaningResult.nans_before})} </Typography> <Typography variant="body2"> {t('dashboard.adminActions.cleaningReportValuesImputed', {count: cleaningResult.values_imputed})} </Typography> <Typography variant="body2"> {t('dashboard.adminActions.cleaningReportDbRowsUpdated', {count: cleaningResult.db_rows_updated})} </Typography> <Typography variant="body2"> {t('dashboard.adminActions.cleaningReportNansAfter', {count: cleaningResult.nans_after})} </Typography> {cleaningResult.detail && <Typography variant="caption" color="text.secondary" display="block" sx={{mt:1}}>{cleaningResult.detail}</Typography>} </React.Fragment> </Alert> <Button onClick={handleClearCleaningResult} size="small" sx={{mt:1}}> {t('dashboard.adminActions.clearResultsButton')} </Button> </Box> )}
                                        </Box>

                                        {user?.role === "Admin" && (
                                            <Box sx={{width: '100%', pt: 2, mt:2, borderTop: `1px solid ${theme.palette.divider}`}}>
                                                <Typography variant="subtitle1" gutterBottom sx={{fontWeight: 'medium'}}> {t('dashboard.containerManagement.title')} </Typography>
                                                <Stack spacing={2}>
                                                    <Button
                                                        variant="contained"
                                                        startIcon={<AddCircleOutlineIcon />}
                                                        onClick={() => { setOpenContainerDialog(true); setIsEditingContainer(false); setNewContainerName(''); setOriginalContainerName(''); }}
                                                    >
                                                        {t('dashboard.containerManagement.addNewContainer')}
                                                    </Button>
                                                    <List dense>
                                                        {availableContainers.length > 0 ? (
                                                            availableContainers.map((container, index) => (
                                                                <ListItem
                                                                    key={container}
                                                                    sx={{ pr: 0 }}
                                                                    secondaryAction={
                                                                        <Stack
                                                                            direction="row"
                                                                            spacing={0.5}
                                                                            sx={{ flexShrink: 0, width: '70px', justifyContent: 'flex-end' }}
                                                                        >
                                                                            <IconButton edge="end" aria-label="edit" onClick={() => {
                                                                                setOpenContainerDialog(true);
                                                                                setIsEditingContainer(true);
                                                                                setNewContainerName(container);
                                                                                setOriginalContainerName(container);
                                                                            }}>
                                                                                <EditIcon />
                                                                            </IconButton>
                                                                            <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteContainer(container)} disabled={defaultWaterContainers.includes(container)}>
                                                                                <MuiTooltip title={defaultWaterContainers.includes(container) ? t('dashboard.containerManagement.cannotDeleteDefault') : ''}>
                                                                                    <span><DeleteIcon color={defaultWaterContainers.includes(container) ? "disabled" : "error"} /></span>
                                                                                </MuiTooltip>
                                                                            </IconButton>
                                                                        </Stack>
                                                                    }
                                                                >
                                                                    <ListItemText
                                                                        primary={container}
                                                                        primaryTypographyProps={{
                                                                            noWrap: true,
                                                                            overflow: 'hidden',
                                                                            textOverflow: 'ellipsis',
                                                                            sx: { mr: 1.5, flexGrow: 1, flexShrink: 1 }
                                                                        }}
                                                                    />
                                                                </ListItem>
                                                            ))
                                                        ) : (
                                                            <Typography variant="body2" color="text.secondary">
                                                                {t('dashboard.containerManagement.noCustomContainers')}
                                                            </Typography>
                                                        )}
                                                    </List>
                                                </Stack>
                                            </Box>
                                        )}


                                        {modelTrainingReport && selectedModel && (
                                            <Box sx={{width: '100%', pt: 2, mt:2, borderTop: `1px solid ${theme.palette.divider}`}}>
                                                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                                                    <Typography variant="subtitle1" gutterBottom sx={{fontWeight: 'medium', mb:0}}>
                                                        {t('dashboard.adminActions.modelTrainingReportTitle', { model: selectedModel.charAt(0).toUpperCase() + selectedModel.slice(1) })}
                                                    </Typography>
                                                </Stack>
                                                <Paper variant="outlined" sx={{p:1.5, bgcolor: alpha(theme.palette.background.default, 0.5)}}>
                                                    <Box>
                                                        {selectedModel === 'prophet' && (
                                                            <>
                                                                {modelTrainingReport.detected_changepoints_count !== undefined && (
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, gap: 2 }}>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'normal', flexShrink: 0 }}>{t('dashboard.modelReport.detectedChangepoints')}:</Typography>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right', wordBreak: 'break-word' }}>{modelTrainingReport.detected_changepoints_count}</Typography>
                                                                    </Box>
                                                                )}
                                                                {modelTrainingReport.changepoint_prior_scale_used !== undefined && (
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, gap: 2 }}>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'normal', flexShrink: 0 }}>{t('dashboard.modelReport.changepointPriorScale')}:</Typography>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right', wordBreak: 'break-word' }}>{modelTrainingReport.changepoint_prior_scale_used?.toFixed(4)}</Typography>
                                                                    </Box>
                                                                )}
                                                                {modelTrainingReport.seasonality_prior_scale_used !== undefined && (
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, gap: 2 }}>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'normal', flexShrink: 0 }}>{t('dashboard.modelReport.seasonalityPriorScale')}:</Typography>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right', wordBreak: 'break-word' }}>{modelTrainingReport.seasonality_prior_scale_used?.toFixed(2)}</Typography>
                                                                    </Box>
                                                                )}
                                                                {modelTrainingReport.seasonality_mode_used && (
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, gap: 2 }}>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'normal', flexShrink: 0 }}>{t('dashboard.modelReport.seasonalityMode')}:</Typography>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right', wordBreak: 'break-word' }}>{modelTrainingReport.seasonality_mode_used}</Typography>
                                                                    </Box>
                                                                )}
                                                                {modelTrainingReport.daily_seasonality_setting !== undefined && (
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, gap: 2 }}>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'normal', flexShrink: 0 }}>{t('dashboard.modelReport.dailySeasonality')}:</Typography>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right', wordBreak: 'break-word' }}>{modelTrainingReport.daily_seasonality_setting ? t('common.yes') : t('common.no')}</Typography>
                                                                    </Box>
                                                                )}
                                                                {modelTrainingReport.holidays_configured_count !== undefined && (
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, gap: 2 }}>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'normal', flexShrink: 0 }}>{t('dashboard.modelReport.holidaysConfigured')}:</Typography>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right', wordBreak: 'break-word' }}>{modelTrainingReport.holidays_configured_count}</Typography>
                                                                    </Box>
                                                                )}
                                                                {modelTrainingReport.training_loss !== undefined && modelTrainingReport.training_loss !== null && (
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, gap: 2 }}>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'normal', flexShrink: 0 }}>{t('dashboard.modelReport.trainingLoss')}:</Typography>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right', wordBreak: 'break-word' }}>{typeof modelTrainingReport.training_loss === 'number' ? modelTrainingReport.training_loss.toFixed(6) : modelTrainingReport.training_loss}</Typography>
                                                                    </Box>
                                                                )}
                                                            </>
                                                        )}
                                                        {selectedModel === 'tensorflow' && (
                                                            <>
                                                                {modelTrainingReport.training_loss !== undefined && modelTrainingReport.training_loss !== null && (
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, gap: 2 }}>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'normal', flexShrink: 0 }}>{t('dashboard.modelReport.trainingLoss')}:</Typography>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right', wordBreak: 'break-word' }}>{typeof modelTrainingReport.training_loss === 'number' ? modelTrainingReport.training_loss.toFixed(6) : modelTrainingReport.training_loss}</Typography>
                                                                    </Box>
                                                                )}
                                                                {modelTrainingReport.validation_loss !== undefined && modelTrainingReport.validation_loss !== null && (
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, gap: 2 }}>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'normal', flexShrink: 0 }}>{t('dashboard.modelReport.validationLoss')}:</Typography>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right', wordBreak: 'break-word' }}>{modelTrainingReport.validation_loss.toFixed(6)}</Typography>
                                                                    </Box>
                                                                )}
                                                                {modelTrainingReport.look_back_window !== undefined && (
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, gap: 2 }}>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'normal', flexShrink: 0 }}>{t('dashboard.modelReport.lookBackWindow')}:</Typography>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right', wordBreak: 'break-word' }}>{modelTrainingReport.look_back_window}</Typography>
                                                                    </Box>
                                                                )}
                                                                {modelTrainingReport.lstm_units_layer1 !== undefined && (
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, gap: 2 }}>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'normal', flexShrink: 0 }}>{t('dashboard.modelReport.lstmUnitsL1')}:</Typography>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right', wordBreak: 'break-word' }}>{modelTrainingReport.lstm_units_layer1}</Typography>
                                                                    </Box>
                                                                )}
                                                                {modelTrainingReport.lstm_units_layer2 !== undefined && (
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, gap: 2 }}>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'normal', flexShrink: 0 }}>{t('dashboard.modelReport.lstmUnitsL2')}:</Typography>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right', wordBreak: 'break-word' }}>{modelTrainingReport.lstm_units_layer2}</Typography>
                                                                    </Box>
                                                                )}
                                                                {modelTrainingReport.dropout_rate !== undefined && (
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, gap: 2 }}>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'normal', flexShrink: 0 }}>{t('dashboard.modelReport.dropoutRate')}:</Typography>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right', wordBreak: 'break-word' }}>{modelTrainingReport.dropout_rate?.toFixed(2)}</Typography>
                                                                    </Box>
                                                                )}
                                                                {modelTrainingReport.epochs_trained !== undefined && (
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, gap: 2 }}>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'normal', flexShrink: 0 }}>{t('dashboard.modelReport.epochsTrained')}:</Typography>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right', wordBreak: 'break-word' }}>{modelTrainingReport.epochs_trained}</Typography>
                                                                    </Box>
                                                                )}
                                                                {modelTrainingReport.early_stopping_patience !== undefined && (
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, gap: 2 }}>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'normal', flexShrink: 0 }}>{t('dashboard.modelReport.earlyStoppingPatience')}:</Typography>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right', wordBreak: 'break-word' }}>{modelTrainingReport.early_stopping_patience}</Typography>
                                                                    </Box>
                                                                )}
                                                                {modelTrainingReport.batch_size !== undefined && (
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, gap: 2 }}>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'normal', flexShrink: 0 }}>{t('dashboard.modelReport.batchSize')}:</Typography>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right', wordBreak: 'break-word' }}>{modelTrainingReport.batch_size}</Typography>
                                                                    </Box>
                                                                )}
                                                                {modelTrainingReport.features_used_count !== undefined && (
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, gap: 2 }}>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'normal', flexShrink: 0 }}>{t('dashboard.modelReport.featuresUsedCount')}:</Typography>
                                                                        <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right', wordBreak: 'break-word' }}>{modelTrainingReport.features_used_count}</Typography>
                                                                    </Box>
                                                                )}
                                                            </>
                                                        )}
                                                        {modelTrainingReport.active_regressors && (
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, gap: 2 }}>
                                                                <Typography variant="body2" sx={{ fontWeight: 'normal', flexShrink: 0 }}>{t('dashboard.modelReport.activeRegressors')}:</Typography>
                                                                <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'right', wordBreak: 'break-word' }}>
                                                                    {modelTrainingReport.active_regressors.length > 0 ? modelTrainingReport.active_regressors.join(', ') : t('common.none')}
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 1 }}>
                                                        <MuiTooltip title={t('dashboard.adminActions.clearResultsButton')}>
                                                            <IconButton onClick={handleClearModelTrainingReport} size="small">
                                                                <CloseIcon />
                                                            </IconButton>
                                                        </MuiTooltip>
                                                    </Box>
                                                </Paper>
                                            </Box>
                                        )}
                                    </Stack>
                                </CardContent>
                            </Paper>
                        </motion.div>
                    )}
                </Box>
            </Box>

            <Dialog open={openContainerDialog} onClose={() => setOpenContainerDialog(false)}>
                <DialogTitle>{isEditingContainer ? t('dashboard.containerManagement.editContainerTitle') : t('dashboard.containerManagement.addContainerTitle')}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label={t('dashboard.containerManagement.containerNameLabel')}
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={newContainerName}
                        onChange={(e) => setNewContainerName(e.target.value)}
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenContainerDialog(false)}>{t('common.cancel')}</Button>
                    <Button onClick={handleAddEditContainer} variant="contained">{isEditingContainer ? t('common.save') : t('common.add')}</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Dashboard;