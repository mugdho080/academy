import React from 'react';
import { Activity, AlertCircle, Download, ShieldCheck, TrendingUp, User, Waves } from 'lucide-react';
import ClayBadge from '../clay/ClayBadge';
import ClayButton from '../clay/ClayButton';
import ClayCard from '../clay/ClayCard';
import ClayPageShell from '../clay/ClayPageShell';
import ClayProgress from '../clay/ClayProgress';
import ClaySectionHeader from '../clay/ClaySectionHeader';
import ClayStatCard from '../clay/ClayStatCard';
import ClayToggle from '../clay/ClayToggle';
import PageContainer from '../layout/PageContainer';
import TimeLogsViewer from '../TimeLogsViewer';

const stageTone = (stage) => {
    switch (stage) {
        case 'active':
        case 'claim_ready':
            return 'success';
        case 'blocked':
            return 'danger';
        case 'lead':
            return 'warning';
        default:
            return 'neutral';
    }
};

const ParticipantDetailClayView = ({
    id,
    data,
    invoices,
    coachAnalytics,
    progressData,
    variant,
    setVariant
}) => {
    const participantLabel = data?.full_name || data?.name || `Participant #${id || 1}`;
    const totalBlockers = data?.blockers?.length || 0;
    const averageProgress = progressData.length > 0
        ? Math.round(progressData.reduce((sum, item) => sum + Number(item.completion_percentage || 0), 0) / progressData.length)
        : 0;

    return (
        <ClayPageShell className="text-[color:var(--clay-text)]">
            <PageContainer className="pb-24 lg:pb-10">
                <div className="space-y-5 sm:space-y-6">
                    <ClayToggle
                        appearance="clay"
                        label="Admin participant profile appearance"
                        value={variant}
                        onChange={setVariant}
                        options={[
                            { label: 'Classic', value: 'classic' },
                            { label: 'Clay', value: 'clay' }
                        ]}
                    />

                    <ClayCard className="p-5 sm:p-7 lg:p-8">
                        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr,0.95fr] gap-5 sm:gap-6 items-start">
                            <div className="space-y-4">
                                <ClaySectionHeader
                                    eyebrow="Admin Participant Profile"
                                    title={participantLabel}
                                    description="Executive clay dashboard for stage, progress, compliance, invoices, and coach signals."
                                />
                                <div className="flex flex-wrap gap-2">
                                    <ClayBadge tone={stageTone(data?.stage)}>
                                        <Activity size={14} />
                                        Stage: {data?.stage || 'unknown'}
                                    </ClayBadge>
                                    <ClayBadge tone={totalBlockers > 0 ? 'warning' : 'success'}>
                                        <AlertCircle size={14} />
                                        {totalBlockers} Blockers
                                    </ClayBadge>
                                    <ClayBadge tone="info">
                                        <User size={14} />
                                        ID {id || 1}
                                    </ClayBadge>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <ClayStatCard label="Invoices" value={invoices.length} helper="Current participant invoice records" icon={<Download size={18} className="text-[color:var(--clay-cyan)]" />} />
                                <ClayStatCard label="Progress" value={`${averageProgress}%`} helper="Average chapter completion" icon={<TrendingUp size={18} className="text-[color:var(--clay-cyan)]" />} />
                                <ClayStatCard label="Coach Events" value={coachAnalytics?.events?.length || 0} helper="Recent logged coaching interactions" icon={<Waves size={18} className="text-[color:var(--clay-cyan)]" />} />
                            </div>
                        </div>
                    </ClayCard>

                    {data?.blockers && data.blockers.length > 0 ? (
                        <ClayCard className="p-5 sm:p-6">
                            <ClaySectionHeader
                                eyebrow="Blockers"
                                title="Active Blockers"
                                description="Bright but readable status pills keep blocking items visible without using harsh panels."
                            />
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                {data.blockers.map((blocker, index) => (
                                    <div key={`${blocker}-${index}`} className="clay-inset p-4 flex items-start gap-3">
                                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[color:var(--clay-warning)] shadow-[0_0_10px_rgba(240,153,91,0.5)]" />
                                        <p className="text-sm font-semibold text-[color:var(--clay-text)]">{blocker}</p>
                                    </div>
                                ))}
                            </div>
                        </ClayCard>
                    ) : null}

                    <ClayCard className="p-4 sm:p-6">
                        <TimeLogsViewer userId={id} isAdminView={true} variant="clay" className="!bg-transparent !shadow-none !border-0 !p-0" />
                    </ClayCard>

                    <div className="grid grid-cols-1 xl:grid-cols-[1.1fr,0.9fr] gap-5 sm:gap-6">
                        <ClayCard className="p-5 sm:p-6">
                            <ClaySectionHeader
                                eyebrow="Learning Progress"
                                title="Chapter Completion"
                                description="Soft clay progress widgets keep completion percentages scannable for admin monitoring."
                            />
                            <div className="mt-5 space-y-4">
                                {progressData.length === 0 ? (
                                    <div className="clay-inset p-5 text-sm font-semibold text-[color:var(--clay-text-soft)]">
                                        No chapter progress available.
                                    </div>
                                ) : progressData.map((prog) => (
                                    <div key={prog.chapter_id} className="clay-inset p-4 sm:p-5">
                                        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                                            <div>
                                                <p className="text-base font-black text-[color:var(--clay-text)]">{prog.title}</p>
                                                <p className="text-sm font-medium text-[color:var(--clay-text-soft)]">
                                                    {prog.completed_lessons} of {prog.total_lessons} lessons complete
                                                </p>
                                            </div>
                                            <ClayBadge tone="info">{prog.completion_percentage}% complete</ClayBadge>
                                        </div>
                                        <div className="mt-4">
                                            <ClayProgress
                                                label="Completion"
                                                value={Number(prog.completed_lessons || 0)}
                                                total={Number(prog.total_lessons || 0)}
                                                percent={Number(prog.completion_percentage || 0)}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ClayCard>

                        <ClayCard className="p-5 sm:p-6">
                            <ClaySectionHeader
                                eyebrow="Coach Signals"
                                title="Panda Coach Analytics"
                                description="Bright executive metrics with calmer surfaces."
                            />
                            {!coachAnalytics ? (
                                <div className="mt-5 clay-inset p-5 text-sm font-semibold text-[color:var(--clay-text-soft)]">
                                    Loading coach analytics...
                                </div>
                            ) : (
                                <div className="mt-5 space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <ClayStatCard label="Frustration" value={coachAnalytics?.state?.frustration_score ?? 0} />
                                        <ClayStatCard label="Engagement" value={coachAnalytics?.state?.engagement_score ?? 0} />
                                        <ClayStatCard label="Last Route" value={coachAnalytics?.state?.last_route || '-'} />
                                    </div>
                                    <div className="clay-inset p-4 sm:p-5 space-y-3 max-h-[20rem] overflow-auto">
                                        <p className="text-[11px] uppercase tracking-[0.16em] font-black text-[color:var(--clay-text-soft)]">Recent Coach Events</p>
                                        {(coachAnalytics?.events || []).slice(0, 10).map((evt) => (
                                            <div key={evt.id} className="rounded-[1.1rem] border border-white/70 bg-white/40 px-4 py-3">
                                                <p className="text-sm font-bold text-[color:var(--clay-text)]">{evt.event_type}</p>
                                                <p className="mt-1 text-xs font-medium text-[color:var(--clay-text-soft)]">
                                                    {evt.route || '-'} | {new Date(evt.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                        ))}
                                        {(coachAnalytics?.events || []).length === 0 ? (
                                            <p className="text-sm font-medium text-[color:var(--clay-text-soft)]">No coach events yet.</p>
                                        ) : null}
                                    </div>
                                </div>
                            )}
                        </ClayCard>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-[0.95fr,1.05fr] gap-5 sm:gap-6">
                        <ClayCard className="p-5 sm:p-6">
                            <ClaySectionHeader
                                eyebrow="Invoices"
                                title="Invoice Records"
                                description="Downloads stay available and the clay treatment keeps admin actions obvious."
                            />
                            <div className="mt-5 space-y-3">
                                {invoices.length === 0 ? (
                                    <div className="clay-inset p-5 text-sm font-semibold text-[color:var(--clay-text-soft)]">
                                        No invoices for this participant yet.
                                    </div>
                                ) : invoices.map((inv) => (
                                    <div key={inv.id} className="clay-inset p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                        <div>
                                            <p className="text-base font-black text-[color:var(--clay-text)]">{inv.invoice_number}</p>
                                            <p className="mt-1 text-sm font-medium text-[color:var(--clay-text-soft)]">
                                                {inv.invoice_date} | Status {inv.status}
                                            </p>
                                            <p className="mt-2 text-sm font-black text-[color:var(--clay-text)]">${Number(inv.total || 0).toFixed(2)}</p>
                                        </div>
                                        <ClayButton type="button" variant="primary" onClick={() => window.open(`/api/admin/download_invoice.php?id=${inv.id}`, '_blank')} className="w-full md:w-auto inline-flex items-center justify-center gap-2">
                                            <Download size={16} />
                                            PDF
                                        </ClayButton>
                                    </div>
                                ))}
                            </div>
                        </ClayCard>

                        <ClayCard className="p-5 sm:p-6">
                            <ClaySectionHeader
                                eyebrow="Compliance"
                                title="Traffic Light Sessions"
                                description="Bright color-coded compliance cards keep claimability states visible."
                            />
                            <div className="mt-5 space-y-3">
                                <div className="clay-inset p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-black text-[color:var(--clay-text)]">12 Feb 2026 - Innovation Program</p>
                                        <p className="mt-1 text-xs font-medium text-[color:var(--clay-text-soft)]">Session ID: 104 | Requires Note, Attendance</p>
                                    </div>
                                    <ClayBadge tone="success">Claimable</ClayBadge>
                                </div>
                                <div className="clay-inset p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-black text-[color:var(--clay-text)]">14 Feb 2026 - Independent Living</p>
                                        <p className="mt-1 text-xs font-medium text-[color:var(--clay-text-soft)]">Session ID: 105 | Missing Outcome Report</p>
                                    </div>
                                    <ClayBadge tone="warning">Missing Evidence</ClayBadge>
                                </div>
                                <div className="clay-inset p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-black text-[color:var(--clay-text)]">20 Feb 2026 - Community Access</p>
                                        <p className="mt-1 text-xs font-medium text-[color:var(--clay-text-soft)]">Session ID: 108 | Plan Expired before Delivery</p>
                                    </div>
                                    <ClayBadge tone="danger">Blocked</ClayBadge>
                                </div>
                            </div>
                        </ClayCard>
                    </div>
                </div>
            </PageContainer>
        </ClayPageShell>
    );
};

export default ParticipantDetailClayView;
