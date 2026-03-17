import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  ExternalLink,
  MapPinned,
  Search,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/lib/assets/MarkerCluster.css';
import 'react-leaflet-cluster/lib/assets/MarkerCluster.Default.css';
import marker2x from 'leaflet/dist/images/marker-icon-2x.png';
import marker from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let leafletIconConfigured = false;
function ensureLeafletIcon() {
  if (leafletIconConfigured) return;
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: marker2x,
    iconUrl: marker,
    shadowUrl: markerShadow
  });
  leafletIconConfigured = true;
}

const number = (value) => Number(value || 0).toLocaleString('en-AU');
const money = (value) => Number(value || 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
const pct = (value) => `${Number(value || 0).toFixed(1)}%`;

function TrendLabel({ value }) {
  const positive = Number(value || 0) >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <div className={`inline-flex items-center gap-1 text-xs font-bold ${positive ? 'text-emerald-700' : 'text-rose-700'}`}>
      <Icon size={12} />
      {pct(Math.abs(Number(value || 0)))} {positive ? 'up' : 'down'}
    </div>
  );
}

function MetricGrid({ items = [] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
          <p className="text-lg font-black text-slate-800 mt-1">{number(item.value)}</p>
        </div>
      ))}
    </div>
  );
}

function ListRows({ rows = [], empty = 'No data available.', renderRow }) {
  if (!rows.length) {
    return <p className="text-sm text-slate-500">{empty}</p>;
  }
  return <div className="space-y-2">{rows.map(renderRow)}</div>;
}

function TotalLearnersWidget({ data }) {
  return <MetricGrid items={data?.metrics || []} />;
}

function TrendValueWidget({ label, current, previous, delta }) {
  return (
    <div className="h-full flex flex-col justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{label}</p>
        <p className="text-4xl font-black text-slate-800 mt-2">{number(current)}</p>
      </div>
      <div className="space-y-1">
        <TrendLabel value={delta} />
        <p className="text-xs text-slate-500">Previous: {number(previous)}</p>
      </div>
    </div>
  );
}

function NewSignupsWidget({ data }) {
  return <TrendValueWidget label="New signups this week" current={data?.current} previous={data?.previous} delta={data?.delta_pct} />;
}

function WeeklyActiveLearnersWidget({ data }) {
  return <TrendValueWidget label="Active learners this week" current={data?.current} previous={data?.previous} delta={data?.delta_pct} />;
}

function WeeklyLearningHoursWidget({ data }) {
  return (
    <div className="h-full flex flex-col justify-between gap-2">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Learning hours this week</p>
        <p className="text-4xl font-black text-slate-800 mt-2">{Number(data?.hours || 0).toFixed(1)}h</p>
      </div>
      <div className="space-y-1">
        <TrendLabel value={data?.delta_pct} />
        <p className="text-xs text-slate-500">Previous: {Number(data?.previous_hours || 0).toFixed(1)}h</p>
      </div>
    </div>
  );
}

function PlatformCompletionWidget({ data }) {
  return (
    <MetricGrid
      items={[
        { label: 'Lessons', value: data?.lessons_completed || 0 },
        { label: 'Levels', value: data?.levels_completed || 0 },
        { label: 'Quizzes', value: data?.quizzes_completed || 0 }
      ]}
    />
  );
}

function PendingAgreementsWidget({ data, onOpenParticipant }) {
  return (
    <ListRows
      rows={data?.items || []}
      empty="No pending agreements."
      renderRow={(row) => (
        <div key={row.user_id} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-800">{row.name}</p>
              <p className="text-xs text-slate-500">NDIS {row.ndis_number}</p>
            </div>
            <button type="button" onClick={() => onOpenParticipant?.(row.user_id)} className="text-xs font-bold text-amber-800 hover:underline">
              Review
            </button>
          </div>
        </div>
      )}
    />
  );
}

function RecentlyRegisteredUsersWidget({ data }) {
  return (
    <ListRows
      rows={data?.items || []}
      empty="No recent registrations."
      renderRow={(row) => (
        <div key={row.user_id} className="rounded-xl border border-slate-200 px-3 py-2.5 bg-white">
          <p className="text-sm font-bold text-slate-800">{row.name}</p>
          <p className="text-xs text-slate-500">{row.ndis_number} | {row.status || 'new'}</p>
        </div>
      )}
    />
  );
}

function RecentlyActiveUsersWidget({ data }) {
  return (
    <ListRows
      rows={data?.items || []}
      empty="No recent activity."
      renderRow={(row) => (
        <div key={row.user_id} className="rounded-xl border border-slate-200 px-3 py-2.5 bg-slate-50">
          <p className="text-sm font-bold text-slate-800">{row.name}</p>
          <p className="text-xs text-slate-500">
            {row.last_active_label} | {row.last_visited_page || '/dashboard'}
          </p>
        </div>
      )}
    />
  );
}

function UsersRequiringAttentionWidget({ data, onOpenParticipant }) {
  return (
    <ListRows
      rows={data?.items || []}
      empty="No high-priority learners."
      renderRow={(row) => (
        <div key={row.user_id} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-800">{row.name}</p>
              <p className="text-xs text-slate-500">{(row.reasons || []).join(' | ')}</p>
            </div>
            <button type="button" onClick={() => onOpenParticipant?.(row.user_id)} className="text-xs font-bold text-rose-700 hover:underline">
              Open
            </button>
          </div>
        </div>
      )}
    />
  );
}

function LearnerQuickSearchWidget({ data, onOpenParticipant }) {
  const [term, setTerm] = useState('');
  const list = data?.items || [];
  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return list.slice(0, 8);
    return list.filter((item) => item.name?.toLowerCase().includes(q) || item.ndis_number?.toLowerCase().includes(q)).slice(0, 8);
  }, [list, term]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-3 text-slate-400" />
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-2.5 text-sm"
          placeholder="Search by name or NDIS number"
          aria-label="Search learner"
        />
      </div>
      <ListRows
        rows={filtered}
        empty="No matching learner."
        renderRow={(row) => (
          <button
            key={row.user_id}
            type="button"
            onClick={() => onOpenParticipant?.(row.user_id)}
            className="w-full text-left rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-100"
          >
            <p className="text-sm font-bold text-slate-800">{row.name}</p>
            <p className="text-xs text-slate-500">{row.ndis_number}</p>
          </button>
        )}
      />
    </div>
  );
}

function LearningTimeTrendWidget({ data }) {
  const series = data?.series || [];
  const maxHours = Math.max(1, ...series.map((item) => Number(item.hours || 0)));
  return (
    <div className="h-full flex flex-col justify-between gap-3">
      <div className="flex items-end gap-1 min-h-[140px]">
        {series.map((item) => (
          <div key={item.date} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full rounded-t bg-slate-700/80" style={{ height: `${Math.max(6, (Number(item.hours || 0) / maxHours) * 110)}px` }} />
            <span className="text-[10px] text-slate-500">{item.date?.slice(5)}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">Daily learning-hour trend over the last 14 days.</p>
    </div>
  );
}

function ChapterEngagementWidget({ data }) {
  const block = (title, rows) => (
    <div className="space-y-1.5">
      <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{title}</p>
      {(rows || []).map((row) => (
        <div key={`${title}-${row.chapter_id || row.title}`} className="rounded-lg bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700">
          {row.title}
        </div>
      ))}
      {!rows?.length ? <p className="text-xs text-slate-400">No data</p> : null}
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {block('Most Used', data?.most_used)}
      {block('Least Used', data?.least_used)}
      {block('Drop-Off', data?.drop_off)}
    </div>
  );
}

function WeeklyTargetCompletionWidget({ data }) {
  const total = Math.max(1, Number(data?.total || 0));
  const achievedPct = ((Number(data?.achieved || 0) / total) * 100).toFixed(0);
  const nearPct = ((Number(data?.near || 0) / total) * 100).toFixed(0);
  const farPct = ((Number(data?.far || 0) / total) * 100).toFixed(0);

  return (
    <div className="space-y-2">
      <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden flex">
        <span className="bg-emerald-500" style={{ width: `${achievedPct}%` }} />
        <span className="bg-amber-400" style={{ width: `${nearPct}%` }} />
        <span className="bg-rose-500" style={{ width: `${farPct}%` }} />
      </div>
      <MetricGrid
        items={[
          { label: 'Achieved', value: data?.achieved || 0 },
          { label: 'Near', value: data?.near || 0 },
          { label: 'Far', value: data?.far || 0 }
        ]}
      />
    </div>
  );
}

function AchievementSummaryWidget({ data }) {
  return (
    <MetricGrid
      items={[
        { label: 'Badges This Week', value: data?.badges_unlocked_week || 0 },
        { label: 'Average Points', value: data?.avg_points || 0 },
        { label: 'Rank Ups', value: data?.rank_up_count || 0 }
      ]}
    />
  );
}

function AtRiskLearnersWidget({ data, onOpenParticipant }) {
  return (
    <ListRows
      rows={data?.items || []}
      empty="No at-risk learners flagged."
      renderRow={(row) => (
        <div key={row.user_id} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-800">{row.name}</p>
              <p className="text-xs text-slate-500">{(row.flags || []).join(' | ')}</p>
            </div>
            <button type="button" onClick={() => onOpenParticipant?.(row.user_id)} className="text-xs font-bold text-rose-700 hover:underline">
              Open
            </button>
          </div>
        </div>
      )}
    />
  );
}

function FinanceKpiWidget({ title, value, subtitle }) {
  return (
    <div className="h-full flex flex-col justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        <p className="text-3xl font-black text-slate-800 mt-1">{value}</p>
      </div>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function DraftInvoicesWidget({ data }) {
  return <FinanceKpiWidget title="Draft invoices" value={number(data?.count)} subtitle={money(data?.total_amount)} />;
}

function UnpaidInvoicesWidget({ data }) {
  return <FinanceKpiWidget title="Unpaid invoices" value={number(data?.count)} subtitle={`${number(data?.overdue_count)} overdue | ${money(data?.total_amount)}`} />;
}

function PaidInvoicesWidget({ data }) {
  return <FinanceKpiWidget title="Paid this month" value={number(data?.count)} subtitle={money(data?.total_amount)} />;
}

function BillableHoursWidget({ data }) {
  return <FinanceKpiWidget title="Billable hours" value={`${Number(data?.hours || 0).toFixed(1)}h`} subtitle={`${data?.date_from || ''} to ${data?.date_to || ''}`} />;
}

function InvoiceStatusBreakdownWidget({ data }) {
  const total = Math.max(1, Number(data?.draft || 0) + Number(data?.unpaid || 0) + Number(data?.paid || 0));
  const bars = [
    { label: 'Draft', value: Number(data?.draft || 0), color: 'bg-slate-400' },
    { label: 'Unpaid', value: Number(data?.unpaid || 0), color: 'bg-amber-500' },
    { label: 'Paid', value: Number(data?.paid || 0), color: 'bg-emerald-500' }
  ];

  return (
    <div className="space-y-3">
      {bars.map((bar) => (
        <div key={bar.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>{bar.label}</span>
            <span className="font-bold">{bar.value}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full ${bar.color}`} style={{ width: `${(bar.value / total) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PandaCoachUsageWidget({ data }) {
  return (
    <MetricGrid
      items={[
        { label: 'Learners Using Panda', value: data?.active_learners || 0 },
        { label: 'Avg Interactions', value: data?.avg_interactions || 0 },
        { label: 'Lessons With Coach', value: data?.lessons_using_coach || 0 }
      ]}
    />
  );
}

function FrustrationAlertsWidget({ data, onOpenParticipant }) {
  return (
    <ListRows
      rows={data?.items || []}
      empty="No high frustration alerts."
      renderRow={(row) => (
        <div key={row.user_id} className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-800">{row.name}</p>
              <p className="text-xs text-slate-500">Frustration {row.frustration_score} | Engagement {row.engagement_score}</p>
            </div>
            <button type="button" onClick={() => onOpenParticipant?.(row.user_id)} className="text-xs font-bold text-orange-700 hover:underline">
              Open
            </button>
          </div>
        </div>
      )}
    />
  );
}

function RecommendationAcceptanceWidget({ data }) {
  return (
    <div className="h-full flex flex-col justify-between">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Acceptance Rate</p>
        <p className="text-4xl font-black text-slate-800 mt-2">{pct(data?.acceptance_rate || 0)}</p>
      </div>
      <p className="text-xs text-slate-500">{number(data?.accepted || 0)} accepted from {number(data?.total || 0)} recommendations</p>
    </div>
  );
}

function AuditActivityWidget({ data }) {
  return (
    <ListRows
      rows={data?.items || []}
      empty="No recent audit activity."
      renderRow={(row, idx) => (
        <div key={`${row.occurred_at}-${idx}`} className="rounded-xl border border-slate-200 px-3 py-2 bg-slate-50">
          <p className="text-sm font-bold text-slate-800">{row.action_label}</p>
          <p className="text-xs text-slate-500">{row.subject} | {row.detail}</p>
        </div>
      )}
    />
  );
}

function SecurityAlertsWidget({ data }) {
  return (
    <MetricGrid
      items={[
        { label: 'Failed Admin Logins', value: data?.failed_admin_logins || 0 },
        { label: 'Suspicious Logins', value: data?.suspicious_logins || 0 },
        { label: 'Locked Accounts', value: data?.locked_accounts || 0 }
      ]}
    />
  );
}

function BackupSystemHealthWidget({ data }) {
  const healthy = data?.database_status === 'Healthy';
  return (
    <div className="space-y-2">
      <div className={`rounded-xl border px-3 py-2 ${healthy ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
        <p className="text-xs text-slate-500">Database Status</p>
        <p className={`text-sm font-bold ${healthy ? 'text-emerald-700' : 'text-rose-700'}`}>{data?.database_status || 'Unknown'}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-xs text-slate-500">Backup Status</p>
        <p className="text-sm font-bold text-slate-700">{data?.backup_status || 'Unknown'}</p>
      </div>
      <p className="text-xs text-slate-500">Last backup: {data?.last_backup_at || 'No data'}</p>
    </div>
  );
}

function ConsentAgreementStatusWidget({ data }) {
  return (
    <MetricGrid
      items={[
        { label: 'Pending Agreement', value: data?.pending_agreement || 0 },
        { label: 'Signed, Not Approved', value: data?.signed_not_approved || 0 },
        { label: 'Missing Agreement', value: data?.missing_agreement || 0 }
      ]}
    />
  );
}

function UserLocationMapWidget({ data, settings, onSettingsChange, onOpenParticipant }) {
  ensureLeafletIcon();
  const [expanded, setExpanded] = useState(false);
  const filters = settings?.filters || {};
  const points = data?.points || [];

  const applyFilter = (key, value) => {
    const next = {
      ...settings,
      filters: {
        activity: 'all',
        agreement: 'all',
        age_group: 'all',
        engagement: 'all',
        date_from: '',
        date_to: '',
        ...filters,
        [key]: value
      }
    };
    onSettingsChange?.(next, { refresh: true });
  };

  const mapView = (heightClass) => (
    <div className={`rounded-xl border border-slate-200 overflow-hidden ${heightClass}`}>
      <MapContainer center={[-25.2744, 133.7751]} zoom={4} className="h-full w-full">
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MarkerClusterGroup chunkedLoading>
          {points.map((point) => (
            <Marker key={point.id} position={[point.lat, point.lng]}>
              <Popup>
                <div className="space-y-1 min-w-[190px]">
                  <p className="font-bold text-slate-800">{point.name}</p>
                  <p className="text-xs text-slate-600">{point.suburb}{point.postcode ? ` ${point.postcode}` : ''}</p>
                  <p className="text-xs text-slate-500">Status: {point.status} | {point.engagement_status}</p>
                  <p className="text-xs text-slate-500">Last active: {point.last_active_label}</p>
                  <button type="button" onClick={() => onOpenParticipant?.(point.id)} className="mt-1 text-xs font-bold text-slate-800 inline-flex items-center gap-1">
                    Open participant <ExternalLink size={12} />
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );

  return (
    <>
      <div className="space-y-2">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <select
            className="rounded-lg border border-slate-200 px-2 py-2 text-xs"
            value={filters.activity || 'all'}
            onChange={(event) => applyFilter('activity', event.target.value)}
            aria-label="Filter map by activity status"
          >
            <option value="all">All activity</option>
            <option value="active">Active users only</option>
            <option value="inactive">Inactive users</option>
          </select>
          <select
            className="rounded-lg border border-slate-200 px-2 py-2 text-xs"
            value={filters.agreement || 'all'}
            onChange={(event) => applyFilter('agreement', event.target.value)}
            aria-label="Filter map by agreement status"
          >
            <option value="all">All agreements</option>
            <option value="signed">Signed agreements</option>
            <option value="pending_approval">Pending approval</option>
            <option value="missing">Missing agreements</option>
          </select>
          <select
            className="rounded-lg border border-slate-200 px-2 py-2 text-xs"
            value={filters.age_group || 'all'}
            onChange={(event) => applyFilter('age_group', event.target.value)}
            aria-label="Filter map by age group"
          >
            <option value="all">All age groups</option>
            <option value="under_20">Under 20</option>
            <option value="age_20_40">20 to 40</option>
            <option value="age_40_plus">40 plus</option>
          </select>
          <select
            className="rounded-lg border border-slate-200 px-2 py-2 text-xs"
            value={filters.engagement || 'all'}
            onChange={(event) => applyFilter('engagement', event.target.value)}
            aria-label="Filter map by engagement level"
          >
            <option value="all">All engagement</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="risk">At risk</option>
          </select>
          <button type="button" onClick={() => setExpanded(true)} className="rounded-lg border border-slate-200 px-2 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">
            Expand Map
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input
            type="date"
            value={filters.date_from || ''}
            onChange={(event) => applyFilter('date_from', event.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-2 text-xs"
            aria-label="Date from filter"
          />
          <input
            type="date"
            value={filters.date_to || ''}
            onChange={(event) => applyFilter('date_to', event.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-2 text-xs"
            aria-label="Date to filter"
          />
          <button
            type="button"
            onClick={() => onSettingsChange?.({ ...settings, filters: { activity: 'all', agreement: 'all', age_group: 'all', engagement: 'all', date_from: '', date_to: '' } }, { refresh: true })}
            className="rounded-lg border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Clear filters
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600">Total {number(data?.summary?.total || 0)}</div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600">Signed {number(data?.summary?.signed || 0)}</div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600">Pending {number(data?.summary?.pending_approval || 0)}</div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600">Missing {number(data?.summary?.missing_agreement || 0)}</div>
        </div>

        {mapView('h-[260px]')}
      </div>

      {expanded ? (
        <div className="fixed inset-0 z-[90] bg-slate-900/50 p-4">
          <div className="h-full rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <p className="font-black text-slate-800 inline-flex items-center gap-2"><MapPinned size={16} /> User Location Map</p>
              <button type="button" onClick={() => setExpanded(false)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold hover:bg-slate-100">
                Close
              </button>
            </div>
            <div className="p-4 flex-1">{mapView('h-full')}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function QuickActionsWidget({ data, onNavigate }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {(data?.actions || []).map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => onNavigate?.(action.route)}
          className={`rounded-xl border px-3 py-2.5 text-left text-sm font-bold inline-flex items-center justify-between gap-2 ${action.type === 'primary' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
        >
          <span>{action.label}</span>
          <ArrowUpRight size={14} />
        </button>
      ))}
    </div>
  );
}

function NotesRemindersWidget({ settings, onSettingsChange }) {
  const note = settings?.note || '';
  return (
    <div className="space-y-2 h-full">
      <textarea
        value={note}
        onChange={(event) => onSettingsChange?.({ ...settings, note: event.target.value }, { refresh: false })}
        rows={7}
        className="w-full h-full min-h-[150px] rounded-xl border border-slate-200 px-3 py-2 text-sm resize-none"
        placeholder="Add reminders for approvals, follow-ups, and operational actions."
        aria-label="Dashboard notes and reminders"
      />
      <p className="text-xs text-slate-500">Saved when you click Save Layout in edit mode.</p>
    </div>
  );
}

function UnknownWidget() {
  return (
    <div className="h-full rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 flex items-center gap-2">
      <AlertTriangle size={14} />
      Widget component not available.
    </div>
  );
}

const WIDGET_COMPONENTS = {
  total_learners: TotalLearnersWidget,
  new_signups: NewSignupsWidget,
  weekly_active_learners: WeeklyActiveLearnersWidget,
  weekly_learning_hours: WeeklyLearningHoursWidget,
  platform_completion: PlatformCompletionWidget,
  pending_service_agreements: PendingAgreementsWidget,
  recently_registered_users: RecentlyRegisteredUsersWidget,
  recently_active_users: RecentlyActiveUsersWidget,
  users_requiring_attention: UsersRequiringAttentionWidget,
  learner_quick_search: LearnerQuickSearchWidget,
  learning_time_trend: LearningTimeTrendWidget,
  chapter_engagement: ChapterEngagementWidget,
  weekly_target_completion: WeeklyTargetCompletionWidget,
  achievement_summary: AchievementSummaryWidget,
  at_risk_learners: AtRiskLearnersWidget,
  draft_invoices: DraftInvoicesWidget,
  unpaid_invoices: UnpaidInvoicesWidget,
  paid_invoices: PaidInvoicesWidget,
  billable_hours: BillableHoursWidget,
  invoice_status_breakdown: InvoiceStatusBreakdownWidget,
  panda_coach_usage: PandaCoachUsageWidget,
  frustration_alerts: FrustrationAlertsWidget,
  recommendation_acceptance: RecommendationAcceptanceWidget,
  audit_activity: AuditActivityWidget,
  security_alerts: SecurityAlertsWidget,
  backup_system_health: BackupSystemHealthWidget,
  consent_agreement_status: ConsentAgreementStatusWidget,
  user_location_map: UserLocationMapWidget,
  quick_actions: QuickActionsWidget,
  notes_reminders: NotesRemindersWidget
};

export function WidgetRenderer({ widgetKey, data, settings, onSettingsChange, onOpenParticipant, onNavigate }) {
  const Component = WIDGET_COMPONENTS[widgetKey] || UnknownWidget;
  return (
    <Component
      data={data}
      settings={settings}
      onSettingsChange={onSettingsChange}
      onOpenParticipant={onOpenParticipant}
      onNavigate={onNavigate}
    />
  );
}

export function useAdminNavigation() {
  const navigate = useNavigate();
  return (path) => navigate(path);
}
