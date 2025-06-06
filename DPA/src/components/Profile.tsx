import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import axios from '../api/axiosInstance';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import type { User } from '../context/AuthContext';
import { AxiosError } from 'axios';
import DOMPurify from 'dompurify';
import API_BASE_URL from '../apiConfig';
import { useTranslation } from 'react-i18next'; // useTranslation importieren

import {
    Box, AppBar, Toolbar, Typography, CssBaseline, Card, CardContent, CardHeader, CardActions,
    Button, useTheme, CircularProgress, Avatar, Drawer, List, ListItem,
    ListItemText, ListItemButton, ListItemIcon, Divider, Stack, alpha,
    TextField, IconButton, Tooltip, ListSubheader,
    Dialog, DialogActions, DialogContent, DialogTitle, DialogContentText,
    Paper,
    Skeleton,
    Grid
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import { motion, AnimatePresence } from 'framer-motion';

import {
    Home as HomeIcon,
    AccountCircle as ProfileIcon,
    Settings as SettingsIcon,
    Edit as EditIcon,
    Phone as PhoneIcon, LocationOn as LocationIcon, Email as EmailIcon,
    Badge as BadgeIcon
} from '@mui/icons-material';

import ProfileNavbar from './ProfileNavbar'; // Die gemeinsame Navbar importieren

const defaultProfileImage = '/Default.png';

// Die interne ProfileNavbar wurde entfernt und in ProfileNavbar.tsx ausgelagert

const Profile: React.FC = () => {
    // --- State variables ---
    const [userId, setUserId] = useState<number | null>(null);
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [location, setLocation] = useState("");
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [role, setRole] = useState<string | undefined>(undefined);
    const [initialPhoneNumber, setInitialPhoneNumber] = useState("");
    const [initialLocation, setInitialLocation] = useState("");
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [loading, setLoading] = useState(false);
    const [imageUploadLoading, setImageUploadLoading] = useState(false);
    const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true);

    const navigate = useNavigate();
    const theme = useTheme();
    const { user: contextUser, login: updateUserContext, logout } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation(); // t Funktion holen

    // --- Effects and Handlers ---
    useEffect(() => {
        setIsLoadingProfile(true);
        let userToLoad: Partial<User> | null = null;
        if (contextUser) { userToLoad = contextUser; }
        else { const storedUser = localStorage.getItem("user"); if (storedUser) { try { userToLoad = JSON.parse(storedUser); } catch { toast.error(t("common.sessionInvalidToast")); logout(); navigate("/login", { replace: true }); setIsLoadingProfile(false); return; } } else { navigate("/login", { replace: true }); setIsLoadingProfile(false); return; } }

        if (userToLoad) {
            setUserId(userToLoad.id ?? null); setUsername(userToLoad.username ?? ""); setEmail(userToLoad.email ?? ""); setRole(userToLoad.role); setProfileImage(userToLoad.profileImageUrl || null); setPhoneNumber(userToLoad.phoneNumber || ""); setLocation(userToLoad.location || "");
            const timer = setTimeout(() => { setIsLoadingProfile(false); }, 250);
            return () => clearTimeout(timer);
        } else {
            toast.error(t("profile.failedToLoadUserToast"));
            logout();
            setIsLoadingProfile(false);
        }
    }, [contextUser, navigate, logout, t]); // 't' als Abhängigkeit hinzufügen

    const validatePhoneNumber = (number: string) => /^\+?[0-9\s\-()]{7,20}$/.test(number);

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userId) { toast.error(t("profile.userDataNotLoadedToast")); return; }
        const currentContextUser = contextUser || JSON.parse(localStorage.getItem("user") || '{}');
        if (!currentContextUser?.token) { toast.error(t("common.authTokenMissingToast")); return; }
        const formData = new FormData();
        formData.append("file", file);
        setImageUploadLoading(true);
        const toastId = toast.loading(t("profile.uploadPictureLoading"));

        try {
            const res = await axios.post(`${API_BASE_URL}/users/upload-profile-image`, formData, { headers: { "Content-Type": "multipart/form-data" } });
            const newImageUrl = res.data.imageUrl;
            setProfileImage(newImageUrl);
            const updatedUserData : User = { ...currentContextUser, id: userId, username: username, email: email, role: role ?? "User", token: currentContextUser.token, profileImageUrl: newImageUrl || undefined, phoneNumber: phoneNumber || undefined, location: location || undefined };
            // KORREKTUR 1: 'userData' durch 'email' ersetzt
            if (!updatedUserData.username || !updatedUserData.email || !updatedUserData.role || !updatedUserData.token) {
                throw new Error(t("common.incompleteUserDataToast"));
            }
            updateUserContext(updatedUserData);
            localStorage.setItem("user", JSON.stringify(updatedUserData));
            toast.success(t("profile.uploadPictureSuccess"), { id: toastId });
        } catch (error) {
            console.error("Error uploading image:", error);
            toast.error(t("profile.uploadPictureError"), { id: toastId });
        } finally {
            setImageUploadLoading(false);
        }
    };

    const handleOpenEditDialog = () => { setInitialPhoneNumber(phoneNumber); setInitialLocation(location); setOpenEditDialog(true); };
    const handleCloseEditDialog = (saved = false) => { setOpenEditDialog(false); if (!saved) { setPhoneNumber(initialPhoneNumber); setLocation(initialLocation); } };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (phoneNumber && !validatePhoneNumber(phoneNumber)) { toast.error(t("profile.phoneNumberInvalidToast")); return; }
        if (location && location.trim() === "") { toast.error(t("profile.locationInvalidToast")); return; }
        if (!userId) { toast.error(t("profile.userDataNotLoadedToast")); return; }
        const currentContextUser = contextUser || JSON.parse(localStorage.getItem("user") || '{}');
        if (!currentContextUser?.token) { toast.error(t("common.authTokenMissingToast")); return; }

        const sanitizedPhoneNumber = phoneNumber ? DOMPurify.sanitize(phoneNumber.trim()) : "";
        const sanitizedLocation = location ? DOMPurify.sanitize(location.trim()) : "";

        setLoading(true);
        const toastId = toast.loading(t("profile.savingProfileLoading"));

        try {
            await axios.put(`${API_BASE_URL}/users/update-profile`, { phoneNumber: sanitizedPhoneNumber, location: sanitizedLocation, });
            toast.success(t("profile.saveProfileSuccess"), { id: toastId });

            const updatedUserData : User = { ...currentContextUser, id: userId, username: username, email: email, role: role ?? "User", token: currentContextUser.token, profileImageUrl: profileImage || undefined, phoneNumber: sanitizedPhoneNumber || undefined, location: sanitizedLocation || undefined };
            // KORREKTUR 1: 'userData' durch 'email' ersetzt (zweite Stelle)
            if (!updatedUserData.username || !updatedUserData.email || !updatedUserData.role || !updatedUserData.token) {
                throw new Error(t("common.incompleteUserDataToast"));
            }
            updateUserContext(updatedUserData);
            localStorage.setItem("user", JSON.stringify(updatedUserData));

            handleCloseEditDialog(true);
        } catch (error) {
            console.error("Error updating profile:", error);
            toast.error(t("profile.saveProfileError"), { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarClick = () => { if (imageUploadLoading) return; fileInputRef.current?.click(); };

    // --- Animation Variants ---
    const contentVariants = {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.4, delay: 0.1 } },
        exit: { opacity: 0, transition: { duration: 0.1 } }
    };
    const skeletonVariants = {
        initial: { opacity: 1 },
        exit: { opacity: 0, transition: { duration: 0.2 } }
    };

    // --- Render Skeletons --- (Skelett-Texte hier müssen nicht übersetzt werden, sie sind Platzhalter)
    const renderProfileSkeleton = () => (
        <motion.div key="profile-skeleton" variants={skeletonVariants} initial="initial" exit="exit">
            <Paper elevation={0} variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.5), mb: 3 }}>
                <Stack alignItems="center" spacing={1.5}>
                    <Skeleton variant="circular" sx={{ width: { xs: 100, sm: 120 }, height: { xs: 100, sm: 120 } }}/>
                    <Skeleton variant="text" height={40} width="min(300px, 60%)" />
                    {/* KORREKTUR 2: Backslash entfernt */}
                    <Skeleton variant="text" height={24} width="min(150px, 30%)" /> {/* Korrigiert: Syntaxfehler */}
                </Stack>
            </Paper>
            <Paper elevation={0} variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.5) }}>
                <Typography variant="h6" sx={{ mb: 2 }}> <Skeleton width="35%" /> </Typography>
                <Stack spacing={3} divider={<Divider />}>
                    {[1, 2, 3].map(i => (
                        <Stack direction="row" spacing={2} key={i} alignItems="center" sx={{ py: 1.5 }}>
                            <Skeleton variant="circular" width={40} height={40} />
                            <Box sx={{ width: '100%' }}>
                                <Skeleton variant="text" height={20} width="80%" />
                                <Skeleton variant="text" height={16} width="40%" />
                            </Box>
                        </Stack>
                    ))}
                </Stack>
                {/* Skeleton for the Edit Button */}
                <Divider sx={{ mt: 3, mb: 2 }} />
                <Skeleton variant="rounded" height={48} width="100%" />
            </Paper>
        </motion.div>
    );

    // --- Render Actual Content ---
    const renderProfileContent = () => (
        <motion.div key="profile-content" variants={contentVariants} initial="initial" animate="animate">
            <Paper elevation={0} variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.5), mb: 3, bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.6) : alpha(theme.palette.grey[100], 0.5), backdropFilter: theme.palette.mode === 'dark' ? 'blur(8px)' : 'none', }}>
                <Stack alignItems="center" spacing={1.5}>
                    <Box sx={{ position: 'relative' }}>
                        {/* Übersetze Tooltip */}
                        <Tooltip title={t('profile.changePictureTooltip')} placement="bottom">
                            <Avatar alt={username} src={profileImage || defaultProfileImage} sx={{ width: { xs: 100, sm: 120 }, height: { xs: 100, sm: 120 }, border: `4px solid ${theme.palette.background.paper}`, boxShadow: theme.shadows[3], cursor: imageUploadLoading ? 'default' : 'pointer', transition: 'transform 0.3s ease, opacity 0.2s ease', opacity: imageUploadLoading ? 0.6 : 1, '&:hover': { transform: imageUploadLoading ? 'none' : 'scale(1.05)'} }} onClick={handleAvatarClick} />
                        </Tooltip>
                        <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleImageChange} />
                        {imageUploadLoading && ( <CircularProgress size={132} thickness={2.5} sx={{ color: 'primary.main', position: 'absolute', top:'50%', left:'50%', transform: 'translate(-50%, -50%)', zIndex: 1, marginTop: '-1px', marginLeft: '-1px' }} /> )}
                    </Box>
                    <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', textAlign: 'center' }}> {username} </Typography>
                    <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 'regular', display: 'flex', alignItems: 'center', textAlign: 'center' }}>
                        <BadgeIcon fontSize="inherit" sx={{ mr: 0.5, opacity: 0.7 }}/> {role}
                    </Typography>
                </Stack>
            </Paper>

            <Paper elevation={0} variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, borderColor: alpha(theme.palette.divider, 0.5), bgcolor: 'background.paper' }}>
                {/* Übersetze Titel */}
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'medium' }}>{t('profile.contactDetailsTitle')}</Typography>
                <Stack spacing={2.5} divider={<Divider flexItem />}>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ py: 1 }}>
                        <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), width: 40, height: 40 }}>
                            <EmailIcon color="primary"/>
                        </Avatar>
                        <Box>
                            {/* Übersetze Label */}
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.2 }}>{t('profile.emailLabel')}</Typography>
                            <Typography variant="body1" sx={{ fontWeight: 500, wordBreak: 'break-word', lineHeight: 1.4 }}>{email || '-'}</Typography>
                        </Box>
                    </Stack>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ py: 1 }}>
                        <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), width: 40, height: 40 }}>
                            <PhoneIcon color="primary"/>
                        </Avatar>
                        <Box>
                            {/* Übersetze Label */}
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.2 }}>{t('profile.phoneNumberLabel')}</Typography>
                            {/* Übersetze Platzhaltertext */}
                            <Typography variant="body1" sx={{ fontWeight: 500, lineHeight: 1.4 }}>{phoneNumber ? phoneNumber : <Typography component="span" variant="body1" fontStyle="italic" color="text.disabled">{t('common.notSpecified')}</Typography>}</Typography>
                        </Box>
                    </Stack>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ py: 1 }}>
                        <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), width: 40, height: 40 }}>
                            <LocationIcon color="primary"/>
                        </Avatar>
                        <Box>
                            {/* Übersetze Label */}
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.2 }}>{t('profile.locationLabel')}</Typography>
                            {/* Übersetze Platzhaltertext */}
                            <Typography variant="body1" sx={{ fontWeight: 500, lineHeight: 1.4 }}>{location ? location : <Typography component="span" variant="body1" fontStyle="italic" color="text.disabled">{t('common.notSpecified')}</Typography>}</Typography>
                        </Box>
                    </Stack>
                </Stack>
                <Divider sx={{ my: 3 }} />
                {/* Übersetze Button Text */}
                <Button
                    variant="contained"
                    fullWidth
                    startIcon={<EditIcon />}
                    onClick={handleOpenEditDialog}
                    size="large"
                    sx={{
                        py: 1.2,
                        fontWeight: 'medium',
                        transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out',
                        '&:hover': {
                            transform: 'scale(1.015)',
                            boxShadow: theme.shadows[4],
                        }
                    }}
                >
                    {t('profile.editButton')}
                </Button>
            </Paper>
        </motion.div>
    );


    if (contextUser === undefined && !localStorage.getItem("user")) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default' }}><CircularProgress /></Box>;
    }

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            {/* Die gemeinsame, übersetzte Navbar verwenden */}
            <ProfileNavbar />

            <Box component="main" sx={{ flexGrow: 1, bgcolor: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.background.default, minHeight: '100vh' }} >
                <AppBar position="fixed" sx={{ width: '100%', zIndex: theme.zIndex.drawer + 1, bgcolor: alpha(theme.palette.background.paper, 0.8), backdropFilter: 'blur(8px)', color: theme.palette.text.primary, boxShadow: theme.shadows[1], borderBottom: `1px solid ${theme.palette.divider}` }} >
                    <Toolbar>
                        <ProfileIcon sx={{ mr: 1.5, color: 'primary.main' }} />
                        {/* Übersetze AppBar Titel */}
                        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}> {t('navbar.myProfile')} </Typography>
                        {isLoadingProfile ? ( <> <Skeleton variant="text" width={100} sx={{ mr: 1, display: { xs: 'none', sm: 'block' } }} /> <Skeleton variant="circular" width={40} height={40} /> </>
                        ) : ( <> <Typography sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>{username} ({role})</Typography> <Avatar src={profileImage || undefined} sx={{ bgcolor: theme.palette.primary.main }}>{username?.charAt(0).toUpperCase()}</Avatar> </> )}
                    </Toolbar>
                </AppBar>
                <Toolbar />

                <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: '900px', mx: 'auto' }}>
                    <AnimatePresence mode="wait">
                        {isLoadingProfile ? renderProfileSkeleton() : renderProfileContent()}
                    </AnimatePresence>
                </Box>

                {/* Dialog für Bearbeitung */}
                <Dialog open={openEditDialog} onClose={() => handleCloseEditDialog(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                    {/* Übersetze Dialog Titel */}
                    <DialogTitle sx={{ borderBottom: `1px solid ${theme.palette.divider}`, fontWeight: 'medium' }}>{t('profile.editContactDetailsDialogTitle')}</DialogTitle>
                    <Box component="form" onSubmit={handleSubmit}>
                        <DialogContent sx={{ pt: '20px !important' }}>
                            <Stack spacing={3}>
                                {/* Übersetze Textfeld Label und Helper Text */}
                                <TextField label={t('profile.phoneNumberLabel')} type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} fullWidth variant="outlined" placeholder={t('profile.phoneNumberPlaceholder')} helperText={phoneNumber && !validatePhoneNumber(phoneNumber) ? t('profile.phoneNumberInvalidFormat') : ""} error={!!(phoneNumber && !validatePhoneNumber(phoneNumber))} />
                                {/* Übersetze Textfeld Label und Placeholder */}
                                <TextField label={t('profile.locationLabel')} type="text" value={location} onChange={e => setLocation(e.target.value)} fullWidth variant="outlined" placeholder={t('profile.locationPlaceholder')} />
                            </Stack>
                        </DialogContent>
                        <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                            {/* Übersetze Button Text */}
                            <Button onClick={() => handleCloseEditDialog(false)} color="inherit"> {t('common.cancelButton')} </Button>
                            {/* Übersetze Button Text */}
                            <LoadingButton type="submit" variant="contained" color="primary" loading={loading}> {t('common.saveButton')} </LoadingButton>
                        </DialogActions>
                    </Box>
                </Dialog>

            </Box>
        </Box>
    );
};

export default Profile;