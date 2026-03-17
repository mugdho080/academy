import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Loader2, Save, Upload } from 'lucide-react';
import ResponsiveTable from '../../components/layout/ResponsiveTable';
import { useUiVariant } from '../../context/UiVariantContext';
import ClayToggle from '../../components/clay/ClayToggle';

const todayIso = () => new Date().toISOString().split('T')[0];
const pastIso = (days) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
};

const money = (value) => Number(value || 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
const tabs = ['create', 'draft', 'unpaid', 'paid', 'company'];

export default function Invoicing() {
    const location = useLocation();
    const navigate = useNavigate();
    const { variant, setVariant } = useUiVariant('admin');
    const isClay = variant === 'clay';
    const [tab, setTab] = useState(location.pathname === '/admin/company-settings' ? 'company' : 'create');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [note, setNote] = useState('');

    const [settings, setSettings] = useState(null);
    const [users, setUsers] = useState([]);
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [dateFrom, setDateFrom] = useState(pastIso(30));
    const [dateTo, setDateTo] = useState(todayIso());
    const [previewRows, setPreviewRows] = useState([]);

    const [invoices, setInvoices] = useState({ draft: [], unpaid: [], paid: [] });
    const [detail, setDetail] = useState(null);

    const allSelected = useMemo(
        () => users.length > 0 && users.length === selectedUserIds.length,
        [users.length, selectedUserIds.length]
    );

    const wrap = async (fn) => {
        setBusy(true);
        setError('');
        setNote('');
        try {
            await fn();
        } catch (err) {
            setError(err?.response?.data?.error || err.message || 'Unexpected error');
        } finally {
            setBusy(false);
        }
    };

    const loadSettings = async () => {
        const res = await axios.get('/api/admin/company_settings.php');
        if (!res.data?.success) throw new Error('Failed company settings');
        setSettings(res.data.settings);
    };

    const loadUsers = async () => {
        const res = await axios.get('/api/admin/invoice_eligible_users.php');
        if (!res.data?.success) throw new Error('Failed users');
        setUsers(res.data.users || []);
    };

    const loadInvoices = async (status) => {
        const res = await axios.get('/api/admin/get_invoices.php', { params: { status } });
        if (!res.data?.success) throw new Error(`Failed ${status} invoices`);
        setInvoices((prev) => ({ ...prev, [status]: res.data.invoices || [] }));
    };

    const loadDetail = async (id) => {
        const res = await axios.get('/api/admin/get_invoice_detail.php', { params: { id } });
        if (!res.data?.success) throw new Error('Failed invoice detail');
        setDetail({ invoice: res.data.invoice, items: res.data.items || [] });
    };

    useEffect(() => {
        wrap(async () => {
            await loadSettings();
            await loadUsers();
            await Promise.all([loadInvoices('draft'), loadInvoices('unpaid'), loadInvoices('paid')]);
        });
    }, []);

    useEffect(() => {
        setTab(location.pathname === '/admin/company-settings' ? 'company' : 'create');
    }, [location.pathname]);

    const toggleUser = (id) => {
        setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const preview = () => wrap(async () => {
        const res = await axios.post('/api/admin/generate_draft_invoices.php', {
            user_ids: selectedUserIds,
            date_from: dateFrom,
            date_to: dateTo,
            preview_only: true
        });
        if (!res.data?.success) throw new Error('Preview failed');
        setPreviewRows(res.data.preview || []);
        setNote(`Preview ready for ${res.data.preview?.length || 0} participant(s).`);
    });

    const generate = () => wrap(async () => {
        const res = await axios.post('/api/admin/generate_draft_invoices.php', {
            user_ids: selectedUserIds,
            date_from: dateFrom,
            date_to: dateTo
        });
        if (!res.data?.success) throw new Error('Generation failed');
        setNote(`Created ${res.data.created?.length || 0} draft invoice(s).`);
        await loadInvoices('draft');
        setTab('draft');
    });

    const saveInvoice = () => wrap(async () => {
        if (!detail) return;
        const res = await axios.post('/api/admin/update_invoice.php', {
            invoice_id: detail.invoice.id,
            ...detail.invoice,
            items: detail.items
        });
        if (!res.data?.success) throw new Error('Save failed');
        await Promise.all([loadInvoices('draft'), loadInvoices('unpaid'), loadInvoices('paid')]);
        await loadDetail(detail.invoice.id);
        setNote('Invoice saved.');
    });

    const moveStatus = (target) => wrap(async () => {
        if (!detail) return;
        const res = await axios.post('/api/admin/change_invoice_status.php', {
            invoice_id: detail.invoice.id,
            target_status: target
        });
        if (!res.data?.success) throw new Error('Status update failed');
        await Promise.all([loadInvoices('draft'), loadInvoices('unpaid'), loadInvoices('paid')]);
        await loadDetail(detail.invoice.id);
        setNote(`Invoice moved to ${target}.`);
    });

    const makePdf = () => wrap(async () => {
        if (!detail) return;
        const res = await axios.post('/api/admin/generate_invoice_pdf.php', { invoice_id: detail.invoice.id });
        if (!res.data?.success) throw new Error('PDF generation failed');
        await loadDetail(detail.invoice.id);
        setNote('PDF generated.');
    });

    const saveSettings = (evt) => wrap(async () => {
        evt.preventDefault();
        const res = await axios.post('/api/admin/company_settings.php', settings);
        if (!res.data?.success) throw new Error('Save settings failed');
        setSettings(res.data.settings);
        setNote('Company settings saved.');
    });

    const uploadLogo = (evt) => wrap(async () => {
        const file = evt.target.files?.[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('logo', file);
        const res = await axios.post('/api/admin/upload_company_logo.php', fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (!res.data?.success) throw new Error('Logo upload failed');
        await loadSettings();
        setNote('Logo uploaded.');
    });

    const setInvoiceField = (field, value) => setDetail((prev) => ({ ...prev, invoice: { ...prev.invoice, [field]: value } }));
    const setItemField = (idx, field, value) => setDetail((prev) => {
        const next = [...prev.items];
        next[idx] = { ...next[idx], [field]: value };
        if (field === 'quantity_hours' || field === 'rate') {
            const q = Number(next[idx].quantity_hours || 0);
            const r = Number(next[idx].rate || 0);
            next[idx].amount = Number((q * r).toFixed(2));
        }
        return { ...prev, items: next };
    });

    return (
        <div className={`min-h-screen p-3 sm:p-4 lg:p-6 ${isClay ? 'ui-variant-clay ui-admin-shell admin-page-shell' : 'bg-slate-50'}`}>
            <div className="max-w-7xl mx-auto space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3">
                        <button onClick={() => navigate('/admin')} className={`p-2 rounded-lg ${isClay ? 'ui-clay-button-secondary' : 'bg-white border border-slate-200'}`}><ArrowLeft size={18} /></button>
                        <div>
                            <h1 className={`text-xl sm:text-2xl font-black ${isClay ? 'ui-clay-heading' : 'text-slate-800'}`}>Goodwill Care Academy Invoicing</h1>
                            <p className={`text-sm ${isClay ? 'ui-clay-text-soft' : 'text-slate-500'}`}>Draft, Unpaid, Paid workflow with editable invoices.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                        <ClayToggle
                            label="Admin pages"
                            value={variant}
                            onChange={setVariant}
                            options={[
                                { label: 'Classic', value: 'classic' },
                                { label: 'Clay', value: 'clay' }
                            ]}
                            appearance={isClay ? 'clay' : 'classic'}
                        />
                        {busy && <div className={`text-sm flex items-center gap-2 ${isClay ? 'ui-clay-text-soft' : 'text-slate-500'}`}><Loader2 size={14} className="animate-spin" /> Processing</div>}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {tabs.map((t) => (
                        <button key={t} onClick={() => setTab(t)} className={`px-3 py-2.5 rounded-lg text-sm font-bold uppercase ${tab === t ? (isClay ? 'ui-clay-button-primary' : 'bg-[#00695C] text-white') : isClay ? 'ui-clay-button-secondary' : 'bg-white border border-slate-200 text-slate-600'}`}>{t}</button>
                    ))}
                </div>

                {note && <div className={`rounded-lg p-3 text-sm ${isClay ? 'ui-clay-chip-success' : 'bg-green-50 border border-green-200 text-green-700'}`}>{note}</div>}
                {error && <div className={`rounded-lg p-3 text-sm ${isClay ? 'ui-clay-chip-danger' : 'bg-red-50 border border-red-200 text-red-700'}`}>{error}</div>}

                {tab === 'create' && (
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
                        <div className={`rounded-2xl p-4 space-y-3 ${isClay ? 'ui-clay-surface' : 'bg-white border border-slate-100'}`}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`rounded-lg px-3 py-2.5 w-full ${isClay ? '' : 'border border-slate-200'}`} />
                                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`rounded-lg px-3 py-2.5 w-full ${isClay ? '' : 'border border-slate-200'}`} />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setSelectedUserIds(allSelected ? [] : users.map((u) => u.id))} className={`text-xs font-bold ${isClay ? 'text-[#21A7F1]' : 'text-[#00695C]'}`}>{allSelected ? 'Unselect All' : 'Select All'}</button>
                                <span className={`text-xs ${isClay ? 'ui-clay-text-soft' : 'text-slate-500'}`}>{selectedUserIds.length} selected</span>
                            </div>
                            <div className="max-h-72 overflow-auto space-y-1">
                                {users.map((u) => (
                                    <label key={u.id} className={`flex items-center justify-between rounded-lg px-3 py-2.5 gap-3 ${isClay ? 'ui-clay-inset-surface' : 'border border-slate-100'}`}>
                                        <div>
                                            <p className="font-bold text-sm">{u.name}</p>
                                            <p className="text-xs text-slate-500">{u.ndis_number}</p>
                                        </div>
                                        <input type="checkbox" checked={selectedUserIds.includes(u.id)} onChange={() => toggleUser(u.id)} className="w-5 h-5" />
                                    </label>
                                ))}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button onClick={preview} className="bg-slate-900 text-white px-4 py-3 rounded-lg text-sm font-bold">Preview</button>
                                <button onClick={generate} className="bg-[#00695C] text-white px-4 py-3 rounded-lg text-sm font-bold">Generate Drafts</button>
                            </div>
                        </div>
                        <div className="bg-white border border-slate-100 rounded-2xl p-4">
                            <h3 className="font-black text-sm text-slate-600 mb-2">Preview Summary</h3>
                            <ResponsiveTable className="border-slate-100">
                                <table className="w-full text-sm">
                                    <thead><tr className="text-slate-400 text-xs"><th className="text-left">Participant</th><th className="text-right">Hours</th><th className="text-right">Amount</th></tr></thead>
                                    <tbody>
                                        {previewRows.map((r) => (
                                            <tr key={r.user_id} className="border-t border-slate-100">
                                                <td className="py-2">{r.participant_name}</td>
                                                <td className="text-right">{Number(r.total_hours || 0).toFixed(2)}</td>
                                                <td className="text-right font-bold">{money(r.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </ResponsiveTable>
                        </div>
                    </div>
                )}

                {(tab === 'draft' || tab === 'unpaid' || tab === 'paid') && (
                    <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.2fr] gap-4">
                        <div className="bg-white border border-slate-100 rounded-2xl p-3 max-h-[65vh] lg:max-h-[75vh] overflow-auto space-y-2">
                            {(invoices[tab] || []).map((inv) => (
                                <button key={inv.id} onClick={() => wrap(() => loadDetail(inv.id))} className={`w-full text-left border rounded-xl p-3 ${detail?.invoice?.id === inv.id ? 'border-[#00695C] bg-[#e0f7fa]/40' : 'border-slate-100'}`}>
                                    <p className="font-black text-sm">{inv.invoice_number}</p>
                                    <p className="text-sm text-slate-500">{inv.participant_name}</p>
                                    <div className="flex justify-between text-xs text-slate-400 mt-1"><span>{inv.invoice_date}</span><span>{money(inv.total)}</span></div>
                                </button>
                            ))}
                        </div>
                        <div className="bg-white border border-slate-100 rounded-2xl p-4">
                            {!detail ? <p className="text-sm text-slate-500">Select an invoice.</p> : (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <input value={detail.invoice.invoice_number || ''} onChange={(e) => setInvoiceField('invoice_number', e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2.5" />
                                        <input type="date" value={detail.invoice.invoice_date || ''} onChange={(e) => setInvoiceField('invoice_date', e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2.5" />
                                        <input type="date" value={detail.invoice.due_date || ''} onChange={(e) => setInvoiceField('due_date', e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2.5" />
                                        <input value={detail.invoice.participant_name || ''} onChange={(e) => setInvoiceField('participant_name', e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2.5" />
                                    </div>
                                    {detail.items.map((item, idx) => (
                                        <div key={idx} className="border border-slate-100 rounded-xl p-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                                            <input value={item.line_item_code || ''} onChange={(e) => setItemField(idx, 'line_item_code', e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2.5" />
                                            <input type="number" step="0.01" value={item.quantity_hours || 0} onChange={(e) => setItemField(idx, 'quantity_hours', e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2.5" />
                                            <input type="number" step="0.01" value={item.rate || 0} onChange={(e) => setItemField(idx, 'rate', e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2.5" />
                                            <input value={item.line_item_description || ''} onChange={(e) => setItemField(idx, 'line_item_description', e.target.value)} className="md:col-span-3 border border-slate-200 rounded-lg px-3 py-2.5" />
                                        </div>
                                    ))}
                                    <textarea value={detail.invoice.notes || ''} onChange={(e) => setInvoiceField('notes', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 min-h-[70px]" placeholder="Notes" />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                        <button onClick={saveInvoice} className="bg-[#00695C] text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2"><Save size={15} /> Save</button>
                                        <button onClick={makePdf} className="bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-bold">Generate PDF</button>
                                        <button onClick={() => window.open(`/api/admin/download_invoice.php?id=${detail.invoice.id}`, '_blank')} className="bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2"><Download size={15} /> Download</button>
                                        {detail.invoice.status === 'draft' && <button onClick={() => moveStatus('unpaid')} className="bg-amber-500 text-white px-4 py-2.5 rounded-lg text-sm font-bold">Send to Unpaid</button>}
                                        {(detail.invoice.status === 'unpaid' || detail.invoice.status === 'sent' || detail.invoice.status === 'overdue') && <button onClick={() => moveStatus('paid')} className="bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-bold">Send to Paid</button>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {tab === 'company' && settings && (
                    <form onSubmit={saveSettings} className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input value={settings.company_name || ''} onChange={(e) => setSettings((s) => ({ ...s, company_name: e.target.value }))} placeholder="Company Name" className="border border-slate-200 rounded-lg px-3 py-2" />
                            <input value={settings.abn || ''} onChange={(e) => setSettings((s) => ({ ...s, abn: e.target.value }))} placeholder="ABN" className="border border-slate-200 rounded-lg px-3 py-2" />
                            <input value={settings.bsb || ''} onChange={(e) => setSettings((s) => ({ ...s, bsb: e.target.value }))} placeholder="BSB" className="border border-slate-200 rounded-lg px-3 py-2" />
                            <input value={settings.bank_account_number || ''} onChange={(e) => setSettings((s) => ({ ...s, bank_account_number: e.target.value }))} placeholder="Bank Account" className="border border-slate-200 rounded-lg px-3 py-2" />
                            <input value={settings.account_name || ''} onChange={(e) => setSettings((s) => ({ ...s, account_name: e.target.value }))} placeholder="Account Name" className="border border-slate-200 rounded-lg px-3 py-2" />
                            <input value={settings.invoice_prefix || ''} onChange={(e) => setSettings((s) => ({ ...s, invoice_prefix: e.target.value }))} placeholder="Invoice Prefix" className="border border-slate-200 rounded-lg px-3 py-2" />
                            <input type="number" step="0.01" value={settings.default_hourly_rate || 50} onChange={(e) => setSettings((s) => ({ ...s, default_hourly_rate: e.target.value }))} placeholder="Default Rate" className="border border-slate-200 rounded-lg px-3 py-2" />
                            <input value={settings.default_line_item_code || ''} onChange={(e) => setSettings((s) => ({ ...s, default_line_item_code: e.target.value }))} placeholder="Line Item Code" className="border border-slate-200 rounded-lg px-3 py-2" />
                        </div>
                        <textarea value={settings.address || ''} onChange={(e) => setSettings((s) => ({ ...s, address: e.target.value }))} placeholder="Address" className="w-full border border-slate-200 rounded-lg px-3 py-2 min-h-[80px]" />
                        <div className="flex flex-wrap gap-2 items-center">
                            <button type="submit" className="bg-[#00695C] text-white px-4 py-2.5 rounded-lg font-bold">Save</button>
                            <label className="inline-flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2.5 cursor-pointer">
                                <Upload size={14} /> Upload Logo
                                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} className="hidden" />
                            </label>
                            {settings.logo_path && <img src={settings.logo_path} alt="logo" className="h-10 object-contain border border-slate-200 rounded px-2" />}
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
