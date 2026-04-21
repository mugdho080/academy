import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import ParticipantDetailClassicView from '../../components/participant/ParticipantDetailClassicView';

export default function ParticipantDetail() {
    const { id } = useParams();
    const [data, setData] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [coachAnalytics, setCoachAnalytics] = useState(null);
    const [progressData, setProgressData] = useState([]);

    useEffect(() => {
        axios.get(`/api/admin/participant_stage.php?id=${id || 1}`)
            .then((res) => setData(res.data))
            .catch((err) => console.error(err));

        axios.get(`/api/learner/get_chapter_progress.php?user_id=${id || 1}`)
            .then((res) => {
                if (res.data?.success) setProgressData(res.data.progress);
            })
            .catch((err) => console.error(err));

        axios.get('/api/admin/get_user_invoices.php', {
            params: { user_id: id || 1, status: 'all' }
        })
            .then((res) => setInvoices(res.data?.invoices || []))
            .catch((err) => console.error(err));

        axios.get('/api/admin/get_coach_events.php', {
            params: { user_id: id || 1, limit: 30 }
        })
            .then((res) => setCoachAnalytics(res.data || null))
            .catch((err) => console.error(err));
    }, [id]);

    if (!data) return <div className="p-8">Loading Participant Details...</div>;

    const getStageColor = (stage) => {
        switch (stage) {
            case 'lead':
                return 'bg-gray-100 text-gray-700';
            case 'active':
                return 'bg-blue-100 text-blue-700';
            case 'claim_ready':
                return 'bg-green-100 text-green-700';
            case 'blocked':
                return 'bg-red-100 text-red-700';
            default:
                return 'bg-gray-100 text-gray-700';
        }
    };

    const viewProps = {
        id,
        data,
        invoices,
        coachAnalytics,
        progressData,
        getStageColor
    };

    return <ParticipantDetailClassicView {...viewProps} />;
}

