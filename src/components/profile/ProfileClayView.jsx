import React from 'react';
import {
    Camera,
    Download,
    FileText,
    Loader2,
    Mail,
    MapPin,
    PencilLine,
    Save,
    ShieldCheck,
    Trophy,
    User
} from 'lucide-react';
import PageContainer from '../layout/PageContainer';
import ClayAvatarFrame from '../clay/ClayAvatarFrame';
import ClayBadge from '../clay/ClayBadge';
import ClayButton from '../clay/ClayButton';
import ClayCard from '../clay/ClayCard';
import ClayPageShell from '../clay/ClayPageShell';
import ClaySectionHeader from '../clay/ClaySectionHeader';
import ClayStatCard from '../clay/ClayStatCard';
import ClayToggle from '../clay/ClayToggle';
import TimeLogsViewer from '../TimeLogsViewer';
import { withAuthQuery } from '../../utils/api';

const ProfileClayView = ({
    variant,
    setVariant,
    agreement,
    paidInvoices,
    invoiceLoading,
    loading,
    user,
    statusStyle,
    isEditingAbout,
    setIsEditingAbout,
    aboutText,
    setAboutText,
    uploadingImage,
    handleImageUpload,
    saveAboutMe
}) => {
    const clayStatusTone = user.status === 'active' ? 'success' : user.status === 'pending' ? 'warning' : 'neutral';

    return (
        <ClayPageShell>
            <PageContainer className="pb-24 lg:pb-12">
                <div className="space-y-5 sm:space-y-6">
                    <ClayToggle
                        appearance="clay"
                        label="Learner profile appearance"
                        value={variant}
                        onChange={setVariant}
                        options={[
                            { label: 'Classic', value: 'classic' },
                            { label: 'Clay', value: 'clay' }
                        ]}
                    />

                    <ClayCard className="p-5 sm:p-7 lg:p-8">
                        <div className="grid grid-cols-1 xl:grid-cols-[auto,1fr] gap-5 sm:gap-7 items-start">
                            <div className="flex flex-col items-center xl:items-start gap-4">
                                <div className="relative">
                                    <ClayAvatarFrame
                                        src={user.profile_image_url}
                                        alt="Profile"
                                        fallbackIcon={<User size={46} />}
                                        sizeClass="h-28 w-28 sm:h-36 sm:w-36"
                                    />
                                    <label className="absolute -bottom-2 -right-2">
                                        <span className="clay-button inline-flex items-center justify-center h-12 w-12 rounded-full bg-[linear-gradient(145deg,#b6d4fc,#9ed9fa)] text-[color:var(--clay-text)] cursor-pointer">
                                            {uploadingImage ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                                        </span>
                                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                                    </label>
                                </div>

                                <div className="flex flex-wrap items-center justify-center xl:justify-start gap-2">
                                    <ClayBadge tone={clayStatusTone}>{statusStyle.label}</ClayBadge>
                                    <ClayBadge tone="info">
                                        <Trophy size={14} />
                                        {user.points || 0} Points
                                    </ClayBadge>
                                </div>
                            </div>

                            <div className="space-y-5">
                                <ClaySectionHeader
                                    eyebrow="Learner Profile"
                                    title={user.name || 'Goodwill Learner'}
                                    description="A calm claymorphic view of your account, agreement, activity, and invoices."
                                />

                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                                    <ClayStatCard label="NDIS Number" value={user.ndis_number || '-'} icon={<ShieldCheck size={18} />} />
                                    <ClayStatCard label="Email" value={user.email || '-'} icon={<Mail size={18} />} className="xl:col-span-2" />
                                </div>
                            </div>
                        </div>
                    </ClayCard>

                    <div className="grid grid-cols-1 xl:grid-cols-[0.95fr,1.25fr] gap-5 sm:gap-6">
                        <ClayCard className="p-5 sm:p-6 space-y-5">
                            <ClaySectionHeader
                                eyebrow="Account"
                                title="Account Snapshot"
                                description="Contact, support status, and a short learner biography."
                            />

                            <div className="grid grid-cols-1 gap-3">
                                <div className="clay-inset p-4">
                                    <p className="text-[11px] uppercase tracking-[0.16em] font-black text-[color:var(--clay-text-soft)]">Full Name</p>
                                    <p className="mt-2 text-base font-bold text-[color:var(--clay-text)]">{user.name || '-'}</p>
                                </div>
                                <div className="clay-inset p-4">
                                    <p className="text-[11px] uppercase tracking-[0.16em] font-black text-[color:var(--clay-text-soft)]">Email</p>
                                    <p className="mt-2 text-base font-bold text-[color:var(--clay-text)] break-words">{user.email || '-'}</p>
                                </div>
                                <div className="clay-inset p-4">
                                    <p className="text-[11px] uppercase tracking-[0.16em] font-black text-[color:var(--clay-text-soft)]">Support Status</p>
                                    <p className="mt-2 text-base font-bold text-[color:var(--clay-text)]">{statusStyle.label}</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-[11px] uppercase tracking-[0.16em] font-black text-[color:var(--clay-text-soft)]">About Me</p>
                                    {!isEditingAbout ? (
                                        <button
                                            type="button"
                                            onClick={() => setIsEditingAbout(true)}
                                            className="clay-button bg-[rgba(255,255,255,0.65)] text-[color:var(--clay-text)] !px-3 !py-2"
                                        >
                                            <PencilLine size={15} />
                                        </button>
                                    ) : null}
                                </div>

                                {isEditingAbout ? (
                                    <div className="space-y-3">
                                        <textarea
                                            value={aboutText}
                                            onChange={(e) => setAboutText(e.target.value)}
                                            placeholder="Write a little bit about yourself..."
                                            className="clay-inset min-h-[140px] w-full resize-y p-4 text-sm text-[color:var(--clay-text)] outline-none"
                                        />
                                        <div className="flex flex-wrap justify-end gap-2">
                                            <ClayButton type="button" variant="ghost" onClick={() => { setIsEditingAbout(false); setAboutText(user.about_me || ''); }}>
                                                Cancel
                                            </ClayButton>
                                            <ClayButton type="button" variant="primary" onClick={saveAboutMe}>
                                                <Save size={15} />
                                                Save
                                            </ClayButton>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="clay-inset p-4">
                                        <p className="text-sm leading-7 text-[color:var(--clay-text)] whitespace-pre-wrap">
                                            {user.about_me || 'No biography added yet. Use the edit button to introduce the learner in a calm, personal way.'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </ClayCard>

                        <ClayCard className="p-5 sm:p-6 space-y-5">
                            <ClaySectionHeader
                                eyebrow="Agreement"
                                title="Service Agreement"
                                description="Plan details and the saved signature remain available in the clay view."
                            />

                            {loading ? (
                                <div className="clay-inset p-8 text-center text-sm font-bold text-[color:var(--clay-text-soft)]">
                                    Checking for agreement...
                                </div>
                            ) : agreement ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="clay-inset p-4">
                                            <p className="text-[11px] uppercase tracking-[0.16em] font-black text-[color:var(--clay-text-soft)]">Full Legal Name</p>
                                            <p className="mt-2 font-bold text-[color:var(--clay-text)]">{agreement.full_name}</p>
                                        </div>
                                        <div className="clay-inset p-4">
                                            <p className="text-[11px] uppercase tracking-[0.16em] font-black text-[color:var(--clay-text-soft)]">Date of Birth</p>
                                            <p className="mt-2 font-bold text-[color:var(--clay-text)]">{agreement.dob}</p>
                                        </div>
                                        <div className="clay-inset p-4 sm:col-span-2">
                                            <p className="text-[11px] uppercase tracking-[0.16em] font-black text-[color:var(--clay-text-soft)]">Address</p>
                                            <p className="mt-2 font-bold text-[color:var(--clay-text)] flex items-start gap-2">
                                                <MapPin size={15} className="mt-0.5" />
                                                <span>{agreement.address}</span>
                                            </p>
                                        </div>
                                        <div className="clay-inset p-4">
                                            <p className="text-[11px] uppercase tracking-[0.16em] font-black text-[color:var(--clay-text-soft)]">Plan Type</p>
                                            <p className="mt-2 font-bold text-[color:var(--clay-text)]">{agreement.plan_type}</p>
                                        </div>
                                        <div className="clay-inset p-4">
                                            <p className="text-[11px] uppercase tracking-[0.16em] font-black text-[color:var(--clay-text-soft)]">Who Pays</p>
                                            <p className="mt-2 font-bold text-[color:var(--clay-text)]">{agreement.who_pays}</p>
                                        </div>
                                    </div>

                                    <div className="clay-inset p-4 sm:p-5">
                                        <p className="text-[11px] uppercase tracking-[0.16em] font-black text-[color:var(--clay-text-soft)] text-center">Signature</p>
                                        <div className="mt-4 flex min-h-[120px] items-center justify-center rounded-[1.25rem] bg-white/45 border border-white/70">
                                            {agreement.signature_url ? (
                                                <img
                                                    src={agreement.signature_url}
                                                    alt="My Signature"
                                                    className="max-h-24 mix-blend-multiply"
                                                />
                                            ) : (
                                                <p className="text-sm font-semibold text-[color:var(--clay-text-soft)]">Signature pending</p>
                                            )}
                                        </div>
                                        <p className="mt-3 text-center text-xs font-semibold text-[color:var(--clay-text-soft)]">
                                            Signed on {new Date(agreement.signed_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="clay-inset p-8 text-center">
                                    <FileText size={30} className="mx-auto text-[color:var(--clay-text-soft)]" />
                                    <p className="mt-4 text-base font-bold text-[color:var(--clay-text)]">No service agreement found.</p>
                                    <p className="mt-2 text-sm font-medium text-[color:var(--clay-text-soft)]">Sign the agreement on the Level Map to unlock all worlds.</p>
                                </div>
                            )}
                        </ClayCard>
                    </div>

                    <ClayCard className="p-4 sm:p-6">
                        <TimeLogsViewer userId={user.id} variant="clay" className="!bg-transparent !shadow-none !border-0 !p-0" />
                    </ClayCard>

                    <ClayCard className="p-5 sm:p-6 space-y-5">
                        <ClaySectionHeader
                            eyebrow="Invoices"
                            title="Paid Invoices"
                            description="Downloads remain available with the new claymorphic surface treatment."
                        />

                        {invoiceLoading ? (
                            <div className="clay-inset p-6 text-sm font-bold text-[color:var(--clay-text-soft)]">Loading invoices...</div>
                        ) : paidInvoices.length === 0 ? (
                            <div className="clay-inset p-6 text-sm font-bold text-[color:var(--clay-text-soft)]">No paid invoices yet.</div>
                        ) : (
                            <div className="space-y-3">
                                {paidInvoices.map((inv) => (
                                    <div key={inv.id} className="clay-inset p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                        <div>
                                            <p className="text-base font-black text-[color:var(--clay-text)]">{inv.invoice_number}</p>
                                            <p className="mt-1 text-sm font-medium text-[color:var(--clay-text-soft)]">
                                                Invoice Date {inv.invoice_date} | Paid {inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : '-'}
                                            </p>
                                            <p className="mt-2 text-sm font-black text-[color:var(--clay-text)]">Total ${Number(inv.total || 0).toFixed(2)}</p>
                                        </div>
                                        <ClayButton type="button" variant="primary" onClick={() => window.open(withAuthQuery(`/api/learner/download_invoice.php?id=${inv.id}`), '_blank')} className="w-full md:w-auto justify-center inline-flex items-center gap-2">
                                            <Download size={16} />
                                            Download PDF
                                        </ClayButton>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ClayCard>
                </div>
            </PageContainer>
        </ClayPageShell>
    );
};

export default ProfileClayView;
