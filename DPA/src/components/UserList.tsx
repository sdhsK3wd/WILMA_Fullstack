import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from '../api/axiosInstance';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { AxiosError } from 'axios';
import API_BASE_URL from '../apiConfig';
import { useTranslation } from 'react-i18next'; // useTranslation importieren

import {
    Box, AppBar, Toolbar, Typography, CssBaseline, Paper,
    Button, useTheme, CircularProgress, Avatar,
    Stack, alpha,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    IconButton, Chip,
    Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Tooltip,
    Skeleton,
    TextField,
    InputAdornment,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    TableSortLabel,
    Divider,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';

import {
    ListAlt as ListAltIcon,
    Delete as DeleteIcon,
    Search as SearchIcon,
    FilterList as FilterListIcon
} from '@mui/icons-material';
import { visuallyHidden } from '@mui/utils';
import { motion, AnimatePresence } from 'framer-motion';

import defaultProfileImage from '/Default.png';

import UserManagementNavbar from './UserManagementNavbar';

// Interface für Benutzer (Beibehalten)
interface User { id: number; username: string; email: string; role: string; profileImageUrl?: string; }
type Order = 'asc' | 'desc';
type UserSortableKey = 'username' | 'email' | 'role';


const UserList: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [openDeleteDialog, setOpenDeleteDialog] = useState<boolean>(false);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'User' | 'Admin'>('all');
    const [orderBy, setOrderBy] = useState<UserSortableKey>('username');
    const [order, setOrder] = useState<Order>('asc');
    const [rowsPerPage, setRowsPerPage] = useState(15);


    const location = useLocation();
    const { user: loggedInUser, isAdmin } = useAuth();
    const theme = useTheme();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();


    const fetchUsers = useCallback(async () => { // <-- useCallback behalten, fetchUsers wird in useEffect genutzt
        // Warte bis User-Status geladen ist
        if (loggedInUser === undefined) {
            setIsLoading(true);
            return;
        }
        // Nur Admins dürfen die Liste sehen (Umleitung in Navbar/globalem Handler)
        if (!isAdmin) {
            setIsLoading(false); // Laden beenden
            return;
        }

        setIsLoading(true);
        // Kleine Verzögerung für Skeleton-Effekt nur, wenn nicht schon User da sind
        if (users.length === 0) { // Oder eine bessere Bedingung für initiales Laden
            await new Promise(resolve => setTimeout(resolve, 400));
        }

        try {
            const res = await axios.get<User[]>(`${API_BASE_URL}/users/all`);
            setUsers(res.data);
        } catch (error) {
            console.error("Fehler beim Laden der Benutzer:", error);
            const err = error as AxiosError<{ message?: string }>;
            toast.error(err.response?.data?.message || t("userList.toast.loadUsersError"));
            setUsers([]); // Liste bei Fehler leeren
        } finally {
            setIsLoading(false);
        }
    }, [loggedInUser, isAdmin, t, users.length]); // Abhängigkeiten von useCallback


    useEffect(() => {
        // Lade User nur, wenn loggedInUser geladen ist UND Admin ist
        if (loggedInUser && isAdmin) { // Prüft auf geladen (nicht null/undefined) und Admin
            fetchUsers(); // <-- fetchUsers ist jetzt stabil dank useCallback
        } else if (loggedInUser !== undefined && !isAdmin) {
            // User ist geladen, aber kein Admin -> wird umgeleitet
            setUsers([]); // Liste leeren
            setIsLoading(false);
        }
        // Wenn loggedInUser null ist, wird der useEffect in der Navbar/globalen Ebene sich darum kümmern
    }, [loggedInUser, isAdmin, fetchUsers]); // fetchUsers als Abhängigkeit


    const handleDeleteClick = (user: User) => {
        setUserToDelete(user);
        setOpenDeleteDialog(true);
    };

    const handleCloseDeleteDialog = () => {
        setOpenDeleteDialog(false);
        setTimeout(() => setUserToDelete(null), 300);
    };

    const handleConfirmDelete = async () => {
        if (!userToDelete) { return; }
        if (!isAdmin || userToDelete.role === "Admin" || loggedInUser?.id === userToDelete.id) {
            toast.error(t("userList.toast.actionNotAllowed"));
            handleCloseDeleteDialog();
            return;
        }

        setIsDeleting(true);
        const toastId = toast.loading(t("userList.toast.deleteLoading"));

        try {
            await axios.delete(`${API_BASE_URL}/users/${userToDelete.id}`);
            setUsers(users.filter(user => user.id !== userToDelete.id));
            toast.success(t("userList.toast.deleteSuccess", { username: userToDelete.username }), { id: toastId });
        } catch (error) {
            console.error("Fehler beim Löschen:", error);
            const err = error as AxiosError<{ message?: string }>;
            toast.error(err.response?.data?.message || t("userList.toast.deleteErrorGeneric"), { id: toastId });
        } finally {
            setIsDeleting(false);
            handleCloseDeleteDialog();
        }
    };

    const handleRequestSort = (property: UserSortableKey) => {
        const isAsc = orderBy === property && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(property);
    };

    const filteredAndSortedUsers = useMemo(() => {
        let filtered = [...users];
        if (roleFilter !== 'all') {
            filtered = filtered.filter(user => user.role === roleFilter);
        }
        if (searchQuery) {
            const lowerCaseQuery = searchQuery.toLowerCase();
            filtered = filtered.filter(user =>
                user.username.toLowerCase().includes(lowerCaseQuery) ||
                user.email.toLowerCase().includes(lowerCaseQuery)
            );
        }
        filtered.sort((a, b) => {
            const valueA = a[orderBy] || '';
            const valueB = b[orderBy] || '';

            if (orderBy === 'role') {
                // KORRIGIERT: Sicherere Rollen-Sortierung
                const roleSortOrder: Record<string, number> = { 'Admin': 1, 'User': 2, '': 3 };
                const fallbackOrder = 4;

                const roleA = valueA as string; // Wert als String betrachten
                const roleB = valueB as string; // Wert als String betrachten

                const orderValueA = roleSortOrder[roleA] ?? fallbackOrder;
                const orderValueB = roleSortOrder[roleB] ?? fallbackOrder;

                const orderResult = orderValueA - orderValueB;
                return order === 'asc' ? orderResult : -orderResult;

            } else if (typeof valueA === 'string' && typeof valueB === 'string') {
                return valueA.localeCompare(valueB, i18n.language) * (order === 'asc' ? 1 : -1);
            }
            if (valueA < valueB) { return order === 'asc' ? -1 : 1; }
            if (valueA > valueB) { return order === 'asc' ? 1 : -1; }
            return 0;
        });
        return filtered;
    }, [users, searchQuery, roleFilter, order, orderBy, i18n.language]);

    const tableBodyVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.4 } },
        exit: { opacity: 0, transition: { duration: 0.2 } }
    };

    const renderSkeletons = (count = 10) => (
        [...Array(count)].map((_, index) => (
            <TableRow key={`skel-${index}`} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                <TableCell align="center" sx={{ py: 1.5 }}> <Skeleton variant="circular" width={40} height={40} /> </TableCell>
                <TableCell component="th" scope="row" sx={{ py: 1.5 }}> <Skeleton variant="text" width="80%" /> </TableCell>
                <TableCell sx={{ py: 1.5 }}> <Skeleton variant="text" width="90%" /> </TableCell>
                <TableCell align="center" sx={{ py: 1.5 }}> <Skeleton variant="rounded" width={60} height={22} /> </TableCell>
                <TableCell align="center" sx={{ py: 1.5 }}> <Skeleton variant="circular" width={32} height={32} /> </TableCell>
            </TableRow>
        ))
    );
    const MotionTableBody = motion(TableBody);

    if (loggedInUser === undefined) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            <UserManagementNavbar />

            <Box component="main" sx={{ flexGrow: 1, bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.background.default, p: { xs: 1, sm: 2, md: 3 }, minHeight: '100vh' }}>
                <AppBar position="fixed" sx={{ width: '100%', zIndex: theme.zIndex.drawer + 1, bgcolor: alpha(theme.palette.background.paper, 0.8), backdropFilter: 'blur(8px)', color: theme.palette.text.primary, boxShadow: theme.shadows[1], borderBottom: `1px solid ${theme.palette.divider}` }} >
                    <Toolbar>
                        <ListAltIcon sx={{ mr: 1.5, color: 'primary.main' }} />
                        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}> {t('userList.appBarTitle')} </Typography>
                        <Typography sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>{loggedInUser?.username} ({loggedInUser?.role})</Typography>
                        <Avatar src={loggedInUser?.profileImageUrl || undefined} sx={{ bgcolor: theme.palette.primary.main }}>{loggedInUser?.username?.charAt(0).toUpperCase()}</Avatar>
                    </Toolbar>
                </AppBar>
                <Toolbar />

                <Paper elevation={0} variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.5) }}>
                    {isLoading && users.length === 0 ? (
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Skeleton variant="rounded" height={40} sx={{ flexGrow: 1 }} />
                            <Skeleton variant="rounded" height={40} width={150} />
                        </Stack>
                    ) : (
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                            <TextField
                                fullWidth
                                size="small"
                                placeholder={t('userList.filter.searchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                InputProps={{
                                    startAdornment: ( <InputAdornment position="start"> <SearchIcon color="action" /> </InputAdornment> ),
                                }}
                                variant="outlined"
                            />
                            <FormControl size="small" sx={{ minWidth: 180, width: { xs: '100%', sm: 'auto' } }}>
                                <InputLabel id="role-filter-label">{t('userList.filter.roleLabel')}</InputLabel>
                                <Select
                                    labelId="role-filter-label"
                                    value={roleFilter}
                                    label={t('userList.filter.roleLabel')}
                                    onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                                    startAdornment={<InputAdornment position="start"><FilterListIcon color="action" /></InputAdornment>}
                                >
                                    <MenuItem value="all">{t('userList.filter.allRoles')}</MenuItem>
                                    <MenuItem value="Admin">{t('userList.filter.onlyAdmins')}</MenuItem>
                                    <MenuItem value="User">{t('userList.filter.onlyUsers')}</MenuItem>
                                </Select>
                            </FormControl>
                        </Stack>
                    )}
                </Paper>

                <Paper elevation={0} variant="outlined" sx={{ width: '100%', overflow: 'hidden', borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.5) }}>
                    <TableContainer sx={{ maxHeight: 'calc(100vh - 64px - 48px - 56px - 24px)' }}>
                        <Table stickyHeader aria-label={t('userList.table.ariaLabel')}>
                            <TableHead>
                                <TableRow sx={{ '& th': { backgroundColor: 'background.paper', fontWeight: 'bold', borderBottom: `1px solid ${theme.palette.divider}` } }} >
                                    <TableCell align="center" sx={{ width: '10%', py: 1 }}>{t('userList.table.header.profilePicture')}</TableCell>
                                    <TableCell sortDirection={orderBy === 'username' ? order : false} sx={{ py: 1 }}>
                                        <TableSortLabel active={orderBy === 'username'} direction={orderBy === 'username' ? order : 'asc'} onClick={() => handleRequestSort('username')} >
                                            {t('userList.table.header.username')}
                                            {orderBy === 'username' ? ( <Box component="span" sx={visuallyHidden}> {order === 'desc' ? t('userList.table.sortLabel.sortedDescending') : t('userList.table.sortLabel.sortedAscending')} </Box> ) : null}
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sortDirection={orderBy === 'email' ? order : false} sx={{ py: 1 }}>
                                        <TableSortLabel active={orderBy === 'email'} direction={orderBy === 'email' ? order : 'asc'} onClick={() => handleRequestSort('email')} >
                                            {t('userList.table.header.email')}
                                            {orderBy === 'email' ? ( <Box component="span" sx={visuallyHidden}> {order === 'desc' ? t('userList.table.sortLabel.sortedDescending') : t('userList.table.sortLabel.sortedAscending')} </Box> ) : null}
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell align="center" sx={{ py: 1 }}>{t('userList.table.header.role')}</TableCell>
                                    <TableCell align="center" sx={{ py: 1 }}>{t('userList.table.header.actions')}</TableCell>
                                </TableRow>
                            </TableHead>
                            {/* KORRIGIERT: AnimatePresence um den Body */}
                            <AnimatePresence mode="wait" initial={false}>
                                {isLoading && users.length > 0 ? (
                                    <MotionTableBody key="loading" variants={tableBodyVariants} initial="hidden" animate="visible" exit="exit">
                                        {renderSkeletons(rowsPerPage)}
                                    </MotionTableBody>
                                ) : filteredAndSortedUsers.length === 0 ? (
                                    <MotionTableBody key="empty" variants={tableBodyVariants} initial="hidden" animate="visible" exit="exit">
                                        <TableRow>
                                            <TableCell colSpan={5} align="center" sx={{ py: 6, border: 0 }}>
                                                <Typography color="text.secondary">
                                                    {searchQuery || roleFilter !== 'all'
                                                        ? t('userList.empty.noCriteriaMatch')
                                                        : t('userList.empty.noUsersFound')}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    </MotionTableBody>
                                ) : (
                                    <MotionTableBody key="users" variants={tableBodyVariants} initial="hidden" animate="visible" exit="exit">
                                        {filteredAndSortedUsers.map((user) => (
                                            <TableRow key={user.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }} >
                                                <TableCell align="center" sx={{ py: 1.5 }}>
                                                    <Avatar alt={user.username} src={user.profileImageUrl || defaultProfileImage} sx={{ width: 40, height: 40, margin: 'auto' }} />
                                                </TableCell>
                                                <TableCell component="th" scope="row" sx={{ py: 1.5 }}> {user.username} </TableCell>
                                                <TableCell sx={{ py: 1.5 }}>{user.email}</TableCell>
                                                <TableCell align="center" sx={{ py: 1.5 }}>
                                                    {user.role === "Admin" ? ( <Chip label={t('role.Admin')} color="primary" size="small" variant="filled" /> ) : ( <Chip label={t('role.User')} color="default" size="small" variant="outlined" /> )}
                                                </TableCell>
                                                <TableCell align="center" sx={{ py: 1.5 }}>
                                                    {(isAdmin && user.role !== "Admin" && loggedInUser?.id !== user.id) ? (
                                                        <Tooltip title={t('userList.table.actions.deleteTooltip', { username: user.username })}>
                                                            <IconButton aria-label={t('common.deleteButton')} color="error" size="small" onClick={() => handleDeleteClick(user)} disabled={isDeleting && userToDelete?.id === user.id}>
                                                                <DeleteIcon fontSize="small"/>
                                                            </IconButton>
                                                        </Tooltip>
                                                    ) : (
                                                        <Typography variant="caption" color="text.disabled">{t('userList.table.actions.notAllowed')}</Typography>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </MotionTableBody>
                                )}
                            </AnimatePresence>
                        </Table>
                    </TableContainer>
                    {/* Paginierung ist in diesem Codeblock nicht implementiert */}
                </Paper>


                {/* Lösch-Bestätigungsdialog */}
                <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog} aria-labelledby="alert-dialog-title" aria-describedby="alert-dialog-description" PaperProps={{ sx: { borderRadius: 3 } }}>
                    {/* Dialog Titel übersetzen */}
                    <DialogTitle id="alert-dialog-title" sx={{ fontWeight: 'medium' }}> {t('userList.deleteDialog.title')} </DialogTitle>
                    <DialogContent>
                        {/* Dialog Text übersetzen mit Interpolation */}
                        <DialogContentText id="alert-dialog-description"> {t('userList.deleteDialog.content', { username: userToDelete?.username ?? 'diesem Benutzer' })} </DialogContentText>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        {/* Button Texte übersetzen */}
                        <Button onClick={handleCloseDeleteDialog} disabled={isDeleting}>{t('common.cancelButton')}</Button>
                        <LoadingButton onClick={handleConfirmDelete} color="error" variant="contained" loading={isDeleting} autoFocus> {t('common.deleteButton')} </LoadingButton>
                    </DialogActions>
                </Dialog>

            </Box>
        </Box>
    );
};

export default UserList;