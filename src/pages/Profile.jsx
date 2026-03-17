import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, ShieldCheck } from 'lucide-react';
import axios from 'axios';
import { useCoach } from '../context/CoachContext';
import { useUiVariant } from '../context/UiVariantContext';
import ProfileClassicView from '../components/profile/ProfileClassicView';
import ProfileClayView from '../components/profile/ProfileClayView';

const Profile = () => {
    const [agreement, setAgreement] = useState(null);
    const [paidInvoices, setPaidInvoices] = useState([]);
    const [invoiceLoading, setInvoiceLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || '{}'));
    const [isEditingAbout, setIsEditingAbout] = useState(false);
    const [aboutText, setAboutText] = useState(user?.about_me || '');
    const [uploadingImage, setUploadingImage] = useState(false);
    const { emitCoachEvent } = useCoach();
    const { variant, setVariant } = useUiVariant('learner');

    useEffect(() => {
        const fetchData = async () => {
            if (!user.id) return;
            try {
                try {
                    const profileRes = await axios.get(`/api/learner/fetch_user_profile.php?user_id=${user.id}`);
                    if (profileRes.data?.success) {
                        setUser(profileRes.data.user);
                        setAboutText(profileRes.data.user.about_me || '');
                        localStorage.setItem('user', JSON.stringify(profileRes.data.user));
                    }
                } catch (profileErr) {
                    console.error('Profile fetch error', profileErr);
                }

                const agreementRes = await axios.get(`/api/learner/fetch_my_agreement.php?user_id=${user.id}`);
                const invoiceRes = await axios.get('/api/learner/get_my_invoices.php', {
                    params: { status: 'paid' }
                });

                if (!agreementRes.data.error) setAgreement(agreementRes.data);
                if (!invoiceRes.data?.error) setPaidInvoices(invoiceRes.data?.invoices || []);
            } catch (err) {
                console.error('Failed to fetch profile data', err);
            } finally {
                setInvoiceLoading(false);
                setLoading(false);
            }
        };

        fetchData();
    }, [user.id]);

    useEffect(() => {
        emitCoachEvent('page_view', { route: '/profile' }, { immediate: true });
    }, [emitCoachEvent]);

    const formatStatus = (status) => {
        switch (status) {
            case 'active':
                return { label: 'Active Account', color: 'bg-green-100 text-green-600', icon: <CheckCircle size={18} /> };
            case 'pending':
                return { label: 'Under Review', color: 'bg-amber-100 text-amber-600', icon: <AlertCircle size={18} /> };
            default:
                return { label: 'Contact Us to Unlock', color: 'bg-gray-100 text-gray-600', icon: <ShieldCheck size={18} /> };
        }
    };

    const handleImageUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('profile_image', file);
        formData.append('user_id', user.id);

        setUploadingImage(true);
        try {
            const res = await axios.post('/api/learner/upload_profile_image.php', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                setUser(res.data.user);
                localStorage.setItem('user', JSON.stringify(res.data.user));
            } else {
                alert(res.data.error || 'Upload failed');
            }
        } catch (err) {
            console.error(err);
            alert('Upload error');
        } finally {
            setUploadingImage(false);
        }
    };

    const saveAboutMe = async () => {
        try {
            const res = await axios.post('/api/learner/update_profile_text.php', {
                user_id: user.id,
                about_me: aboutText
            });
            if (res.data.success) {
                setIsEditingAbout(false);
                setUser(res.data.user);
                localStorage.setItem('user', JSON.stringify(res.data.user));
            } else {
                alert(res.data.error || 'Update failed');
            }
        } catch (err) {
            console.error(err);
            alert('Update error');
        }
    };

    const viewProps = {
        variant,
        setVariant,
        agreement,
        paidInvoices,
        invoiceLoading,
        loading,
        user,
        statusStyle: formatStatus(user.status),
        isEditingAbout,
        setIsEditingAbout,
        aboutText,
        setAboutText,
        uploadingImage,
        handleImageUpload,
        saveAboutMe
    };

    if (variant === 'clay') {
        return <ProfileClayView {...viewProps} />;
    }

    return <ProfileClassicView {...viewProps} />;
};

export default Profile;

