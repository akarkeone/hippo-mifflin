import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useProject } from '../hooks/useProjects';
import { useAuthStore } from '../stores/authStore';
import { useTeamMembers } from '../hooks/useTeamMembers';
import { useCategories } from '../hooks/useCategories';
import { usePartners } from '../hooks/usePartners';
import { formatCents } from '../lib/format';
import api from '../lib/api';
import type { BudgetLineItem, ProjectStatus } from '../types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ─── card wrapper ─────────────────────────────────────────────────────────────

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '0.5px solid var(--border)',
        borderRadius: 10,
        padding: '16px 18px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── card header ─────────────────────────────────────────────────────────────

function CardHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{title}</span>
      {right && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{right}</div>}
    </div>
  );
}

// ─── inline editable amount ──────────────────────────────────────────────────

function EditableAmount({
  amountCents,
  onSave,
}: {
  amountCents: number;
  onSave: (cents: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const start = () => {
    setVal((amountCents / 100).toFixed(2));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = () => {
    const n = parseFloat(val);
    if (!isNaN(n)) onSave(Math.round(n * 100));
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        style={{
          width: 90,
          border: '1px solid var(--accent)',
          borderRadius: 4,
          padding: '1px 4px',
          fontSize: 13,
          outline: 'none',
          textAlign: 'right',
        }}
      />
    );
  }

  return (
    <span
      onClick={start}
      title="Click to edit"
      style={{
        borderBottom: '1px dashed rgba(0,0,0,.12)',
        cursor: 'text',
        padding: '1px 4px',
        fontSize: 13,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLSpanElement).style.borderBottomColor = 'var(--accent)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLSpanElement).style.borderBottomColor = 'rgba(0,0,0,.12)';
      }}
    >
      {formatCents(amountCents)}
    </span>
  );
}

// ─── inline editable text ────────────────────────────────────────────────────

function EditableText({
  value,
  onSave,
  placeholder = 'Add description…',
}: {
  value: string | null;
  onSave: (val: string) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    onSave(val);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        autoFocus
        style={{
          width: '100%',
          border: '1px solid var(--accent)',
          borderRadius: 4,
          padding: '1px 4px',
          fontSize: 12,
          outline: 'none',
          color: 'var(--text)',
          background: 'var(--card)',
        }}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      title="Click to edit"
      style={{
        display: 'block',
        borderBottom: '1px dashed rgba(0,0,0,.10)',
        cursor: 'text',
        padding: '1px 0',
        fontSize: 12,
        color: value ? 'var(--text2)' : 'var(--text3)',
        minHeight: 16,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLSpanElement).style.borderBottomColor = 'var(--accent)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLSpanElement).style.borderBottomColor = 'rgba(0,0,0,.10)';
      }}
    >
      {value || placeholder}
    </span>
  );
}

// ─── inline editable date ────────────────────────────────────────────────────

function EditableDate({
  iso,
  onSave,
  overdue,
}: {
  iso: string | null;
  onSave: (val: string) => void;
  overdue?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(iso ?? '');

  const commit = () => {
    if (val) onSave(val);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        type="date"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        autoFocus
        style={{
          border: '1px solid var(--accent)',
          borderRadius: 4,
          padding: '1px 4px',
          fontSize: 12,
          outline: 'none',
        }}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      style={{
        borderBottom: '1px dashed rgba(0,0,0,.12)',
        cursor: 'text',
        padding: '1px 2px',
        fontSize: 12,
        color: overdue ? '#8A5A0A' : undefined,
        fontWeight: overdue ? 500 : undefined,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLSpanElement).style.borderBottomColor = 'var(--accent)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLSpanElement).style.borderBottomColor = 'rgba(0,0,0,.12)';
      }}
    >
      {shortDate(iso)}
    </span>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: project, isLoading } = useProject(id!);
  const user = useAuthStore((s) => s.user);
  const { data: allTeamMembers } = useTeamMembers();
  const { data: allCategories } = useCategories();
  const { data: allPartners } = usePartners();
  // form state
  const [cadRate, setCadRate] = useState<number | null>(null);

  useEffect(() => {
    fetch('https://api.frankfurter.app/latest?from=USD&to=CAD')
      .then((r) => r.json())
      .then((data) => { if (data?.rates?.CAD) setCadRate(data.rates.CAD); })
      .catch(() => {});
  }, []);

  const [showAddLineItem, setShowAddLineItem] = useState(false);
  const [newLineLabel, setNewLineLabel] = useState('');
  const [newLineAmount, setNewLineAmount] = useState('');
  const [newLineDescription, setNewLineDescription] = useState('');

  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMsName, setNewMsName] = useState('');
  const [newMsAssignee, setNewMsAssignee] = useState('');
  const [newMsStart, setNewMsStart] = useState('');
  const [newMsEnd, setNewMsEnd] = useState('');

  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [editMsName, setEditMsName] = useState('');
  const [editMsAssignee, setEditMsAssignee] = useState('');
  const [editMsStart, setEditMsStart] = useState('');
  const [editMsEnd, setEditMsEnd] = useState('');

  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('');

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState('');

  const [showAddPartner, setShowAddPartner] = useState(false);
  const [newPartnerId, setNewPartnerId] = useState('');

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesVal, setNotesVal] = useState('');

  const [showAddAsset, setShowAddAsset] = useState(false);
  const [newAssetLabel, setNewAssetLabel] = useState('');
  const [newAssetUrl, setNewAssetUrl] = useState('');

  // role gates
  const canEditBudget = user?.role === 'EP' || user?.role === 'PRODUCER';
  const canViewBudget = canEditBudget || user?.role === 'ASSOC_PRODUCER';
  const canExport = canViewBudget;

  // status mutation
  const statusMutation = useMutation({
    mutationFn: (status: ProjectStatus) =>
      api.patch(`/projects/${id}`, { status }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  // budget item patch mutation — covers amount_cents, actuals_cents, description
  const budgetMutation = useMutation({
    mutationFn: ({ itemId, ...patch }: { itemId: string; label?: string; amount_cents?: number; actuals_cents?: number; description?: string }) =>
      api.patch(`/projects/${id}/budget/${itemId}`, patch).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
  });

  // milestone date mutation
  const milestoneMutation = useMutation({
    mutationFn: ({
      milestoneId,
      field,
      value,
    }: {
      milestoneId: string;
      field: 'start_date' | 'end_date';
      value: string;
    }) => api.patch(`/projects/${id}/milestones/${milestoneId}`, { [field]: value }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
  });

  // milestone toggle
  const milestoneToggle = useMutation({
    mutationFn: ({ milestoneId, completed }: { milestoneId: string; completed: boolean }) =>
      api.patch(`/projects/${id}/milestones/${milestoneId}`, { completed }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
  });

  // due date mutation
  const dueDateMutation = useMutation({
    mutationFn: (due_date: string | null) =>
      api.patch(`/projects/${id}`, { due_date }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  // add line item mutation
  const addLineItemMutation = useMutation({
    mutationFn: (data: { label: string; amount_cents: number; description?: string }) =>
      api.post(`/projects/${id}/budget`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setShowAddLineItem(false);
      setNewLineLabel('');
      setNewLineAmount('');
      setNewLineDescription('');
    },
  });

  const deleteLineItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      api.delete(`/projects/${id}/budget/${itemId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
  });

  const addAgencyFeeMutation = useMutation({
    mutationFn: () =>
      api.post(`/projects/${id}/budget`, { label: 'Agency fee', amount_cents: 0, is_agency_fee: true }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
  });

  // add milestone mutation
  const addMilestoneMutation = useMutation({
    mutationFn: (data: { name: string; tm_assignee_id?: string; start_date?: string; end_date?: string }) =>
      api.post(`/projects/${id}/milestones`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setShowAddMilestone(false);
      setNewMsName('');
      setNewMsAssignee('');
      setNewMsStart('');
      setNewMsEnd('');
    },
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: (milestoneId: string) =>
      api.delete(`/projects/${id}/milestones/${milestoneId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
  });

  const editMilestoneMutation = useMutation({
    mutationFn: ({ milestoneId, data }: { milestoneId: string; data: { name?: string; tm_assignee_id?: string | null; start_date?: string | null; end_date?: string | null } }) =>
      api.patch(`/projects/${id}/milestones/${milestoneId}`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setEditingMilestoneId(null);
    },
  });

  // add team member mutation (uses ProjectMember → TeamMember)
  const addMemberMutation = useMutation({
    mutationFn: (data: { team_member_id: string; role_label?: string }) =>
      api.post(`/projects/${id}/members`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setShowAddMember(false);
      setNewMemberId('');
      setNewMemberRole('');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) =>
      api.delete(`/projects/${id}/members/${memberId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
  });

  const addPartnerMutation = useMutation({
    mutationFn: (partner_id: string) =>
      api.post(`/projects/${id}/partners`, { partner_id }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setShowAddPartner(false);
      setNewPartnerId('');
    },
  });

  const removePartnerMutation = useMutation({
    mutationFn: (partnerId: string) =>
      api.delete(`/projects/${id}/partners/${partnerId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
  });

  // add category mutation
  const addCategoryMutation = useMutation({
    mutationFn: (category_id: string) =>
      api.post(`/projects/${id}/categories`, { category_id }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setShowAddCategory(false);
      setNewCategoryId('');
    },
  });

  const removeCategoryMutation = useMutation({
    mutationFn: (categoryId: string) =>
      api.delete(`/projects/${id}/categories/${categoryId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
  });

  const notesMutation = useMutation({
    mutationFn: (notes: string) =>
      api.patch(`/projects/${id}`, { notes }).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
  });

  const addAssetMutation = useMutation({
    mutationFn: (data: { label: string; url: string }) =>
      api.post(`/projects/${id}/assets`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      setShowAddAsset(false);
      setNewAssetLabel('');
      setNewAssetUrl('');
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (assetId: string) =>
      api.delete(`/projects/${id}/assets/${assetId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project', id] }),
  });

  if (isLoading) return <LoadingSkeleton />;
  if (!project) return <p style={{ color: 'var(--text3)' }}>Project not found</p>;

  // CAD formatter
  const toCad = (cents: number) =>
    cadRate
      ? new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format((cents / 100) * cadRate)
      : '—';

  // CSV download helpers
  const downloadBudgetCsv = () => {
    const pItems = project.budget_items.filter((b) => !b.is_agency_fee);
    const fee = project.budget_items.find((b) => b.is_agency_fee);
    const totalEst = project.budget_items.reduce((s, b) => s + b.amount_cents, 0);
    const totalAct = project.budget_items.reduce((s, b) => s + b.actuals_cents, 0);
    const subEst = pItems.reduce((s, b) => s + b.amount_cents, 0);
    const subAct = pItems.reduce((s, b) => s + b.actuals_cents, 0);
    const fmt = (cents: number) => (cents / 100).toFixed(2);
    const rem = (est: number, act: number) => ((est - act) / 100).toFixed(2);

    const header = ['Work Category', 'Description', 'Estimated (USD)', 'Actuals (USD)', 'Remaining (USD)', '% of total'];
    const rows: string[][] = [header];

    pItems.forEach((item) => {
      const pct = totalEst > 0 ? ((item.amount_cents / totalEst) * 100).toFixed(1) : '0';
      rows.push([
        item.label,
        item.description ?? '',
        fmt(item.amount_cents),
        fmt(item.actuals_cents),
        rem(item.amount_cents, item.actuals_cents),
        `${pct}%`,
      ]);
    });

    rows.push(['Production subtotal', '', fmt(subEst), fmt(subAct), rem(subEst, subAct), '']);

    if (fee) {
      const pct = totalEst > 0 ? ((fee.amount_cents / totalEst) * 100).toFixed(1) : '0';
      rows.push([fee.label, fee.description ?? '', fmt(fee.amount_cents), fmt(fee.actuals_cents), rem(fee.amount_cents, fee.actuals_cents), `${pct}%`]);
    }

    rows.push(['Total incl. agency fee (USD)', '', fmt(totalEst), fmt(totalAct), rem(totalEst, totalAct), '']);

    if (cadRate) {
      const cadEst = ((totalEst / 100) * cadRate).toFixed(2);
      const cadAct = ((totalAct / 100) * cadRate).toFixed(2);
      const cadRem = (((totalEst - totalAct) / 100) * cadRate).toFixed(2);
      rows.push([`Total CAD (1 USD = ${cadRate.toFixed(4)} CAD)`, '', cadEst, cadAct, cadRem, '']);
    }

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name} - Budget.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadMilestonesCsv = () => {
    const rows: string[][] = [['Milestone', 'Assignee', 'Start Date', 'End Date', 'Done']];
    project.milestones.forEach((m) => {
      rows.push([
        m.name,
        m.tm_assignee?.name ?? m.assignee?.name ?? '',
        m.start_date ? shortDate(m.start_date) : '',
        m.end_date ? shortDate(m.end_date) : '',
        m.completed ? 'Yes' : 'No',
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name} - Schedule.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const agencyFee = project.budget_items.find((b) => b.is_agency_fee);
  const productionItems = project.budget_items.filter((b) => !b.is_agency_fee);
  const productionSubtotal = productionItems.reduce((s, b) => s + b.amount_cents, 0);
  const productionActuals = productionItems.reduce((s, b) => s + b.actuals_cents, 0);
  const totalBudget = project.budget_items.reduce((s, b) => s + b.amount_cents, 0);
  const totalActuals = project.budget_items.reduce((s, b) => s + b.actuals_cents, 0);
  const cats = project.categories.map((c) => c.category.name).join(' · ');

  const statuses: ProjectStatus[] = ['ACTIVE', 'PAUSED', 'COMPLETED'];

  const exportHeaderRight = (onDownload: () => void) =>
    canExport ? (
      <button
        onClick={onDownload}
        style={{
          background: '#2D7A3A',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '4px 10px',
          fontSize: 11,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        ↓ Download CSV
      </button>
    ) : null;

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
        <span
          onClick={() => navigate('/projects')}
          style={{ cursor: 'pointer' }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLSpanElement).style.color = 'var(--accent)')
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLSpanElement).style.color = 'var(--text2)')
          }
        >
          Projects
        </span>
        <span style={{ margin: '0 4px' }}>›</span>
        <span
          onClick={() => navigate('/projects')}
          style={{ cursor: 'pointer' }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLSpanElement).style.color = 'var(--accent)')
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLSpanElement).style.color = 'var(--text2)')
          }
        >
          {project.client.name}
        </span>
        <span style={{ margin: '0 4px' }}>›</span>
        <span style={{ color: 'var(--text)' }}>{project.name}</span>
      </div>

      {/* Project name + meta */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 500,
            color: 'var(--text)',
            marginBottom: 4,
          }}
        >
          {project.name}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {project.client.name}
          {cats ? ` · ${cats}` : ''}
        </div>
      </div>

      {/* Status toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {statuses.map((s) => {
          const selected = project.status === s;
          return (
            <button
              key={s}
              onClick={() => statusMutation.mutate(s)}
              disabled={statusMutation.isPending}
              style={{
                padding: '4px 12px',
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                border: selected ? 'none' : '0.5px solid var(--border)',
                background: selected
                  ? s === 'ACTIVE'
                    ? '#E6F4EE'
                    : s === 'PAUSED'
                    ? '#FDF2E0'
                    : 'var(--bg2)'
                  : 'transparent',
                color: selected
                  ? s === 'ACTIVE'
                    ? '#1A6E47'
                    : s === 'PAUSED'
                    ? '#8A5A0A'
                    : 'var(--text2)'
                  : 'var(--text2)',
                transition: 'all 0.15s',
              }}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          );
        })}
      </div>

      {/* Due date row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 20,
          fontSize: 12,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text2)',
          }}
        >
          Due date
        </span>
        <EditableDate
          iso={project.due_date}
          onSave={(val) => dueDateMutation.mutate(val)}
        />
      </div>

      {/* Main grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) 260px',
          gap: 14,
          alignItems: 'start',
        }}
      >
        {/* ── LEFT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Budget Breakdown */}
          {canViewBudget && (
            <Card>
              <CardHeader
                title="Budget breakdown"
                right={
                  <>
                    {exportHeaderRight(downloadBudgetCsv)}
                    {canEditBudget && (
                      <span
                        onClick={() => setShowAddLineItem(true)}
                        style={{ fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}
                      >
                        + Add line item
                      </span>
                    )}
                  </>
                }
              />

              {/* Table — 6 columns: Work Category | Description | Estimated | Actuals | Remaining | % */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(80px,1.6fr) minmax(60px,1.2fr) 90px 90px 90px 58px',
                  gap: 0,
                }}
              >
                {/* Headers */}
                {['Work Category', 'Description', 'Estimated', 'Actuals', 'Remaining', '% of Total'].map((h, i) => (
                  <span
                    key={h}
                    style={{
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--text2)',
                      paddingBottom: 8,
                      borderBottom: '0.5px solid var(--border)',
                      textAlign: i >= 2 ? 'right' : 'left',
                      paddingRight: i >= 2 ? 4 : 0,
                    }}
                  >
                    {h}
                  </span>
                ))}

                {/* Production rows */}
                {productionItems.map((item) => {
                  const pct = totalBudget > 0 ? ((item.amount_cents / totalBudget) * 100).toFixed(1) : '0';
                  const remaining = item.amount_cents - item.actuals_cents;
                  return (
                    <BudgetRow
                      key={item.id}
                      label={canEditBudget ? <EditableText value={item.label} onSave={(val) => budgetMutation.mutate({ itemId: item.id, label: val })} /> : item.label}
                      description={
                        canEditBudget ? (
                          <EditableText
                            value={item.description}
                            onSave={(val) => budgetMutation.mutate({ itemId: item.id, description: val })}
                          />
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text2)' }}>{item.description ?? ''}</span>
                        )
                      }
                      estimated={
                        canEditBudget ? (
                          <EditableAmount
                            amountCents={item.amount_cents}
                            onSave={(cents) => budgetMutation.mutate({ itemId: item.id, amount_cents: cents })}
                          />
                        ) : (
                          <span style={{ fontSize: 13 }}>{formatCents(item.amount_cents)}</span>
                        )
                      }
                      actuals={
                        canEditBudget ? (
                          <EditableAmount
                            amountCents={item.actuals_cents}
                            onSave={(cents) => budgetMutation.mutate({ itemId: item.id, actuals_cents: cents })}
                          />
                        ) : (
                          <span style={{ fontSize: 13 }}>{formatCents(item.actuals_cents)}</span>
                        )
                      }
                      remaining={
                        <span style={{ fontSize: 13, color: remaining < 0 ? '#C0352E' : remaining === 0 ? 'var(--text2)' : '#1A6E47' }}>
                          {formatCents(Math.abs(remaining))}{remaining < 0 ? ' over' : ''}
                        </span>
                      }
                      pct={`${pct}%`}
                      onDelete={canEditBudget ? () => deleteLineItemMutation.mutate(item.id) : undefined}
                    />
                  );
                })}

                {/* Subtotal */}
                <SubtotalRow
                  label="Production subtotal"
                  estimated={formatCents(productionSubtotal)}
                  actuals={formatCents(productionActuals)}
                  remaining={formatCents(productionSubtotal - productionActuals)}
                />

                {/* Agency fee */}
                {agencyFee ? (
                  <AgencyFeeRow
                    item={agencyFee}
                    total={totalBudget}
                    canEdit={canEditBudget}
                    onSaveEstimated={(cents) => budgetMutation.mutate({ itemId: agencyFee.id, amount_cents: cents })}
                    onSaveActuals={(cents) => budgetMutation.mutate({ itemId: agencyFee.id, actuals_cents: cents })}
                  />
                ) : canEditBudget ? (
                  <span
                    style={{ fontSize: 12, color: 'var(--text2)', cursor: 'pointer', gridColumn: '1 / -1', padding: '4px 0' }}
                    onClick={() => addAgencyFeeMutation.mutate()}
                  >
                    + Add agency fee
                  </span>
                ) : null}

                {/* Grand total */}
                <TotalRow
                  label="Total incl. agency fee"
                  estimated={formatCents(totalBudget)}
                  actuals={formatCents(totalActuals)}
                  remaining={formatCents(totalBudget - totalActuals)}
                />

                {/* CAD conversion row */}
                {cadRate && (
                  <>
                    <span style={{ gridColumn: '1 / -1', borderTop: '0.5px dashed var(--border)', marginTop: 4, paddingTop: 6, fontSize: 11, color: 'var(--text3)' }}>
                      CAD equivalent <span style={{ opacity: 0.7 }}>· 1 USD = {cadRate.toFixed(4)} CAD (today's rate)</span>
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text2)', paddingBottom: 4 }}>Total incl. agency fee (CAD)</span>
                    <span />
                    <span style={{ fontSize: 11, color: 'var(--text2)', textAlign: 'right', paddingBottom: 4, paddingRight: 4 }}>{toCad(totalBudget)}</span>
                    <span style={{ fontSize: 11, color: 'var(--text2)', textAlign: 'right', paddingBottom: 4, paddingRight: 4 }}>{toCad(totalActuals)}</span>
                    <span style={{ fontSize: 11, color: 'var(--text2)', textAlign: 'right', paddingBottom: 4, paddingRight: 4 }}>{toCad(totalBudget - totalActuals)}</span>
                    <span />
                  </>
                )}
              </div>

              {/* Add line item form */}
              {showAddLineItem && (
                <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg2)', borderRadius: 8, border: '0.5px solid var(--border2)' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 10 }}>Add line item</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      placeholder="Work category (e.g. Director)"
                      value={newLineLabel}
                      onChange={(e) => setNewLineLabel(e.target.value)}
                      style={{ background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                    />
                    <input
                      type="number"
                      placeholder="Estimated ($)"
                      value={newLineAmount}
                      onChange={(e) => setNewLineAmount(e.target.value)}
                      style={{ background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={newLineDescription}
                    onChange={(e) => setNewLineDescription(e.target.value)}
                    style={{ width: '100%', background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--text)', outline: 'none', marginBottom: 10, boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => {
                        const amt = parseFloat(newLineAmount);
                        if (!newLineLabel || isNaN(amt)) return;
                        addLineItemMutation.mutate({
                          label: newLineLabel,
                          amount_cents: Math.round(amt * 100),
                          ...(newLineDescription ? { description: newLineDescription } : {}),
                        });
                      }}
                      disabled={addLineItemMutation.isPending}
                      style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                    >
                      {addLineItemMutation.isPending ? 'Adding...' : 'Add'}
                    </button>
                    <button
                      onClick={() => { setShowAddLineItem(false); setNewLineLabel(''); setNewLineAmount(''); setNewLineDescription(''); }}
                      style={{ background: 'transparent', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text2)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Production Schedule */}
          <Card>
            <CardHeader
              title="Production schedule"
              right={
                <>
                  {exportHeaderRight(downloadMilestonesCsv)}
                  <span
                    onClick={() => setShowAddMilestone(true)}
                    style={{ fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}
                  >
                    + Add milestone
                  </span>
                </>
              }
            />

            {/* Add milestone form */}
            {showAddMilestone && (
              <div style={{ marginBottom: 14, padding: '12px 14px', background: 'var(--bg2)', borderRadius: 8, border: '0.5px solid var(--border2)' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 10 }}>Add milestone</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                  <input
                    type="text"
                    placeholder="Milestone name"
                    value={newMsName}
                    onChange={(e) => setNewMsName(e.target.value)}
                    style={{ background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <select
                      value={newMsAssignee}
                      onChange={(e) => setNewMsAssignee(e.target.value)}
                      style={{ background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
                    >
                      <option value="">Assignee (optional)</option>
                      {(allTeamMembers ?? []).map((tm) => (
                        <option key={tm.id} value={tm.id}>{tm.name}</option>
                      ))}
                    </select>
                    <input type="date" value={newMsStart} onChange={(e) => setNewMsStart(e.target.value)} style={{ background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
                    <input type="date" value={newMsEnd} onChange={(e) => setNewMsEnd(e.target.value)} style={{ background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => {
                      if (!newMsName) return;
                      addMilestoneMutation.mutate({
                        name: newMsName,
                        ...(newMsAssignee ? { tm_assignee_id: newMsAssignee } : {}),
                        ...(newMsStart ? { start_date: newMsStart } : {}),
                        ...(newMsEnd ? { end_date: newMsEnd } : {}),
                      });
                    }}
                    disabled={addMilestoneMutation.isPending}
                    style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                  >
                    {addMilestoneMutation.isPending ? 'Adding...' : 'Add'}
                  </button>
                  <button
                    onClick={() => { setShowAddMilestone(false); setNewMsName(''); setNewMsAssignee(''); setNewMsStart(''); setNewMsEnd(''); }}
                    style={{ background: 'transparent', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text2)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {project.milestones.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text3)' }}>No milestones yet</p>
            ) : (
              <div>
                {/* Table header */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 20% 32% 44px 56px',
                    paddingBottom: 8,
                    borderBottom: '0.5px solid var(--border)',
                    marginBottom: 2,
                  }}
                >
                  {['Milestone', 'Assignee', 'Start → Due date', 'Done', ''].map((h) => (
                    <span
                      key={h}
                      style={{
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--text2)',
                        textAlign: h === 'Done' ? 'center' : undefined,
                      }}
                    >
                      {h}
                    </span>
                  ))}
                </div>
                {project.milestones.map((m) => {
                  const overdue =
                    !m.completed &&
                    m.end_date != null &&
                    new Date(m.end_date) < new Date();

                  return editingMilestoneId === m.id ? (
                    <div key={m.id} style={{ gridColumn: '1 / -1', padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
                        <input
                          type="text"
                          value={editMsName}
                          onChange={(e) => setEditMsName(e.target.value)}
                          style={{ background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
                        />
                        <select
                          value={editMsAssignee}
                          onChange={(e) => setEditMsAssignee(e.target.value)}
                          style={{ background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
                        >
                          <option value="">No assignee</option>
                          {(allTeamMembers ?? []).map((tm) => (
                            <option key={tm.id} value={tm.id}>{tm.name}</option>
                          ))}
                        </select>
                        <input type="date" value={editMsStart} onChange={(e) => setEditMsStart(e.target.value)} style={{ background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
                        <input type="date" value={editMsEnd} onChange={(e) => setEditMsEnd(e.target.value)} style={{ background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => editMilestoneMutation.mutate({ milestoneId: m.id, data: { name: editMsName || undefined, tm_assignee_id: editMsAssignee || null, start_date: editMsStart || null, end_date: editMsEnd || null } })}
                          disabled={editMilestoneMutation.isPending}
                          style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}
                        >Save</button>
                        <button onClick={() => setEditingMilestoneId(null)} style={{ background: 'transparent', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text2)' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={m.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 20% 32% 44px 56px',
                        alignItems: 'center',
                        padding: '6px 0',
                        borderBottom: '0.5px solid var(--border)',
                      }}
                    >
                      <span style={{ fontSize: 13, color: 'var(--text)', textDecoration: m.completed ? 'line-through' : 'none', opacity: m.completed ? 0.5 : 1 }}>{m.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--text2)' }}>{m.tm_assignee?.name ?? m.assignee?.name ?? '—'}</span>
                      <span style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <EditableDate iso={m.start_date} overdue={overdue} onSave={(v) => milestoneMutation.mutate({ milestoneId: m.id, field: 'start_date', value: v })} />
                        <span style={{ color: 'var(--text3)' }}>→</span>
                        <EditableDate iso={m.end_date} overdue={overdue} onSave={(v) => milestoneMutation.mutate({ milestoneId: m.id, field: 'end_date', value: v })} />
                      </span>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div
                          onClick={() => milestoneToggle.mutate({ milestoneId: m.id, completed: !m.completed })}
                          style={{ width: 14, height: 14, borderRadius: 3, border: m.completed ? 'none' : '1px solid var(--border2)', background: m.completed ? '#1A6E47' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {m.completed && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                        <span
                          onClick={() => { setEditingMilestoneId(m.id); setEditMsName(m.name); setEditMsAssignee(m.tm_assignee_id ?? ''); setEditMsStart(m.start_date?.split('T')[0] ?? ''); setEditMsEnd(m.end_date?.split('T')[0] ?? ''); }}
                          style={{ fontSize: 11, color: 'var(--text2)', cursor: 'pointer' }}
                          title="Edit"
                        >✎</span>
                        <span
                          onClick={() => deleteMilestoneMutation.mutate(m.id)}
                          style={{ fontSize: 13, color: 'var(--text2)', cursor: 'pointer', lineHeight: 1 }}
                          title="Delete"
                        >×</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Schedule Calendar */}
          <Card>
            <CardHeader title="Schedule calendar" />
            <MilestoneCalendar milestones={project.milestones} />
          </Card>

          {/* Deliverables & Notes */}
          <Card>
            <CardHeader
              title="Deliverables & Notes"
              right={
                !editingNotes ? (
                  <span onClick={() => { setEditingNotes(true); setNotesVal(project.notes ?? ''); }} style={{ fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>Edit</span>
                ) : undefined
              }
            />
            {editingNotes ? (
              <div>
                <textarea
                  value={notesVal}
                  onChange={(e) => setNotesVal(e.target.value)}
                  rows={6}
                  style={{ width: '100%', background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '8px 10px', fontSize: 13, color: 'var(--text)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 }}
                />
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button
                    onClick={() => { notesMutation.mutate(notesVal); setEditingNotes(false); }}
                    disabled={notesMutation.isPending}
                    style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                  >Save</button>
                  <button onClick={() => setEditingNotes(false)} style={{ background: 'transparent', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text2)' }}>Cancel</button>
                </div>
              </div>
            ) : project.notes ? (
              <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text2)', margin: 0, whiteSpace: 'pre-wrap' }}>{project.notes}</p>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0, cursor: 'pointer' }} onClick={() => { setEditingNotes(true); setNotesVal(''); }}>Click to add notes…</p>
            )}
          </Card>

          {/* Asset Links */}
          <Card>
            <CardHeader
              title="Asset links"
              right={
                <span onClick={() => setShowAddAsset(true)} style={{ fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>+ Add link</span>
              }
            />
            {project.assets.length === 0 && !showAddAsset ? (
              <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>No assets linked</p>
            ) : (
              <div>
                {project.assets.map((a, idx) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: idx < project.assets.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', flex: 1 }}>{a.label}</a>
                    <span onClick={() => deleteAssetMutation.mutate(a.id)} style={{ fontSize: 14, color: 'var(--text2)', cursor: 'pointer', lineHeight: 1 }}>×</span>
                  </div>
                ))}
              </div>
            )}
            {showAddAsset && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg2)', borderRadius: 8, border: '0.5px solid var(--border2)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                  <input type="text" placeholder="Label (e.g. Edit v1)" value={newAssetLabel} onChange={(e) => setNewAssetLabel(e.target.value)} style={{ background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
                  <input type="url" placeholder="URL (https://...)" value={newAssetUrl} onChange={(e) => setNewAssetUrl(e.target.value)} style={{ background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { if (!newAssetLabel || !newAssetUrl) return; addAssetMutation.mutate({ label: newAssetLabel, url: newAssetUrl }); }} disabled={addAssetMutation.isPending} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Add</button>
                  <button onClick={() => { setShowAddAsset(false); setNewAssetLabel(''); setNewAssetUrl(''); }} style={{ background: 'transparent', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text2)' }}>Cancel</button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Team */}
          <Card>
            <CardHeader title="Team" />
            {project.members.map((m, idx) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 0',
                  borderBottom: idx < project.members.length - 1 ? '0.5px solid var(--border)' : 'none',
                }}
              >
                <div
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'var(--accent)', color: '#fff',
                    fontSize: 11, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  {initials(m.team_member.name)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{m.team_member.name}</div>
                  {(m.role_label || m.team_member.title) && (
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>{m.role_label ?? m.team_member.title}</div>
                  )}
                </div>
                <span
                  onClick={() => removeMemberMutation.mutate(m.id)}
                  style={{ fontSize: 14, color: 'var(--text2)', cursor: 'pointer', lineHeight: 1 }}
                >×</span>
              </div>
            ))}
            <div
              onClick={() => setShowAddMember(true)}
              style={{ fontSize: 12, color: 'var(--text2)', cursor: 'pointer', marginTop: 10 }}
            >
              + Add team member
            </div>

            {showAddMember && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg2)', borderRadius: 8, border: '0.5px solid var(--border2)' }}>
                <select
                  value={newMemberId}
                  onChange={(e) => setNewMemberId(e.target.value)}
                  style={{ width: '100%', background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: 'var(--text)', outline: 'none', marginBottom: 6 }}
                >
                  <option value="">Select team member...</option>
                  {(allTeamMembers ?? [])
                    .filter((tm) => !project.members.some((m) => m.team_member_id === tm.id))
                    .map((tm) => (
                      <option key={tm.id} value={tm.id}>{tm.name}{tm.title ? ` · ${tm.title}` : ''}</option>
                    ))}
                </select>
                <input
                  type="text"
                  placeholder="Role label (optional)"
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  style={{ width: '100%', background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: 'var(--text)', outline: 'none', marginBottom: 8, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => { if (!newMemberId) return; addMemberMutation.mutate({ team_member_id: newMemberId, ...(newMemberRole ? { role_label: newMemberRole } : {}) }); }}
                    disabled={addMemberMutation.isPending}
                    style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                  >Add</button>
                  <button
                    onClick={() => { setShowAddMember(false); setNewMemberId(''); setNewMemberRole(''); }}
                    style={{ background: 'transparent', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text2)' }}
                  >Cancel</button>
                </div>
              </div>
            )}
          </Card>

          {/* Categories */}
          <Card>
            <CardHeader title="Categories" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {project.categories.map((c) => (
                <span key={c.category.id} style={{ background: 'var(--bg2)', color: 'var(--text2)', fontSize: 11, padding: '3px 8px 3px 10px', borderRadius: 99, border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {c.category.name}
                  <span onClick={() => removeCategoryMutation.mutate(c.category.id)} style={{ cursor: 'pointer', fontSize: 13, lineHeight: 1, color: 'var(--text3)' }}>×</span>
                </span>
              ))}
              <span
                onClick={() => setShowAddCategory(true)}
                style={{
                  background: 'var(--bg2)',
                  color: 'var(--text2)',
                  fontSize: 11,
                  padding: '3px 10px',
                  borderRadius: 99,
                  border: '0.5px dashed var(--border2)',
                  cursor: 'pointer',
                }}
              >
                + Add
              </span>
            </div>

            {/* Add category form */}
            {showAddCategory && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg2)', borderRadius: 8, border: '0.5px solid var(--border2)' }}>
                <select
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(e.target.value)}
                  style={{ width: '100%', background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: 'var(--text)', outline: 'none', marginBottom: 8 }}
                >
                  <option value="">Select category...</option>
                  {(allCategories ?? [])
                    .filter((c) => !project.categories.some((pc) => pc.category.id === c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => {
                      if (!newCategoryId) return;
                      addCategoryMutation.mutate(newCategoryId);
                    }}
                    disabled={addCategoryMutation.isPending}
                    style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setShowAddCategory(false); setNewCategoryId(''); }}
                    style={{ background: 'transparent', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text2)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Card>

          {/* Production Partner */}
          <Card>
            <CardHeader title="Production Partner" />
            {project.partners.map((pp) => {
              const ep = pp.partner.contacts?.[0];
              return (
                <div key={pp.partner.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--accent-light)', color: 'var(--accent)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {initials(pp.partner.company_name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div onClick={() => navigate(`/partners/${pp.partner.id}`)} style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)', cursor: 'pointer' }}>
                      {pp.partner.company_name}
                    </div>
                    {ep && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{ep.name}{ep.title ? ` · ${ep.title}` : ''}</div>}
                  </div>
                  <span onClick={() => removePartnerMutation.mutate(pp.partner.id)} style={{ fontSize: 14, color: 'var(--text2)', cursor: 'pointer', lineHeight: 1 }}>×</span>
                </div>
              );
            })}
            <div onClick={() => setShowAddPartner(true)} style={{ fontSize: 12, color: 'var(--text2)', cursor: 'pointer', marginTop: 4 }}>
              + Add partner
            </div>
            {showAddPartner && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg2)', borderRadius: 8, border: '0.5px solid var(--border2)' }}>
                <select
                  value={newPartnerId}
                  onChange={(e) => setNewPartnerId(e.target.value)}
                  style={{ width: '100%', background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: 'var(--text)', outline: 'none', marginBottom: 8 }}
                >
                  <option value="">Select partner...</option>
                  {(allPartners ?? [])
                    .filter((p) => !project.partners.some((pp) => pp.partner.id === p.id))
                    .map((p) => <option key={p.id} value={p.id}>{p.company_name}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { if (!newPartnerId) return; addPartnerMutation.mutate(newPartnerId); }} disabled={addPartnerMutation.isPending} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Add</button>
                  <button onClick={() => { setShowAddPartner(false); setNewPartnerId(''); }} style={{ background: 'transparent', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text2)' }}>Cancel</button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

    </div>
  );
}

// ─── milestone calendar ───────────────────────────────────────────────────────

const MONTHS2 = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS2 = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function MilestoneCalendar({ milestones }: { milestones: import('../types').Milestone[] }) {
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayStr = new Date().toISOString().split('T')[0];

  interface CalBar { name: string; isStart: boolean; isEnd: boolean }
  const eventMap = new Map<string, CalBar[]>();
  for (const m of milestones) {
    if (!m.end_date) continue;
    const startStr = (m.start_date ?? m.end_date).split('T')[0];
    const endStr = m.end_date.split('T')[0];
    const [sy, sm, sd] = startStr.split('-').map(Number);
    const [ey, em, ed] = endStr.split('-').map(Number);
    const cur = new Date(sy, sm - 1, sd);
    const endD = new Date(ey, em - 1, ed);
    while (cur <= endD) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
      if (!eventMap.has(key)) eventMap.set(key, []);
      eventMap.get(key)!.push({ name: m.name, isStart: key === startStr, isEnd: key === endStr });
      cur.setDate(cur.getDate() + 1);
    }
  }

  const cells: { day: number | null; dateStr: string }[] = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: null, dateStr: '' });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, dateStr: '' });
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{MONTHS2[viewMonth]} {viewYear}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text2)', padding: '0 4px' }}>‹</button>
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text2)', padding: '0 4px' }}>›</button>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            {DAYS2.map(d => (
              <th key={d} style={{ fontSize: 10, fontWeight: 500, color: 'var(--text2)', textAlign: 'center', padding: '4px 0', borderBottom: '0.5px solid var(--border)' }}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((cell, ci) => {
                const isToday = cell.dateStr === todayStr;
                const bars = cell.dateStr ? (eventMap.get(cell.dateStr) ?? []) : [];
                return (
                  <td key={ci} style={{ border: '0.5px solid var(--border)', height: 52, padding: '3px 4px', fontSize: 11, verticalAlign: 'top', backgroundColor: cell.day ? '#fff' : 'var(--bg)' }}>
                    {cell.day !== null && (
                      <>
                        <div style={{ fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--accent)' : 'var(--text2)', marginBottom: 2 }}>{cell.day}</div>
                        {bars.map((bar, ei) => (
                          <div key={ei} style={{
                            background: '#EEEDFE',
                            color: '#2E2880',
                            fontSize: 10,
                            borderRadius: bar.isStart && bar.isEnd ? 3 : bar.isStart ? '3px 0 0 3px' : bar.isEnd ? '0 3px 3px 0' : 0,
                            padding: '1px 4px',
                            marginBottom: 1,
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            marginLeft: bar.isStart ? 0 : -4,
                            marginRight: bar.isEnd ? 0 : -4,
                          }}>{bar.isStart ? bar.name : ''}</div>
                        ))}
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── budget table sub-components ─────────────────────────────────────────────

// ── 6-column budget row helpers ───────────────────────────────────────────────

const cellBorder: React.CSSProperties = { borderBottom: '0.5px solid var(--border)' };
const rAlign: React.CSSProperties = { textAlign: 'right', paddingRight: 4 };

function BudgetRow({
  label,
  description,
  estimated,
  actuals,
  remaining,
  pct,
  onDelete,
}: {
  label: React.ReactNode;
  description: React.ReactNode;
  estimated: React.ReactNode;
  actuals: React.ReactNode;
  remaining: React.ReactNode;
  pct: string;
  onDelete?: () => void;
}) {
  return (
    <>
      <span style={{ fontSize: 13, color: 'var(--text)', padding: '6px 0', ...cellBorder, display: 'flex', alignItems: 'center', gap: 6 }}>
        {onDelete && (
          <span onClick={onDelete} style={{ cursor: 'pointer', color: 'var(--text3)', fontSize: 14, lineHeight: 1, flexShrink: 0 }} title="Delete">×</span>
        )}
        {label}
      </span>
      <span style={{ fontSize: 12, color: 'var(--text2)', padding: '6px 4px', ...cellBorder }}>{description}</span>
      <span style={{ fontSize: 13, color: 'var(--text)', padding: '6px 0', ...cellBorder, ...rAlign }}>{estimated}</span>
      <span style={{ fontSize: 13, color: 'var(--text)', padding: '6px 0', ...cellBorder, ...rAlign }}>{actuals}</span>
      <span style={{ fontSize: 13, padding: '6px 0', ...cellBorder, ...rAlign }}>{remaining}</span>
      <span style={{ fontSize: 12, color: 'var(--text2)', padding: '6px 0', ...cellBorder, ...rAlign }}>{pct}</span>
    </>
  );
}

function SubtotalRow({
  label,
  estimated,
  actuals,
  remaining,
}: {
  label: string;
  estimated: string;
  actuals: string;
  remaining: string;
}) {
  const s: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--text2)', padding: '6px 0 4px' };
  return (
    <>
      <span style={s}>{label}</span>
      <span />
      <span style={{ ...s, color: 'var(--text)', ...rAlign }}>{estimated}</span>
      <span style={{ ...s, color: 'var(--text)', ...rAlign }}>{actuals}</span>
      <span style={{ ...s, color: 'var(--text)', ...rAlign }}>{remaining}</span>
      <span />
    </>
  );
}

function AgencyFeeRow({
  item,
  total,
  canEdit,
  onSaveEstimated,
  onSaveActuals,
}: {
  item: BudgetLineItem;
  total: number;
  canEdit: boolean;
  onSaveEstimated: (cents: number) => void;
  onSaveActuals: (cents: number) => void;
}) {
  const pct = total > 0 ? ((item.amount_cents / total) * 100).toFixed(1) : '0';
  const remaining = item.amount_cents - item.actuals_cents;
  const cellBase: React.CSSProperties = { background: '#EEEDFE', padding: '6px 4px', margin: '4px 0' };
  return (
    <>
      <span style={{ ...cellBase, borderRadius: '8px 0 0 8px', fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>
        {item.label}
        <span style={{ marginLeft: 6, background: '#CECBF6', color: '#2E2880', fontSize: 11, borderRadius: 99, padding: '1px 7px', fontWeight: 500 }}>
          {pct}%
        </span>
      </span>
      <span style={{ ...cellBase, fontSize: 12, color: 'var(--text2)' }}>{item.description ?? ''}</span>
      <span style={{ ...cellBase, fontSize: 13, fontWeight: 500, color: 'var(--accent)', ...rAlign }}>
        {canEdit ? <EditableAmount amountCents={item.amount_cents} onSave={onSaveEstimated} /> : formatCents(item.amount_cents)}
      </span>
      <span style={{ ...cellBase, fontSize: 13, fontWeight: 500, color: 'var(--accent)', ...rAlign }}>
        {canEdit ? <EditableAmount amountCents={item.actuals_cents} onSave={onSaveActuals} /> : formatCents(item.actuals_cents)}
      </span>
      <span style={{ ...cellBase, fontSize: 13, fontWeight: 500, color: remaining < 0 ? '#C0352E' : '#1A6E47', ...rAlign }}>
        {formatCents(Math.abs(remaining))}{remaining < 0 ? ' over' : ''}
      </span>
      <span style={{ ...cellBase, borderRadius: '0 8px 8px 0' }} />
    </>
  );
}

function TotalRow({
  label,
  estimated,
  actuals,
  remaining,
}: {
  label: string;
  estimated: string;
  actuals: string;
  remaining: string;
}) {
  const s: React.CSSProperties = { fontSize: 13, fontWeight: 500, padding: '8px 0 2px', borderTop: '0.5px solid var(--border)' };
  return (
    <>
      <span style={{ ...s, color: 'var(--text)' }}>{label}</span>
      <span style={{ ...s }} />
      <span style={{ ...s, color: 'var(--accent)', ...rAlign }}>{estimated}</span>
      <span style={{ ...s, color: 'var(--accent)', ...rAlign }}>{actuals}</span>
      <span style={{ ...s, color: 'var(--text2)', ...rAlign }}>{remaining}</span>
      <span style={{ ...s }} />
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ height: 20, width: 200, borderRadius: 4, background: 'var(--bg2)' }} />
      <div style={{ height: 28, width: 300, borderRadius: 4, background: 'var(--bg2)' }} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) 260px',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[200, 260, 100].map((h, i) => (
            <div
              key={i}
              style={{ height: h, borderRadius: 10, background: 'var(--bg2)', opacity: 0.6 }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[140, 80, 80].map((h, i) => (
            <div
              key={i}
              style={{ height: h, borderRadius: 10, background: 'var(--bg2)', opacity: 0.6 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
