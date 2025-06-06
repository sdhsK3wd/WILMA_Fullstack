import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '@mui/material/styles';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Pfad anpassen, falls nötig
import axiosStatic from 'axios'; // Importiert für Typ-Prüfung (isAxiosError)
import axios from '../api/axiosInstance'; // Pfad anpassen, falls nötig
import { useTranslation } from 'react-i18next'; // <-- useTranslation importieren

import {
    Box, AppBar, Toolbar, Typography, CssBaseline, Collapse, Tooltip,
    Stack, alpha, CircularProgress, Paper, TextField, MenuItem, Chip,
    TablePagination, Skeleton,
    FormControl, Avatar, IconButton,
    Divider, // <-- Divider hier wieder hinzufügen!
} from '@mui/material';

import {
    Article as LogsIcon,
    ErrorOutline as ErrorIconMui,
    WarningAmber as WarnIcon,
    InfoOutlined as InfoIcon,
    BugReport as DebugIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    RestartAlt as ResetIcon,
} from '@mui/icons-material';
import { format, parseISO, isValid } from 'date-fns';

import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

import LogsNavbar from './LogsNavbar';


// Interfaces (Behalten - stelle sicher, dass diese Definitionen korrekt und nur einmal vorhanden sind)
type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
interface LogEntry { id: number; timestamp: string; level: LogLevel; user: string; message: string; details?: Record<string, any>; }
const LogLevelOrder: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG'];

const Logs: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterUser, setFilterUser] = useState<string>('all');
    const [filterLevel, setFilterLevel] = useState<string>('all');
    const [filterStartDate, setFilterStartDate] = useState<string>('');
    const [filterEndDate, setFilterEndDate] = useState<string>('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(15);
    const [orderBy, setOrderBy] = useState<keyof LogEntry>('timestamp');
    const [order, setOrder] = useState<'asc' | 'desc'>('desc');
    const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
    const [availableUsersState, setAvailableUsersState] = useState<string[]>(['all']);

    const { user, isAdmin, token } = useAuth();
    const theme = useTheme();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();

    useEffect(() => {
        if (user === undefined) { setIsLoading(true); return; }
        if (!isAdmin) {
            toast.error(t("common.accessDenied"));
            navigate('/home', { replace: true });
            setIsLoading(false);
            return;
        }
        if (!token) {
            toast.error(t("common.authTokenMissingToast"));
            navigate('/login', { replace: true });
            setIsLoading(false);
            return;
        }

        const fetchLogsFromBackend = async () => {
            setIsLoading(true);
            try {
                const params = new URLSearchParams();
                if (filterLevel !== 'all') params.append('level', filterLevel);
                if (filterUser !== 'all') params.append('user', filterUser);
                if (filterStartDate) params.append('startDate', filterStartDate);
                if (filterEndDate) params.append('endDate', filterEndDate);

                const response = await axios.get(`/api/logs?${params.toString()}`);
                const data: any[] = response.data;
                const fetchedLogs: LogEntry[] = data.map(log => ({
                    id: log.id, timestamp: log.timestamp, level: log.level.toUpperCase() as LogLevel,
                    user: log.user, message: log.message,
                    details: log.detailsJson ? JSON.parse(log.detailsJson) : undefined,
                }));
                setLogs(fetchedLogs);
                const uniqueUsers = [...new Set(fetchedLogs.map(log => log.user))];
                setAvailableUsersState(['all', ...uniqueUsers.sort((a,b) => a.localeCompare(b))]);
            } catch (error: any) {
                console.error("Fehler beim Abrufen der Logs:", error);
                let errorMsg = t("logs.toast.fetchLogsErrorUnknown");

                if (axiosStatic.isAxiosError(error)) {
                    if (error.response?.status === 401 || error.response?.status === 403) {
                        toast.error(t("logs.toast.fetchLogsErrorAuth"));
                        navigate('/login', { replace: true });
                        return;
                    } else if (error.response?.status === 404) {
                        toast.error(t("logs.toast.fetchLogsErrorNotFound"));
                    } else {
                        const backendMessage = error.response?.data?.message || error.message;
                        if (backendMessage) {
                            console.warn("Backend error message (logs):", backendMessage);
                            errorMsg = `${t("logs.toast.fetchLogsErrorGeneric")}: ${backendMessage}`;
                        } else {
                            errorMsg = t("logs.toast.fetchLogsErrorGeneric");
                        }
                    }
                } else {
                    errorMsg = t("logs.toast.fetchLogsErrorGeneric");
                }

                if (!(axiosStatic.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403))) {
                    toast.error(errorMsg);
                }

                setLogs([]);
            } finally { setIsLoading(false); }
        };
        if (isAdmin) {
            fetchLogsFromBackend();
        } else {
            setLogs([]);
            setIsLoading(false);
        }
    }, [isAdmin, token, navigate, filterLevel, filterUser, filterStartDate, filterEndDate, user, t]);

    const availableLevels: { value: string, label: string }[] = useMemo(() => [
        { value: 'all', label: t('logs.filters.allLevels') },
        { value: 'ERROR', label: t('logs.level.error') },
        { value: 'WARN', label: t('logs.level.warn') },
        { value: 'INFO', label: t('logs.level.info') },
        { value: 'DEBUG', label: t('logs.level.debug') },
    ], [t]);

    const sortedLogs = useMemo(() => {
        let processed = [...logs];
        processed.sort((a, b) => {
            const orderMultiplier = order === 'asc' ? 1 : -1;
            const valA = a[orderBy];
            const valB = b[orderBy];

            if (orderBy === 'timestamp') {
                try {
                    const timeA = isValid(parseISO(valA as string)) ? parseISO(valA as string).getTime() : NaN;
                    const timeB = isValid(parseISO(valB as string)) ? parseISO(valB as string).getTime() : NaN;

                    if (isNaN(timeA) && isNaN(timeB)) return 0;
                    if (isNaN(timeA)) return 1 * orderMultiplier;
                    if (isNaN(timeB)) return -1 * orderMultiplier;

                    return (timeA - timeB) * orderMultiplier;
                } catch { return 0; }
            }
            if (orderBy === 'level') {
                const levelOrderMap: Record<LogLevel, number> = { 'ERROR': 1, 'WARN': 2, 'INFO': 3, 'DEBUG': 4 };
                const levelA = levelOrderMap[valA as LogLevel] ?? 5;
                const levelB = levelOrderMap[valB as LogLevel] ?? 5;
                return (levelA - levelB) * orderMultiplier;
            }
            if (typeof valA === 'string' && typeof valB === 'string') {
                return valA.localeCompare(valB, i18n.language) * orderMultiplier;
            }
            return 0;
        });
        return processed;
    }, [logs, order, orderBy, i18n.language]);

    const handleChangePage = (event: unknown, newPage: number) => setPage(newPage);
    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); };
    const handleRowToggle = (id: number) => setExpandedRowId(prev => (prev === id ? null : id));
    const handleResetFilters = () => {
        setFilterLevel('all'); setFilterUser('all'); setFilterStartDate(''); setFilterEndDate(''); setPage(0);
    };

    const getLogLevelPresentation = useCallback((level: LogLevel): { color: string, bgColor: string, IconComponent: React.ElementType } => {
        switch (level) {
            case 'ERROR': return { color: theme.palette.error.main, bgColor: alpha(theme.palette.error.main, 0.15), IconComponent: ErrorIconMui };
            case 'WARN': return { color: theme.palette.warning.main, bgColor: alpha(theme.palette.warning.main, 0.15), IconComponent: WarnIcon };
            case 'INFO': return { color: theme.palette.info.main, bgColor: alpha(theme.palette.info.main, 0.15), IconComponent: InfoIcon };
            case 'DEBUG': return { color: theme.palette.mode === 'dark' ? theme.palette.grey[400] : theme.palette.grey[700], bgColor: alpha(theme.palette.grey[500], 0.15), IconComponent: DebugIcon };
            default: return { color: theme.palette.text.secondary, bgColor: alpha(theme.palette.grey[500], 0.1), IconComponent: LogsIcon };
        }
    }, [theme]);

    const stats = useMemo(() => ({
        total: sortedLogs.length,
        errors: sortedLogs.filter(l => l.level === 'ERROR').length,
        warnings: sortedLogs.filter(l => l.level === 'WARN').length
    }), [sortedLogs]);

    const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
    const itemVariants = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

    const renderFilterSkeletons = () => ( <Paper elevation={0} variant="outlined" sx={{ p: 1.5, mb: 3, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.5) }}><Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} ><Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, flexGrow: 1, alignItems: 'center' }}><Skeleton variant="text" width={50} height={20} sx={{ mr: 1 }}/><Skeleton variant="rounded" height={40} width={150} /><Skeleton variant="rounded" height={40} width={160} /><Skeleton variant="rounded" height={40} width={160} /><Skeleton variant="rounded" height={40} width={160} /></Box><Box sx={{ display: 'flex', alignItems: 'center', width: { xs: '100%', md: 'auto' }, justifyContent: { xs: 'flex-end', md: 'flex-start'} }}><Skeleton variant="circular" width={32} height={32} /></Box></Stack></Paper>);
    const renderStatsSkeletons = () => ( <Stack direction="row" spacing={1.5} mb={3} justifyContent="flex-start" flexWrap="wrap" sx={{ px: 1}}><Skeleton variant="rounded" width={100} height={24} /><Skeleton variant="rounded" width={120} height={24} /><Skeleton variant="rounded" width={140} height={24} /></Stack>);
    const renderLogSkeletons = (count = 5) => ( <Stack spacing={1.5} sx={{ maxWidth: '1200px', mx: 'auto' }}>{[...Array(count)].map((_, index) => (<Paper key={`skel-log-${index}`} elevation={0} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', borderColor: alpha(theme.palette.divider, 0.5) }} ><Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ p: 1.5 }} ><Box sx={{pt: 0.5}}><Skeleton variant="circular" width={36} height={36} /></Box><Stack direction="column" sx={{ flexGrow: 1, width: 'calc(100% - 60px)' }}><Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}><Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap"><Skeleton variant="rounded" height={22} width={80} /><Skeleton variant="rounded" height={20} width={50} /></Stack><Skeleton variant="text" width={80} height={20} /></Stack><Skeleton variant="text" width="95%" height={24} sx={{ mt: 1 }} /></Stack></Stack></Paper>))}</Stack>);

    const isInitialPageLoad = user === undefined || (isLoading && logs.length === 0 && isAdmin && filterLevel === 'all' && filterUser === 'all' && !filterStartDate && !filterEndDate);

    if (user === undefined || isInitialPageLoad) {
        if (user === undefined) {
            return (
                <Box sx={{ display: 'flex', height: '100vh', width: '100%', justifyContent: 'center', alignItems: 'center', bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.background.default }}>
                    <CircularProgress />
                </Box>
            );
        }
        if (isAdmin) {
            return (
                <Box sx={{ display: 'flex' }}>
                    <CssBaseline /><LogsNavbar />
                    <AppBar position="fixed" sx={{ width: '100%', zIndex: theme.zIndex.drawer + 1, bgcolor: alpha(theme.palette.background.paper, 0.8), backdropFilter: 'blur(8px)', color: theme.palette.text.primary, boxShadow: theme.shadows[1], borderBottom: `1px solid ${theme.palette.divider}` }}>
                        <Toolbar><LogsIcon sx={{ mr: 1.5, color: 'primary.main' }} /><Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}> {t('logs.appBarTitle')} </Typography>{user && (<Typography sx={{ mr: 2, display: {xs:'none',sm:'block'} }}>{user.username} ({user.role})</Typography>)}<Avatar src={user?.profileImageUrl || undefined} sx={{ bgcolor: theme.palette.primary.main, color: theme.palette.primary.contrastText }}>{user?.username?.charAt(0).toUpperCase()}</Avatar></Toolbar>
                    </AppBar>
                    <Box component="main" sx={{ flexGrow: 1, bgcolor: theme.palette.background.default, minHeight: '100vh' }} ><Toolbar /><Box sx={{ p: { xs: 2, md: 3 } }}>{renderFilterSkeletons()}{renderStatsSkeletons()}{renderLogSkeletons(rowsPerPage)}</Box></Box>
                </Box>
            );
        }
        return null;
    }

    if (!isAdmin) {
        return null;
    }

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline /><LogsNavbar />
            <AppBar position="fixed" sx={{ width: '100%', zIndex: theme.zIndex.drawer + 1, bgcolor: alpha(theme.palette.background.paper, 0.85), backdropFilter: 'blur(8px)', color: theme.palette.text.primary, boxShadow: theme.shadows[1], borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Toolbar><LogsIcon sx={{ mr: 1.5, color: 'primary.main' }} /><Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}> {t('logs.appBarTitle')} </Typography>{user && (<Typography sx={{ mr: 2, display: {xs:'none',sm:'block'} }}>{user.username} ({user.role})</Typography>)}<Avatar src={user?.profileImageUrl || undefined} sx={{ bgcolor: theme.palette.primary.main, color: theme.palette.primary.contrastText }}>{user?.username?.charAt(0).toUpperCase()}</Avatar></Toolbar>
            </AppBar>
            <Box component="main" sx={{ flexGrow: 1, bgcolor: theme.palette.background.default, minHeight: '100vh' }}>
                <Toolbar />
                <Box sx={{ p: { xs: 2, md: 3 } }}>
                    <Paper elevation={0} variant="outlined" sx={{ p: 1.5, mb: 3, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.5) }}>
                        <Stack direction={{xs:'column',md:'row'}} spacing={1.5} alignItems={{md:'center'}}><Box sx={{display:'flex',flexWrap:'wrap',gap:1.5,flexGrow:1,alignItems:'center'}}>
                            <Typography variant="body2" sx={{fontWeight:500,color:'text.secondary',mr:1}}>{t('logs.filters.label')}:</Typography>
                            <FormControl sx={{minWidth:150}} size="small">
                                <TextField select label={t('logs.filters.severityLabel')} value={filterLevel} onChange={(e)=>setFilterLevel(e.target.value)} size="small">
                                    {availableLevels.map(item=>(<MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>))}
                                </TextField>
                            </FormControl>
                            <FormControl sx={{minWidth:160}} size="small">
                                <TextField select label={t('logs.filters.userLabel')} value={filterUser} onChange={(e)=>setFilterUser(e.target.value)} size="small">
                                    {availableUsersState.map(u=>(
                                        <MenuItem key={u} value={u}>
                                            {u==='all' ? t('logs.filters.allUsers') : u}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            </FormControl>
                            <TextField label={t('logs.filters.startDateLabel')} type="date" size="small" value={filterStartDate} onChange={(e)=>setFilterStartDate(e.target.value)} InputLabelProps={{shrink:true}} sx={{minWidth:160}} InputProps={{sx:{fontSize:'0.875rem'}}}/>
                            <TextField label={t('logs.filters.endDateLabel')} type="date" size="small" value={filterEndDate} onChange={(e)=>setFilterEndDate(e.target.value)} InputLabelProps={{shrink:true}} sx={{minWidth:160}} InputProps={{sx:{fontSize:'0.875rem'}}}/>
                        </Box><Box sx={{display:'flex',alignItems:'center',width:{xs:'100%',md:'auto'},justifyContent:{xs:'flex-end',md:'flex-start'}}}><Tooltip title={t('logs.filters.resetTooltip')}><IconButton onClick={handleResetFilters} size="small"><ResetIcon/></IconButton></Tooltip></Box></Stack>
                    </Paper>

                    <Stack direction="row" spacing={1.5} mb={3} justifyContent="flex-start" flexWrap="wrap" sx={{px:1}}>
                        <Chip label={t('logs.stats.results', { count: stats.total })} variant='outlined' size="small"/>
                        <Chip icon={<ErrorIconMui fontSize="small"/>} label={t('logs.stats.errors', { count: stats.errors })} variant='outlined' color="error" size="small"/>
                        <Chip icon={<WarnIcon fontSize="small"/>} label={t('logs.stats.warnings', { count: stats.warnings })} variant='outlined' color="warning" size="small"/>
                    </Stack>

                    <Box sx={{maxWidth:'1200px',mx:'auto'}}>
                        <AnimatePresence mode="wait">
                            {isLoading ? (
                                <motion.div key="skeleton-logs-list-active" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>{renderLogSkeletons(rowsPerPage)}</motion.div>
                            ) : (
                                <motion.div key="content-logs-list-active" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                                    {sortedLogs.length === 0 ? (
                                        <Paper elevation={0} variant="outlined" sx={{p:4,textAlign:'center',bgcolor:'transparent',borderRadius:3,borderColor:alpha(theme.palette.divider,0.5)}}>
                                            <Typography color="text.secondary">
                                                {filterLevel === 'all' && filterUser === 'all' && !filterStartDate && !filterEndDate
                                                    ? t('logs.empty.noData')
                                                    : t('logs.empty.noMatchingLogs')}
                                            </Typography>
                                        </Paper>
                                    ) : (
                                        <Stack spacing={1.5} component={motion.div} variants={containerVariants} initial="hidden" animate="visible">
                                            {sortedLogs.slice(page*rowsPerPage, page*rowsPerPage+rowsPerPage).map((log) => {
                                                const levelUI = getLogLevelPresentation(log.level); const isExpanded = expandedRowId === log.id;
                                                const isValidDate = isValid(parseISO(log.timestamp));
                                                const formattedTimestamp = isValidDate ? format(parseISO(log.timestamp),'dd MMM, HH:mm:ss') : t('logs.timestamp.invalidDate');

                                                return (
                                                    <motion.div key={log.id} variants={itemVariants}>
                                                        <Paper elevation={0} variant="outlined" sx={{borderRadius:2,overflow:'hidden',borderColor:alpha(theme.palette.divider,0.5),'&:hover':{borderColor:theme.palette.primary.light,boxShadow:`0 0 0 1px ${alpha(theme.palette.primary.light,0.5)}`}}}>
                                                            <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{p:1.5}}>
                                                                <Avatar sx={{bgcolor:levelUI.bgColor,width:36,height:36,mt:0.5}}>
                                                                    <levelUI.IconComponent sx={{color:levelUI.color,fontSize:'1.2rem'}}/>
                                                                </Avatar>
                                                                <Stack direction="column" sx={{flexGrow:1,width:'calc(100% - 60px)'}}>
                                                                    <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                                                                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                                                            <Chip label={log.user} size="small" variant="outlined" sx={{height:22,cursor:'pointer'}} onClick={()=>setFilterUser(log.user)}/>
                                                                            <Chip
                                                                                label={t(`logs.level.${log.level.toLowerCase()}`)}
                                                                                size="small"
                                                                                variant="filled"
                                                                                sx={{bgcolor:alpha(levelUI.color,0.2),color:levelUI.color,fontWeight:500,height:20,fontSize:'0.7rem',cursor:'pointer'}}
                                                                                onClick={()=>setFilterLevel(log.level)}
                                                                            />
                                                                        </Stack>
                                                                        <Tooltip title={isValidDate?format(parseISO(log.timestamp),'yyyy-MM-dd HH:mm:ss.SSS'):t('logs.timestamp.invalidDate')}>
                                                                            <Typography variant="caption" sx={{color:'text.secondary',whiteSpace:'nowrap',textAlign:'right',ml:1}}>
                                                                                {formattedTimestamp}
                                                                            </Typography>
                                                                        </Tooltip>
                                                                    </Stack>
                                                                    <Typography variant="body1" sx={{wordBreak:'break-word',textAlign:'left',pt:0.75,pb:log.details?0:0.5,whiteSpace:'pre-wrap'}}>{log.message}</Typography>
                                                                    {log.details && (<Box sx={{textAlign:'right',mt:log.message.length>100?-0.5:0.25}}>
                                                                        <IconButton size="small" onClick={()=>handleRowToggle(log.id)} aria-label={t('logs.details.toggleButtonAriaLabel')}>
                                                                            {isExpanded?<ExpandLessIcon fontSize="small"/>:<ExpandMoreIcon fontSize="small"/>}
                                                                        </IconButton>
                                                                    </Box>)}
                                                                </Stack>
                                                            </Stack>
                                                            {log.details && (<Collapse in={isExpanded} timeout="auto" unmountOnExit><Divider variant="fullWidth" sx={{borderColor:alpha(theme.palette.divider,0.3)}}/><Box sx={{pl:{xs:2,sm:7},pr:2,py:1.5,bgcolor:alpha(theme.palette.text.primary,theme.palette.mode==='dark'?0.08:0.03)}}><Typography variant="caption" component="pre" sx={{whiteSpace:'pre-wrap',wordBreak:'break-all',fontFamily:'monospace',fontSize:'0.8rem',color:theme.palette.text.secondary}}>{JSON.stringify(log.details,null,2)}</Typography></Box></Collapse>)}
                                                        </Paper>
                                                    </motion.div>
                                                );
                                            })}
                                        </Stack>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                        {(sortedLogs.length > 0 && sortedLogs.length > rowsPerPage) && (
                            <TablePagination
                                rowsPerPageOptions={[15,25,50,100]}
                                component={Paper}
                                count={sortedLogs.length}
                                rowsPerPage={rowsPerPage}
                                page={page}
                                onPageChange={handleChangePage}
                                onRowsPerPageChange={handleChangeRowsPerPage}
                                sx={{mt:3,borderRadius:2,border:`1px solid ${theme.palette.divider}`,bgcolor:'background.paper',boxShadow:'none'}}
                                labelRowsPerPage={t('logs.pagination.labelRowsPerPage')}
                            />
                        )}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};
export default Logs;