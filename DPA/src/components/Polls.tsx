import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axiosStatic from 'axios'; // Importiert für Typ-Prüfung (isAxiosError)
import axiosInstance from '../api/axiosInstance'; // Deine konfigurierte Instanz
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext'; // Stellt sicher, dass der Pfad korrekt ist
import type { User } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

import {
    Box, AppBar, Toolbar, Typography, CssBaseline, Card, CardContent, CardHeader, CardActions,
    Button, useTheme, CircularProgress, Avatar, Stack, alpha,
    RadioGroup, FormControlLabel, Radio, FormControl,
    LinearProgress,
    TextField,
    Paper,
    IconButton,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Skeleton,
    Chip as MuiChip,
    Tooltip
} from '@mui/material';
import { LoadingButton } from '@mui/lab';

import {
    HowToVote as PollsIcon,
    AddCircleOutlineRounded as AddIcon,
    CheckCircleRounded as VotedIcon,
    RadioButtonUncheckedRounded as RadioButtonUncheckedIcon,
    RadioButtonCheckedRounded as RadioCheckedIcon,
    DeleteForeverRounded as DeleteIcon,
    BarChartRounded as ResultsIcon,
    EditNoteRounded as CreateFormIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence, Variants } from 'framer-motion';

import PollsNavbar from './PollsNavbar';

// Interfaces (Behalten)
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

const Polls: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [polls, setPolls] = useState<Poll[]>([]);
    const [selectedVote, setSelectedVote] = useState<{ [pollId: number]: number }>({});
    const [votingPollId, setVotingPollId] = useState<number | null>(null);
    const [isCreating, setIsCreating] = useState<boolean>(false);
    const [newPollTitle, setNewPollTitle] = useState<string>("");
    const [newPollDescription, setNewPollDescription] = useState<string>("");
    const [optionsString, setOptionsString] = useState<string>("");
    const [isSubmittingPoll, setIsSubmittingPoll] = useState<boolean>(false);
    const [openDeleteDialog, setOpenDeleteDialog] = useState<boolean>(false);
    const [pollToDelete, setPollToDelete] = useState<Poll | null>(null);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);

    const { user } = useAuth();
    const theme = useTheme();
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();

    const fetchPolls = useCallback(async (source?: string) => {
        console.log(`WorkspacePolls aufgerufen von: ${source || 'useEffect'}`);
        if (source !== 'handleVoteSubmit - verify') {
            setIsLoading(true);
        }
        try {
            if (polls.length === 0 && source === 'useEffect' ) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            const response = await axiosInstance.get<Poll[]>(`/api/Voting`);
            console.log('fetchPolls - Empfangene Daten:', response.data);
            setPolls(response.data);
        } catch (error) {
            console.error("Fehler beim Laden der Abstimmungen:", error);
            let errorMsg = t("polls.toast.loadingPollsErrorGeneric");
            if (axiosStatic.isAxiosError(error)) {
                const backendMessage = error.response?.data?.message || error.message;
                if (backendMessage) console.warn("Backend error message (loading):", backendMessage);
            }
            if (!(error instanceof Error && error.message === "Session expired")) toast.error(errorMsg);
            setPolls([]);
        } finally {
            if (source !== 'handleVoteSubmit - verify') {
                setIsLoading(false);
            }
        }
    }, [t, polls.length]);

    useEffect(() => {
        if (user === undefined) return;
        if (user === null) { navigate('/login', { replace: true }); return; }
        fetchPolls('useEffect');
    }, [user, navigate, fetchPolls]);

    const handleVoteChange = (pollId: number, optionIdValue: string | number) => {
        const optionId = typeof optionIdValue === 'string' ? parseInt(optionIdValue, 10) : optionIdValue;
        if (!isNaN(optionId)) setSelectedVote(prev => ({ ...prev, [pollId]: optionId }));
    };

    const handleVoteSubmit = async (pollId: number) => {
        const optionId = selectedVote[pollId];
        if (!user) { toast.error(t("common.userDataNotLoadedToast")); return; }
        if (!optionId) { toast.error(t("polls.toast.votingErrorNoOption")); return; }
        setVotingPollId(pollId);
        const toastId = `voting-toast-${pollId}`;
        toast.loading(t('polls.toast.votingLoading'), { id: toastId });
        const originalPolls = JSON.parse(JSON.stringify(polls));
        const updatedPolls = polls.map(p => {
            if (p.id === pollId) {
                const prevUserVoteOptionId = p.userVoteOptionId;
                const userHadPreviouslyVoted = typeof prevUserVoteOptionId === 'number';
                return {
                    ...p, userVoteOptionId: optionId,
                    totalVotes: p.totalVotes + (userHadPreviouslyVoted ? 0 : 1),
                    options: p.options.map((opt: PollOption) => {
                        let votes = opt.votes;
                        if (opt.id === optionId) votes += 1;
                        else if (userHadPreviouslyVoted && opt.id === prevUserVoteOptionId) votes -= 1;
                        return { ...opt, votes: Math.max(0, votes) };
                    }),
                };
            }
            return p;
        });
        setPolls(updatedPolls);
        setSelectedVote(prev => { const newState = { ...prev }; delete newState[pollId]; return newState; });
        try {
            await axiosInstance.post(`/api/Voting/vote/${pollId}`, { optionId });
            toast.success(t('polls.toast.votingSuccess'), { id: toastId });
        } catch (error) {
            console.error("Fehler beim Abstimmen (Backend):", error);
            let errorMsg = t('polls.toast.votingErrorGeneric');
            if (axiosStatic.isAxiosError(error)) {
                const backendMessage = error.response?.data?.message || error.message;
                if (backendMessage) console.warn("Backend error message (voting):", backendMessage);
            }
            toast.error(errorMsg, { id: toastId });
            console.log("Rollback optimistic update for poll ID:", pollId);
            setPolls(originalPolls);
        } finally { setVotingPollId(null); }
    };

    const handleCancelCreate = () => {
        setIsCreating(false); setNewPollTitle(""); setNewPollDescription(""); setOptionsString(""); setIsSubmittingPoll(false);
    };

    const handleCreatePollSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!user) { toast.error(t("common.userDataNotLoadedToast")); return; }
        if (!newPollTitle.trim()) { toast.error(t("polls.toast.createPollErrorTitleMissing")); return; }
        const validOptions = optionsString.split('\n').map(opt => opt.trim()).filter(opt => opt !== '');
        if (validOptions.length < 2) { toast.error(t("polls.toast.createPollOptionsMinError")); return; }
        setIsSubmittingPoll(true);
        const toastId = 'create-poll-toast';
        toast.loading(t('polls.toast.createPollLoading'), { id: toastId });
        try {
            await axiosInstance.post<Poll>(`/api/Voting/create`, { title: newPollTitle, description: newPollDescription || null, options: validOptions });
            toast.success(t('polls.toast.createPollSuccess'), { id: toastId });
            handleCancelCreate(); fetchPolls('handleCreatePollSubmit');
        } catch (error) {
            console.error("Fehler beim Erstellen:", error);
            let errorMsg = t("polls.toast.createPollErrorGeneric");
            if (axiosStatic.isAxiosError(error)) {
                const backendMessage = error.response?.data?.message || error.message;
                if (backendMessage) {
                    console.warn("Backend error message (create poll):", backendMessage);
                    if (error.response?.data?.errors) {
                        const validationErrors = Object.values(error.response.data.errors).flat().join(' \n');
                        errorMsg = `${errorMsg}\n${validationErrors}`;
                    }
                }
            }
            toast.error(errorMsg, { id: toastId });
        } finally { setIsSubmittingPoll(false); }
    };

    const handleClickOpenDeleteDialog = (poll: Poll) => { setPollToDelete(poll); setOpenDeleteDialog(true); };
    const handleCloseDeleteDialog = () => { setOpenDeleteDialog(false); setTimeout(() => setPollToDelete(null), 300); };
    const handleDeletePollConfirm = async () => {
        if (!pollToDelete) return;
        setIsDeleting(true);
        const toastId = `delete-poll-${pollToDelete.id}`;
        toast.loading(t('polls.toast.deletePollLoading'), { id: toastId });
        try {
            await axiosInstance.delete(`/api/Voting/${pollToDelete.id}`);
            toast.success(t('polls.toast.deletePollSuccess'), { id: toastId });
            setPolls(prevPolls => prevPolls.filter(p => p.id !== pollToDelete?.id));
        } catch (error) {
            console.error("Fehler beim Löschen:", error);
            let errorMsg = t('polls.toast.deletePollErrorGeneric');
            if (axiosStatic.isAxiosError(error)) {
                const backendMessage = error.response?.data?.message || error.message;
                if (backendMessage) console.warn("Backend error message (delete poll):", backendMessage);
            }
            toast.error(errorMsg, { id: toastId });
        } finally { setIsDeleting(false); handleCloseDeleteDialog(); }
    };

    const pageContainerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.5, ease: "easeInOut" } }
    };
    const listContainerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.2 } }
    };
    const listItemVariants: Variants = {
        hidden: { opacity: 0, y: 40, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, type: "spring", stiffness: 100, damping: 18 } },
        exit: { opacity: 0, y: -20, scale: 0.98, transition: { duration: 0.3, ease: "easeOut" } }
    };
    const formVariants: Variants = {
        hidden: { opacity: 0, y: -30, height: 0, marginBottom: 0, scaleY: 0.9 },
        visible: { opacity: 1, y: 0, height: 'auto', scaleY: 1, marginBottom: theme.spacing(4), transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1], } },
        exit: { opacity: 0, y: -20, height: 0, scaleY: 0.9, marginBottom: 0, transition: { duration: 0.35, ease: [0.76, 0, 0.24, 1] } }
    };

    const renderPollSkeletons = (count = 2) => (
        <Stack spacing={3.5} sx={{ maxWidth: '850px', mx: 'auto', width: '100%' }}>
            {[...Array(count)].map((_, index) => (
                <Paper key={`skel-poll-${index}`} elevation={0} sx={{
                    borderRadius: 4, p: 0, overflow: 'hidden',
                    border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                    background: alpha(theme.palette.background.paper, 0.7),
                }}>
                    <Box sx={{ p: 2.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.15)}` }}>
                        <Skeleton variant="text" width="70%" height={30} sx={{mb: 0.5}}/>
                        <Skeleton variant="text" width="40%" height={22}/>
                    </Box>
                    <Box sx={{ p: 2.5 }}>
                        <Skeleton variant="text" width="90%" height={20} sx={{ mb: 3 }}/>
                        <Stack spacing={2.5}>
                            {[...Array(3)].map(s_idx =>
                                <Box key={s_idx}>
                                    <Skeleton variant="text" width="100%" height={24}/>
                                    <Skeleton variant="rounded" width="100%" height={10} sx={{mt: 0.5, borderRadius: 1}}/>
                                </Box>
                            )}
                        </Stack>
                    </Box>
                    <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end', borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`, bgcolor: alpha(theme.palette.action.hover, 0.2) }}>
                        <Skeleton variant="rounded" width={120} height={40} sx={{borderRadius: 2}}/>
                    </Box>
                </Paper>
            ))}
        </Stack>
    );

    if (user === undefined) {
        return <Box sx={{ display: 'flex', height: '100vh', width: '100%', justifyContent: 'center', alignItems: 'center', bgcolor: theme.palette.background.default }}><CircularProgress size={40} /></Box>;
    }
    if (user === null) return null;

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            <AppBar position="fixed" sx={{
                width: '100%', zIndex: theme.zIndex.drawer + 1,
                bgcolor: alpha(theme.palette.background.paper, 0.9), backdropFilter: 'blur(12px)',
                color: 'text.primary', boxShadow: `0px 2px 8px -1px ${alpha(theme.palette.common.black, 0.07)}`,
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.15)}`
            }}>
                <Toolbar>
                    <PollsIcon sx={{ mr: 1.5, color: 'primary.main', fontSize: '1.8rem' }} />
                    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 600 }}>{t('polls.appBarTitle')}</Typography>
                    {user && (<>
                        {/* HIER IST DIE ÄNDERUNG: component="div" hinzugefügt */}
                        <Typography component="div" sx={{ mr: 2, display: { xs: 'none', sm: 'block' }, color: 'text.secondary' }}>
                            {user.username} <MuiChip label={user.role} size="small" variant="outlined" sx={{ml: 0.5, opacity: 0.8}} />
                        </Typography>
                        <Avatar src={user.profileImageUrl || undefined} sx={{ bgcolor: theme.palette.primary.main, width: 36, height: 36, fontSize: '0.9rem' }}>{user.username?.charAt(0).toUpperCase()}</Avatar>
                    </>)}
                </Toolbar>
            </AppBar>

            <PollsNavbar />

            <Box component={motion.main} variants={pageContainerVariants} initial="hidden" animate="visible" sx={{
                flexGrow: 1,
                bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.background.default,
                p: { xs: 2, sm: 3, md: 4 },
                minHeight: '100vh',
            }}>
                <Toolbar />
                <Box sx={{ display: 'flex', alignItems: 'center', mb: {xs: 3, sm: 3.5}, mt: 1.5, px: { xs: 0, sm: 1}, flexWrap: 'wrap', gap: 2 }}>
                    <Typography variant="h4" component="h1" sx={{ fontWeight: 700, flexGrow: 1, color: 'text.primary' }}>{t('polls.pageTitle')}</Typography>
                    {user?.role === 'Admin' && !isCreating && (
                        <Button variant="contained" size="medium" startIcon={<AddIcon />} onClick={() => setIsCreating(true)}
                                sx={{ borderRadius: 2, px: 2.5, py: 1, boxShadow: theme.shadows[2], '&:hover': { boxShadow: theme.shadows[5], transform: 'translateY(-1px)' }, transition: 'all 0.2s ease-in-out' }} >
                            {t('polls.createButton')}
                        </Button>
                    )}
                </Box>

                <AnimatePresence mode="wait">
                    {isCreating && (
                        <motion.div key="create-poll-form" variants={formVariants} initial="hidden" animate="visible" exit="exit">
                            <Paper elevation={0} sx={{
                                p: { xs: 2, sm: 3, md: 3.5 }, borderRadius: 4,
                                border: `1px solid ${alpha(theme.palette.divider, 0.25)}`,
                                background: alpha(theme.palette.background.paper, 0.95),
                                backdropFilter: theme.palette.mode === 'dark' ? 'blur(3px)' : 'none'
                            }}>
                                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
                                    <Avatar sx={{bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', width: 40, height: 40}}> <CreateFormIcon /> </Avatar>
                                    <Typography variant="h5" sx={{ fontWeight: 600, color: 'text.primary' }}>{t('polls.createFormTitle')}</Typography>
                                </Stack>
                                <Box component="form" onSubmit={handleCreatePollSubmit}>
                                    <Stack spacing={3}>
                                        <TextField label={t('polls.createFormTitleLabel')} value={newPollTitle} onChange={(e) => setNewPollTitle(e.target.value)} fullWidth required autoFocus
                                                   variant="outlined" InputProps={{ sx: { borderRadius: 2 } }} />
                                        <TextField label={t('polls.createFormDescriptionLabel')} value={newPollDescription} onChange={(e) => setNewPollDescription(e.target.value)} fullWidth multiline rows={2}
                                                   variant="outlined" InputProps={{ sx: { borderRadius: 2 } }} />
                                        <TextField label={t('polls.createFormOptionsLabel')} value={optionsString} onChange={(e) => setOptionsString(e.target.value)} fullWidth required multiline rows={4}
                                                   placeholder={t('polls.createFormOptionsPlaceholder')} helperText={t('polls.createFormOptionsHelperText')}
                                                   variant="outlined" InputProps={{ sx: { borderRadius: 2 } }} />
                                        <Stack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ pt: 1 }}>
                                            <Button onClick={handleCancelCreate} color="inherit" variant="text" disabled={isSubmittingPoll} sx={{borderRadius: 2, px: 2}}>{t('common.cancelButton')}</Button>
                                            <LoadingButton type="submit" variant="contained" loading={isSubmittingPoll} size="medium" sx={{borderRadius: 2, px: 3}}>{t('polls.createSubmitButton')}</LoadingButton>
                                        </Stack>
                                    </Stack>
                                </Box>
                            </Paper>
                        </motion.div>
                    )}
                </AnimatePresence>

                <Box sx={{ maxWidth: '850px', mx: 'auto', width: '100%' }}>
                    <AnimatePresence mode="wait">
                        {isLoading && polls.length === 0 ? (
                            <motion.div key="skeleton-polls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                                {renderPollSkeletons()}
                            </motion.div>
                        ) : (
                            <motion.div key="content-polls" initial="hidden" animate="visible" exit={{ opacity: 0 }} variants={listContainerVariants}>
                                {polls.length === 0 && !isLoading ? (
                                    <Paper elevation={0} sx={{ p: {xs:3, sm:5}, textAlign: 'center', background: 'transparent', borderRadius: 4, mt: 3 }}>
                                        <ResultsIcon sx={{fontSize: 60, color: alpha(theme.palette.text.secondary, 0.4), mb: 2}}/>
                                        <Typography variant="h6" color="text.secondary" sx={{fontWeight: 500}}>{t('polls.noActivePolls')}</Typography>
                                        <Typography variant="body2" color="text.disabled">{t('polls.noActivePollsHint')}</Typography>
                                    </Paper>
                                ) : (
                                    <Stack spacing={3.5} component={motion.div} variants={listContainerVariants}>
                                        {polls.map((poll) => {
                                            const userCreatedThisPoll = poll.createdBy === user?.username;
                                            const hasVoted = typeof poll.userVoteOptionId === 'number';
                                            const canVote = !userCreatedThisPoll && !hasVoted;
                                            const canDelete = user?.role === 'Admin';

                                            return (
                                                <motion.div key={poll.id} variants={listItemVariants}>
                                                    <Card elevation={0} sx={{
                                                        borderRadius: 4, width: '100%', overflow: 'hidden',
                                                        border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                                                        background: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.85 : 0.98),
                                                        backdropFilter: theme.palette.mode === 'dark' ? 'blur(4px)' : 'none',
                                                        transition: 'transform 0.25s ease-out, box-shadow 0.25s ease-out, border-color 0.25s ease-out',
                                                        '&:hover': { transform: 'translateY(-5px) scale(1.005)', boxShadow: theme.shadows[7], borderColor: alpha(theme.palette.primary.main, 0.4) }
                                                    }}>
                                                        <CardHeader
                                                            title={<Typography variant="h6" fontWeight={600} sx={{color: 'text.primary', lineHeight: 1.4}}>{poll.title}</Typography>}
                                                            subheader={<Typography variant="caption" sx={{color: 'text.secondary'}}> {t('polls.createdByPrefix', { creator: poll.createdBy ?? 'Unbekannt' })} • {t('polls.totalVotes', {count: poll.totalVotes})}</Typography>}
                                                            action={ canDelete ? (
                                                                <Tooltip title={t('polls.deleteButtonAriaLabel')}>
                                                                    <IconButton onClick={() => handleClickOpenDeleteDialog(poll)} color="inherit" size="medium" disabled={isDeleting && pollToDelete?.id === poll.id}
                                                                                sx={{ color: alpha(theme.palette.text.secondary, 0.7), '&:hover': { color: theme.palette.error.main, background: alpha(theme.palette.error.main, 0.08) } }}>
                                                                        <DeleteIcon />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            ) : null }
                                                            sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.15)}`, alignItems: 'flex-start', p: 2.5 }}
                                                        />
                                                        <CardContent sx={{ pt: 2.5, pb: canVote ? 1.5 : 3 }}>
                                                            {poll.description && ( <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>{poll.description}</Typography> )}
                                                            {canVote ? (
                                                                <FormControl component="fieldset" fullWidth disabled={votingPollId === poll.id}>
                                                                    <RadioGroup aria-label={t('polls.voteAriaLabel', { pollId: poll.id })} name={`poll-${poll.id}`} value={selectedVote[poll.id] || ''} onChange={(e) => handleVoteChange(poll.id, e.target.value)}>
                                                                        {poll.options.map((option: PollOption) => (
                                                                            <FormControlLabel key={option.id} value={option.id}
                                                                                              control={<Radio size="medium" icon={<RadioButtonUncheckedIcon />} checkedIcon={<RadioCheckedIcon color="primary"/>} sx={{p: 1.2}}/>}
                                                                                              label={<Typography variant="body1" sx={{fontWeight: selectedVote[poll.id] === option.id ? 500 : 400}}>{option.text}</Typography>}
                                                                                              sx={{ p: 0.8, borderRadius: 2, mb: 0.5, '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.4) }, transition: 'background-color 0.2s' }} />
                                                                        ))}
                                                                    </RadioGroup>
                                                                </FormControl>
                                                            ) : (
                                                                <Stack spacing={2.5}>
                                                                    {poll.options.map((option: PollOption) => {
                                                                        const percentage = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
                                                                        const isUserVote = poll.userVoteOptionId === option.id;
                                                                        return (
                                                                            <Box key={option.id}>
                                                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
                                                                                    <Typography variant="body1" sx={{ fontWeight: isUserVote ? 600 : 500, color: isUserVote ? theme.palette.primary.main : 'text.primary' }}>
                                                                                        {option.text}
                                                                                        {isUserVote && <VotedIcon fontSize="inherit" color="inherit" sx={{ verticalAlign: 'middle', ml: 0.7, transform: 'translateY(-1px)'}} />}
                                                                                    </Typography>
                                                                                    <Typography variant="body2" sx={{ color: isUserVote ? theme.palette.primary.main : 'text.secondary', fontWeight: isUserVote ? 500 : 400 }}>{option.votes} ({percentage}%)</Typography>
                                                                                </Box>
                                                                                <LinearProgress variant="determinate" value={percentage} color={isUserVote ? "primary" : "inherit"}
                                                                                                sx={{ height: 10, borderRadius: 2, bgcolor: alpha(theme.palette.grey[500], 0.18), '& .MuiLinearProgress-bar': { borderRadius: 2, transition: 'transform .4s linear' } }} />
                                                                            </Box>
                                                                        );
                                                                    })}
                                                                    {userCreatedThisPoll && <Typography variant="caption" color="text.disabled" sx={{mt: 1.5, display: 'block', textAlign: 'right' }}>{t('polls.youCreatedThis')}</Typography>}
                                                                    {hasVoted && !userCreatedThisPoll && <Typography variant="caption" color="text.disabled" sx={{mt: 1.5, display: 'block', textAlign: 'right'}}>{t('polls.youAlreadyVoted')}</Typography>}
                                                                </Stack>
                                                            )}
                                                        </CardContent>
                                                        {canVote && (
                                                            <CardActions sx={{ justifyContent: 'flex-end', p: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`, bgcolor: alpha(theme.palette.action.hover, 0.2) }}>
                                                                <LoadingButton variant="contained" size="medium" onClick={() => handleVoteSubmit(poll.id)}
                                                                               disabled={!selectedVote[poll.id] || votingPollId === poll.id} loading={votingPollId === poll.id}
                                                                               sx={{borderRadius: 2, px: 3, py: 1, fontWeight: 600}}>
                                                                    {t('polls.voteButton')}
                                                                </LoadingButton>
                                                            </CardActions>
                                                        )}
                                                    </Card>
                                                </motion.div>
                                            );
                                        })}
                                    </Stack>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Box>

                <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog} PaperProps={{ sx: { borderRadius: 3.5, p:1, boxShadow: theme.shadows[5] } }} maxWidth="xs">
                    <DialogTitle sx={{ fontWeight: 600, fontSize: '1.3rem', borderBottom: `1px solid ${alpha(theme.palette.divider, 0.15)}`, pb:1.5 }}>{t('polls.deleteDialogTitle')}</DialogTitle>
                    <DialogContent sx={{pt: 2.5}}>
                        <DialogContentText sx={{color: 'text.secondary', lineHeight: 1.6}}>
                            {t('polls.deleteDialogContent', { pollTitle: pollToDelete?.title ?? 'dieser Abstimmung' })}
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions sx={{ p: 2, pt: 1.5 }}>
                        <Button onClick={handleCloseDeleteDialog} disabled={isDeleting} variant="text" sx={{borderRadius: 2, px:1.5, color: 'text.secondary'}}>{t('common.cancelButton')}</Button>
                        <LoadingButton onClick={handleDeletePollConfirm} color="error" variant="contained" loading={isDeleting} autoFocus sx={{borderRadius: 2, px:2}}>{t('common.deleteButton')}</LoadingButton>
                    </DialogActions>
                </Dialog>
            </Box>
        </Box>
    );
};

export default Polls;