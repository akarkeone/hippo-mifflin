import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useProjects } from '../hooks/useProjects';
import { useClients } from '../hooks/useClients';
import { formatDate, formatCents, clientColor } from '../lib/format';
import api from '../lib/api';
import type { ProjectStatus } from '../types';

const STATUS_FILTERS: (ProjectStatus | 'ALL')[] = ['ALL', 'ACTIVE', 'PAUSED', 'COMPLETED'];
const CATEGORY_FILTERS = ['Food', 'Pets', 'CPG', 'Documentary'];

const STATUS_LABEL: Record<ProjectStatus | 'ALL', string> = {
  ALL: 'All',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
};

export default function Projects() {
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [newClientId, setNewClientId] = useState('');
  const [newName, setNewName] = useState('');
  const [newStatus, setNewStatus] = useState<ProjectStatus>('ACTIVE');
  const [newDueDate, setNewDueDate] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: projects, isLoading } = useProjects(
    statusFilter !== 'ALL' ? { status: statusFilter } : undefined,
  );
  const { data: clients } = useClients();

  const [createError, setCreateError] = useState('');

  const createProjectMutation = useMutation({
    mutationFn: (data: { client_id: string; name: string; status: ProjectStatus; due_date?: string }) =>
      api.post('/projects', data).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowNewProject(false);
      setNewName('');
      setNewDueDate('');
      setCreateError('');
      navigate(`/projects/${data.id}`);
    },
    onError: () => {
      setCreateError('Failed to create project. Please try again.');
    },
  });

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientId || !newName) return;
    createProjectMutation.mutate({
      client_id: newClientId,
      name: newName,
      status: newStatus,
      ...(newDueDate ? { due_date: newDueDate } : {}),
    });
  };

  const filtered = (projects ?? []).filter((p) => {
    if (categoryFilter && !p.categories.some((c) => c.category.name === categoryFilter))
      return false;
    if (
      search &&
      !p.name.toLowerCase().includes(search.toLowerCase()) &&
      !p.client.name.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const grouped = (clients ?? [])
    .map((client) => ({
      ...client,
      projects: filtered.filter((p) => p.client_id === client.id),
    }))
    .filter((g) => g.projects.length > 0);

  return (
    <div>
      {/* New Project Modal */}
      {showNewProject && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNewProject(false);
          }}
        >
          <div
            style={{
              background: 'var(--card)',
              borderRadius: 12,
              padding: '24px 26px',
              width: 420,
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 18 }}>
              New project
            </div>
            <form onSubmit={handleCreateProject}>
              {/* Client */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>
                  Client
                </label>
                <select
                  value={newClientId}
                  onChange={(e) => setNewClientId(e.target.value)}
                  required
                  style={{ width: '100%', background: 'var(--bg2)', border: '0.5px solid var(--border2)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                >
                  <option value="">Select client...</option>
                  {(clients ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {/* Name */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>
                  Project name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  placeholder="e.g. Summer Campaign :30"
                  style={{ width: '100%', background: 'var(--bg2)', border: '0.5px solid var(--border2)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              {/* Status */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>
                  Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as ProjectStatus)}
                  style={{ width: '100%', background: 'var(--bg2)', border: '0.5px solid var(--border2)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="PAUSED">Paused</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
              {/* Due date */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>
                  Due date (optional)
                </label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg2)', border: '0.5px solid var(--border2)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              {/* Error */}
              {createError && (
                <div style={{ fontSize: 12, color: '#C0352E', marginBottom: 10 }}>{createError}</div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowNewProject(false)}
                  style={{ background: 'var(--bg2)', border: '0.5px solid var(--border2)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: 'var(--text2)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProjectMutation.isPending}
                  style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 500, cursor: createProjectMutation.isPending ? 'not-allowed' : 'pointer', opacity: createProjectMutation.isPending ? 0.6 : 1 }}
                >
                  {createProjectMutation.isPending ? 'Creating...' : 'Create project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)' }}>Projects</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="text"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: 200,
              backgroundColor: 'var(--bg2)',
              border: '0.5px solid var(--border2)',
              borderRadius: 8,
              padding: '5px 10px',
              fontSize: 12,
              color: 'var(--text)',
              outline: 'none',
            }}
          />
          <button
            onClick={() => {
              setShowNewProject(true);
              setNewClientId(clients?.[0]?.id ?? '');
              setNewName('');
              setNewStatus('ACTIVE');
              setNewDueDate('');
              setCreateError('');
            }}
            style={{
              backgroundColor: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            + New project
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 18 }}>
        {STATUS_FILTERS.map((s) => {
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                background: active ? 'var(--text)' : 'var(--bg2)',
                color: active ? 'var(--bg)' : 'var(--text2)',
                border: `0.5px solid ${active ? 'var(--text)' : 'var(--border)'}`,
                borderRadius: 99,
                padding: '4px 12px',
                fontSize: 12,
                cursor: 'pointer',
                margin: '0 4px 6px 0',
                lineHeight: 1.4,
              }}
            >
              {STATUS_LABEL[s]}
            </button>
          );
        })}
        {CATEGORY_FILTERS.map((c) => {
          const active = categoryFilter === c;
          return (
            <button
              key={c}
              onClick={() => setCategoryFilter(active ? null : c)}
              style={{
                background: active ? 'var(--text)' : 'var(--bg2)',
                color: active ? 'var(--bg)' : 'var(--text2)',
                border: `0.5px solid ${active ? 'var(--text)' : 'var(--border)'}`,
                borderRadius: 99,
                padding: '4px 12px',
                fontSize: 12,
                cursor: 'pointer',
                margin: '0 4px 6px 0',
                lineHeight: 1.4,
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : grouped.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>No projects found</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {grouped.map((group) => (
            <div key={group.id}>
              {/* Section header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 10,
                  paddingBottom: 8,
                  borderBottom: '0.5px solid var(--border)',
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: clientColor(group.color_hex),
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>
                  {group.name}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {group.projects.length} project{group.projects.length !== 1 ? 's' : ''}
                </span>
                <span
                  onClick={() => {
                    setShowNewProject(true);
                    setNewClientId(group.id);
                    setNewName('');
                    setNewStatus('ACTIVE');
                    setNewDueDate('');
                    setCreateError('');
                  }}
                  style={{
                    marginLeft: 'auto',
                    fontSize: 12,
                    color: 'var(--text2)',
                    cursor: 'pointer',
                  }}
                >
                  + Add project
                </span>
              </div>

              {/* Project cards */}
              {group.projects.map((project) => {
                const totalBudget = project.budget_items.reduce((s, b) => s + b.amount_cents, 0);
                const done = project.milestones.filter((m) => m.completed).length;
                const total = project.milestones.length;
                const progress = total > 0 ? (done / total) * 100 : 0;
                const color = clientColor(project.client.color_hex);
                const cats = project.categories.map((c) => c.category.name).join(' · ');

                return (
                  <div
                    key={project.id}
                    onClick={() => navigate(`/projects/${project.id}`)}
                    style={{
                      background: '#ffffff',
                      border: '0.5px solid var(--border)',
                      borderRadius: 8,
                      padding: '12px 14px',
                      marginBottom: 7,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = 'var(--bg2)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background = '#ffffff';
                    }}
                  >
                    {/* Left */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          marginBottom: 3,
                          color: 'var(--text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {project.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text2)',
                          display: 'flex',
                          gap: 12,
                          marginBottom: 6,
                          flexWrap: 'wrap',
                        }}
                      >
                        {project.due_date && <span>Due {formatDate(project.due_date)}</span>}
                        {totalBudget > 0 && <span>{formatCents(totalBudget)}</span>}
                        {cats && <span>{cats}</span>}
                      </div>
                      {/* Progress bar */}
                      <div
                        style={{
                          height: 4,
                          background: 'var(--bg2)',
                          borderRadius: 2,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${progress}%`,
                            height: '100%',
                            backgroundColor: color,
                            opacity: 0.55,
                            borderRadius: 2,
                          }}
                        />
                      </div>
                    </div>

                    {/* Right */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      {/* Team avatars */}
                      {project.team_members.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {project.team_members.slice(0, 4).map((tm, idx) => (
                            <div
                              key={tm.user.id}
                              title={tm.user.name}
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: '50%',
                                background: 'var(--accent)',
                                color: '#fff',
                                fontSize: 10,
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1.5px solid #fff',
                                marginLeft: idx === 0 ? 0 : -6,
                                position: 'relative',
                                zIndex: project.team_members.length - idx,
                              }}
                            >
                              {tm.user.name.charAt(0).toUpperCase()}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Status badge */}
                      <StatusBadge status={project.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    ACTIVE: { bg: '#E6F4EE', color: '#1A6E47' },
    PAUSED: { bg: '#FDF2E0', color: '#8A5A0A' },
    COMPLETED: { bg: 'var(--bg2)', color: 'var(--text2)' },
  };
  const s = map[status] ?? map.ACTIVE;
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        borderRadius: 99,
        padding: '3px 10px',
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{ height: 64, borderRadius: 8, background: 'var(--bg2)', opacity: 0.6 }}
        />
      ))}
    </div>
  );
}
