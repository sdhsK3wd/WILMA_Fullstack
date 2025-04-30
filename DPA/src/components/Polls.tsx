// Polls.tsx - Mit Löschfunktion (Korrigiert)
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import axiosStatic from 'axios'; // Importiert für Typ-Prüfung (isAxiosError)
import axiosInstance from '../api/axiosInstance'; // Deine konfigurierte Instanz
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext'; // Stellt sicher, dass der Pfad korrekt ist

import {
    Box, AppBar, Toolbar, Typography, CssBaseline, Card, CardContent, CardHeader, CardActions,
    Button, useTheme, CircularProgress, Avatar, Drawer, List, ListItem,
    ListItemText, ListItemButton, ListItemIcon, Divider, Stack, alpha, ListSubheader,
    RadioGroup, FormControlLabel, Radio, FormControl,
    LinearProgress,
    TextField, // Wird im Create-Formular verwendet
    Paper,     // Wird im Create-Formular verwendet
    IconButton, // Für Löschen-Button
    Dialog,     // Für Bestätigungsdialog
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle
} from '@mui/material';
import { LoadingButton } from '@mui/lab';

import {
    Home as HomeIcon,
    HowToVote as PollsIcon,
    AddCircleOutline as AddIcon,
    CheckCircle as VotedIcon,
    RadioButtonUnchecked as RadioButtonUncheckedIcon,
    RadioButtonChecked as RadioCheckedIcon,
    Delete as DeleteIcon // Für Löschen-Button
} from '@mui/icons-material';

// Stelle sicher, dass der Pfad zum Logo korrekt ist
import logo from '../images/Logo.png';

// Interfaces
interface PollOption {
    id: number;
    text: string;
    votes: number;
}
interface Poll {
    id: number;
    title: string;
    description: string | null;
    options: PollOption[];
    createdBy: string;
    userVoteOptionId: number | null;
    totalVotes: number;
}

// PollsNavbar Komponente
const drawerWidth = 240;
interface PollsNavItem { text: string; icon: React.ReactElement; path: string; }
const PollsNavbar: React.FC = () => {
    const location = useLocation();
    const theme = useTheme();
    const navItems: PollsNavItem[] = [ { text: 'Abstimmungen', icon: <PollsIcon />, path: '/polls' }, ];

    return (
        <Drawer variant="permanent" sx={{ width: drawerWidth, flexShrink: 0, [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box', borderRight: `1px solid ${theme.palette.divider}` }, }}>
            <Toolbar sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1 }}> <img src={logo} alt="GWT Logo" style={{ height: 40, width: 'auto' }} /> </Toolbar>
            <Divider />
            <List sx={{ padding: 1 }}>
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton component={RouterLink} to="/home" sx={{ borderRadius: 1, '&:hover': { backgroundColor: theme.palette.action.hover, } }}>
                        <ListItemIcon sx={{ minWidth: 40 }}> <HomeIcon /> </ListItemIcon>
                        <ListItemText primary="Home" />
                    </ListItemButton>
                </ListItem>
                <Divider sx={{ my: 1 }}/>
                <ListSubheader sx={{ bgcolor: 'transparent', fontWeight: 'bold', color: 'text.primary' }}> Abstimmungen </ListSubheader>
                {navItems.map((item) => {
                    const isSelected = location.pathname === item.path;
                    return (
                        <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                            <ListItemButton
                                component={RouterLink}
                                to={item.path}
                                selected={isSelected}
                                sx={{
                                    borderRadius: 1,
                                    '&.Mui-selected': {
                                        backgroundColor: alpha(theme.palette.primary.light, 0.12),
                                        '&:hover': { backgroundColor: alpha(theme.palette.primary.light, 0.18), },
                                        '& .MuiListItemIcon-root, & .MuiListItemText-primary': {
                                            color: theme.palette.primary.dark,
                                            fontWeight: 600,
                                        },
                                    },
                                    '&:hover': { backgroundColor: theme.palette.action.hover, }
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: 40, color: isSelected ? theme.palette.primary.dark : 'inherit' }}>
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText primary={item.text} />
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>
        </Drawer>
    );
};


// Hauptkomponente Polls
const Polls: React.FC = () => {
    // State Variablen...
    const [isLoading, setIsLoading] = useState(true);
    const [polls, setPolls] = useState<Poll[]>([]);
    const [selectedVote, setSelectedVote] = useState<{ [pollId: number]: number }>({});
    const [votingPollId, setVotingPollId] = useState<number | null>(null);
    const [isCreating, setIsCreating] = useState<boolean>(false);
    const [newPollTitle, setNewPollTitle] = useState<string>(""); // Wird verwendet
    const [newPollDescription, setNewPollDescription] = useState<string>("");
    const [optionsString, setOptionsString] = useState<string>("");
    const [isSubmittingPoll, setIsSubmittingPoll] = useState<boolean>(false);
    const [openDeleteDialog, setOpenDeleteDialog] = useState<boolean>(false);
    const [pollToDelete, setPollToDelete] = useState<Poll | null>(null);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    // Hooks
    const { user } = useAuth();
    const theme = useTheme();
    const navigate = useNavigate();

    // Funktion zum Laden der Polls
    const fetchPolls = useCallback(async (source?: string) => {
        console.log(`fetchPolls aufgerufen von: ${source || 'useEffect'}`);
        if (source !== 'handleVoteSubmit - verify') {
            setIsLoading(true);
        }
        try {
            const response = await axiosInstance.get<Poll[]>(`/api/Voting`);
            console.log('fetchPolls - Empfangene Daten:', response.data);
            setPolls(response.data);
        } catch (error) {
            console.error("Fehler beim Laden der Abstimmungen:", error);
            if (axiosStatic.isAxiosError(error) && error.response?.status !== 401) {
                toast.error(`Fehler beim Laden: ${error.response?.data?.message || error.message}`);
            } else if (!(error instanceof Error && error.message === "Session expired")) {
                toast.error("Ein unbekannter Fehler ist beim Laden aufgetreten.");
            }
        } finally {
            if (source !== 'handleVoteSubmit - verify') {
                setIsLoading(false);
            }
        }
    }, []);

    // Effekt zum initialen Laden und bei User-Änderung
    useEffect(() => {
        if (user === undefined) return;
        if (user === null) {
            navigate('/login', { replace: true });
            return;
        }
        fetchPolls('useEffect');
    }, [user, navigate, fetchPolls]);

    // Handler für Änderungen bei der Abstimmungsauswahl
    const handleVoteChange = (pollId: number, optionIdValue: string | number) => {
        const optionId = typeof optionIdValue === 'string' ? parseInt(optionIdValue, 10) : optionIdValue;
        if (!isNaN(optionId)) {
            setSelectedVote(prev => ({ ...prev, [pollId]: optionId }));
        }
    };

    // Handler zum Absenden einer Stimme
    const handleVoteSubmit = async (pollId: number) => {
        const optionId = selectedVote[pollId];
        if (!optionId || !user) return;
        setVotingPollId(pollId);
        const toastId = `voting-toast-${pollId}`;
        toast.loading('Stimme wird übermittelt...', { id: toastId });

        // Optimistic Update
        const originalPolls = [...polls];
        let updatedPollIndex = -1;
        const updatedPolls = polls.map((p, index) => {
            if (p.id === pollId) {
                updatedPollIndex = index;
                return {
                    ...p,
                    userVoteOptionId: optionId,
                    totalVotes: p.totalVotes + 1,
                    options: p.options.map(opt =>
                        opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
                    ),
                };
            }
            return p;
        });
        setPolls(updatedPolls);
        console.log('Optimistic Update - Neuer State gesetzt:', updatedPolls);
        if (updatedPollIndex !== -1) {
            console.log('Optimistic Update - Betroffener Poll:', updatedPolls[updatedPollIndex]);
        }
        setSelectedVote(prev => { const newState = { ...prev }; delete newState[pollId]; return newState; });

        try {
            await axiosInstance.post(`/api/Voting/vote/${pollId}`, { optionId });
            toast.success('Erfolgreich abgestimmt!', { id: toastId });
            // Optional: await fetchPolls('handleVoteSubmit - verify');
        } catch (error) {
            console.error("Fehler beim Abstimmen (Backend):", error);
            let errorMsg = 'Fehler beim Abstimmen.';
            if (axiosStatic.isAxiosError(error)) { errorMsg = error.response?.data?.message || error.message || errorMsg; }
            toast.error(errorMsg, { id: toastId });
            // Rollback
            console.log("Rollback optimistic update for poll ID:", pollId);
            setPolls(originalPolls);
            setSelectedVote(prev => ({ ...prev, [pollId]: optionId }));
        } finally {
            setVotingPollId(null);
        }
    };

    // Handler zum Abbrechen der Poll-Erstellung
    const handleCancelCreate = () => {
        setIsCreating(false);
        setNewPollTitle("");
        setNewPollDescription("");
        setOptionsString("");
        setIsSubmittingPoll(false);
    };

    // Handler zum Absenden des neuen Polls
    const handleCreatePollSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!user || !newPollTitle.trim()) return;
        const validOptions = optionsString.split('\n').map(opt => opt.trim()).filter(opt => opt !== '');
        if (validOptions.length < 2) { toast.error("Mindestens zwei Optionen sind erforderlich."); return; }
        setIsSubmittingPoll(true);
        const toastId = 'create-poll-toast';
        toast.loading('Abstimmung wird erstellt...', { id: toastId });
        try {
            await axiosInstance.post<Poll>(`/api/Voting/create`, {
                title: newPollTitle,
                description: newPollDescription || null,
                options: validOptions
            });
            toast.success('Abstimmung erfolgreich erstellt!', { id: toastId });
            handleCancelCreate();
            fetchPolls('handleCreatePollSubmit');
        } catch (error) {
            console.error("Fehler beim Erstellen:", error);
            let errorMsg = "Fehler beim Erstellen der Abstimmung.";
            if (axiosStatic.isAxiosError(error)) {
                errorMsg = error.response?.data?.message || error.message || errorMsg;
                if (error.response?.data?.errors) {
                    const validationErrors = Object.values(error.response.data.errors).flat();
                    errorMsg = validationErrors.join(' \n');
                }
            }
            toast.error(errorMsg, { id: toastId });
        } finally {
            setIsSubmittingPoll(false);
        }
    };

    // Handler zum Öffnen des Löschdialogs
    const handleClickOpenDeleteDialog = (poll: Poll) => {
        setPollToDelete(poll);
        setOpenDeleteDialog(true);
    };

    // Handler zum Schließen des Löschdialogs
    const handleCloseDeleteDialog = () => {
        setOpenDeleteDialog(false);
        setTimeout(() => setPollToDelete(null), 300);
    };

    // Handler zum Bestätigen des Löschens
    const handleDeletePollConfirm = async () => {
        if (!pollToDelete) return;
        setIsDeleting(true);
        const toastId = `delete-poll-${pollToDelete.id}`;
        toast.loading('Abstimmung wird gelöscht...', { id: toastId });
        try {
            await axiosInstance.delete(`/api/Voting/${pollToDelete.id}`);
            toast.success('Abstimmung erfolgreich gelöscht!', { id: toastId });
            setPolls(prevPolls => prevPolls.filter(p => p.id !== pollToDelete.id));
        } catch (error) {
            console.error("Fehler beim Löschen:", error);
            let errorMsg = 'Fehler beim Löschen.';
            if (axiosStatic.isAxiosError(error)) { errorMsg = error.response?.data?.message || error.message || errorMsg; }
            toast.error(errorMsg, { id: toastId });
        } finally {
            setIsDeleting(false);
            handleCloseDeleteDialog();
        }
    };


    // --- Rendering Logic ---
    if (isLoading && polls.length === 0) {
        return ( <Box sx={{ display: 'flex' }}> <CssBaseline /> <PollsNavbar /> <Box component="main" sx={{ flexGrow: 1, p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}> <CircularProgress /> </Box> </Box> );
    }
    if (!user) {
        return ( <Box sx={{ display: 'flex' }}> <CssBaseline /> <PollsNavbar /> <Box component="main" sx={{ flexGrow: 1, p: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}> <Typography>Benutzerdaten werden geladen...</Typography> </Box> </Box> );
    }

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            <PollsNavbar />

            <Box component="main" sx={{ flexGrow: 1, bgcolor: theme.palette.grey[100], p: { xs: 1, sm: 2, md: 3 }, minHeight: '100vh' }}>
                {/* AppBar */}
                <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1, backgroundColor: 'white', color: theme.palette.text.primary, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <Toolbar>
                        <PollsIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}> Abstimmungen </Typography>
                        <Typography sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}> {user?.username} ({user?.role}) </Typography>
                        <Avatar src={user?.profileImageUrl || undefined} sx={{ bgcolor: theme.palette.primary.main }}> {user?.username?.charAt(0).toUpperCase()} </Avatar>
                    </Toolbar>
                </AppBar>
                <Toolbar />

                {/* Header Section */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, mt: 1, px: { xs: 1, sm: 0}, flexWrap: 'wrap', gap: 2 }}>
                    <Typography variant="h5" component="h1" sx={{ fontWeight: 'bold', flexGrow: 1 }}> Aktive Abstimmungen </Typography>
                    {user?.role === 'Admin' && !isCreating && ( <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setIsCreating(true)} sx={{ transition: 'box-shadow 0.3s ease-in-out', '&:hover': { boxShadow: theme.shadows[4] } }} > Neue Abstimmung </Button> )}
                </Box>

                {/* Create Poll Form */}
                {isCreating && ( // ✅ Korrekte Klammerung für bedingtes Rendering
                    <Paper elevation={4} sx={{ p: {xs: 1.5, sm: 2}, mb: 3, borderRadius: 2 }}>
                        <Typography variant="h6" sx={{ mb: 2 }}>Neue Abstimmung erstellen</Typography>
                        <Box component="form" onSubmit={handleCreatePollSubmit}>
                            <Stack spacing={2}>
                                <TextField label="Titel der Abstimmung" value={newPollTitle} onChange={(e) => setNewPollTitle(e.target.value)} fullWidth required autoFocus size="small" />
                                <TextField label="Beschreibung (Optional)" value={newPollDescription} onChange={(e) => setNewPollDescription(e.target.value)} fullWidth multiline rows={2} size="small" />
                                <Typography variant="subtitle1" sx={{ mb: -1, fontWeight:'medium' }}>Optionen:</Typography>
                                <TextField label="Optionen (eine pro Zeile)" value={optionsString} onChange={(e) => setOptionsString(e.target.value)} fullWidth required multiline rows={4} size="small" placeholder="Option 1&#10;Option 2&#10;Option 3..." helperText="Geben Sie jede Antwortmöglichkeit in eine neue Zeile ein." />
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, pt: 1 }}>
                                    <Button onClick={handleCancelCreate} color="inherit" size="small" disabled={isSubmittingPoll}>Abbrechen</Button>
                                    <LoadingButton type="submit" variant="contained" loading={isSubmittingPoll} size="small">Erstellen</LoadingButton>
                                </Box>
                            </Stack>
                        </Box>
                    </Paper>
                )}

                {/* Liste der Polls */}
                <Stack spacing={3} sx={{ maxWidth: '800px', mx: 'auto' }}>
                    {/* Ladeanzeige nur beim initialen Laden */}
                    {isLoading && polls.length === 0 && <LinearProgress sx={{ width: '100%', mb: 2 }} />}

                    {polls.length === 0 && !isLoading ? ( <Typography sx={{ textAlign: 'center', width: '100%', mt: 5 }} color="text.secondary"> Derzeit keine aktiven Abstimmungen vorhanden. </Typography> ) : (
                        // ✅ Korrigierte Struktur für das Mapping
                        polls.map((poll) => { // 'poll' ist hier korrekt definiert
                            // Logik zur Bestimmung des Zustands für den aktuellen User
                            const userCreatedThisPoll = poll.createdBy === user?.username;
                            const hasVoted = typeof poll.userVoteOptionId === 'number';
                            const canVote = !userCreatedThisPoll && !hasVoted;
                            const canDelete = user?.role === 'Admin';

                            // DEBUG: Logge die Werte VOR dem Rendern der Card
                            // console.log(`Rendering Poll ID: ${poll.id}, Title: ${poll.title}, userVoteOptionId: ${poll.userVoteOptionId}, hasVoted: ${hasVoted}, canVote: ${canVote}`);

                            return ( // ✅ Korrekte return-Anweisung
                                <Card key={poll.id} elevation={3} sx={{ borderRadius: 3, width: '100%', transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out', '&:hover': { transform: 'translateY(-4px)', boxShadow: theme.shadows[6] } }}>
                                    <CardHeader
                                        title={<Typography variant="h6" fontWeight="medium">{poll.title}</Typography>}
                                        subheader={`Erstellt von: ${poll.createdBy}`}
                                        action={ canDelete ? ( <IconButton aria-label="delete poll" onClick={() => handleClickOpenDeleteDialog(poll)} color="error" size="small" disabled={isDeleting && pollToDelete?.id === poll.id} > <DeleteIcon /> </IconButton> ) : null }
                                        sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}
                                    />
                                    <CardContent>
                                        {poll.description && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{poll.description}</Typography>}
                                        {/* ✅ Korrekte Ternary-Operator-Struktur */}
                                        {canVote ? (
                                            // Optionen zum Abstimmen anzeigen
                                            <FormControl component="fieldset" fullWidth disabled={votingPollId === poll.id}>
                                                <RadioGroup aria-label={`Abstimmung ${poll.id}`} name={`poll-${poll.id}`} value={selectedVote[poll.id] || ''} onChange={(e) => handleVoteChange(poll.id, e.target.value)} >
                                                    {poll.options.map(option => ( <FormControlLabel key={option.id} value={option.id} control={<Radio size="medium" icon={<RadioButtonUncheckedIcon />} checkedIcon={<RadioCheckedIcon />} />} label={option.text} sx={{ '& .MuiFormControlLabel-label': { flexGrow: 1 } }} /> ))}
                                                </RadioGroup>
                                            </FormControl>
                                        ) : (
                                            // Ergebnisse anzeigen
                                            <Stack spacing={1.5}>
                                                {poll.options.map(option => {
                                                    const percentage = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
                                                    const isUserVote = poll.userVoteOptionId === option.id;
                                                    return (
                                                        <Box key={option.id}>
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                                                <Typography variant="body1" sx={{ fontWeight: isUserVote ? 'bold' : 'normal' }}> {option.text} {isUserVote && <VotedIcon fontSize="small" color="success" sx={{ verticalAlign: 'text-bottom', ml: 0.5 }} />} </Typography>
                                                                <Typography variant="body2" color="text.secondary">{option.votes} ({percentage}%)</Typography>
                                                            </Box>
                                                            <LinearProgress variant="determinate" value={percentage} sx={{ height: 10, borderRadius: 2 }} color={isUserVote ? "success" : "primary"} />
                                                        </Box>
                                                    );
                                                })}
                                                {userCreatedThisPoll && <Typography variant="caption" color="text.disabled" sx={{mt: 1, display: 'block', textAlign: 'right' }}>Du hast diese Abstimmung erstellt.</Typography>}
                                                {hasVoted && !userCreatedThisPoll && <Typography variant="caption" color="text.disabled" sx={{mt: 1, display: 'block', textAlign: 'right'}}>Du hast bereits abgestimmt.</Typography>}
                                            </Stack>
                                        )}
                                    </CardContent>
                                    {/* ✅ Korrekte bedingte Anzeige für Button */}
                                    {canVote && (
                                        <CardActions sx={{ justifyContent: 'flex-end', p: 2, borderTop: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.grey[500], 0.05) }}>
                                            <LoadingButton variant="contained" size="medium" onClick={() => handleVoteSubmit(poll.id)} disabled={!selectedVote[poll.id]} loading={votingPollId === poll.id} > Abstimmen </LoadingButton>
                                        </CardActions>
                                    )}
                                </Card> // ✅ Korrektes Schließen der Card
                            ); // ✅ Korrektes Schließen des return
                        }) // ✅ Korrektes Schließen von .map()
                    )}
                </Stack> {/* Ende Poll List Stack */}

                {/* Lösch-Bestätigungsdialog */}
                <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog} aria-labelledby="alert-dialog-title" aria-describedby="alert-dialog-description" >
                    <DialogTitle id="alert-dialog-title">Abstimmung löschen?</DialogTitle>
                    <DialogContent> <DialogContentText id="alert-dialog-description"> Möchtest du die Abstimmung "{pollToDelete?.title}" wirklich endgültig löschen? Alle zugehörigen Stimmen gehen dabei verloren. </DialogContentText> </DialogContent>
                    <DialogActions> <Button onClick={handleCloseDeleteDialog} disabled={isDeleting}>Abbrechen</Button> <LoadingButton onClick={handleDeletePollConfirm} color="error" loading={isDeleting} autoFocus> Löschen </LoadingButton> </DialogActions>
                </Dialog>

            </Box> {/* Ende Main Content Box */}
        </Box> // Ende Root Box
    );
};

export default Polls;
