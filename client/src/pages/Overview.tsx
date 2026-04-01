import React from 'react';
import { useProjects } from '../hooks/useProjects';
import { useTeamMembers } from '../hooks/useTeamMembers';
import { useAuthStore } from '../stores/authStore';

import type { ProjectListItem, TeamMember } from '../types';

// ─── helpers ────────────────────────────────────────────────────────────────

function isoToDate(iso: string | null): Date | null {
  if (!iso) return null;
  // Parse as local date (YYYY-MM-DD) to avoid timezone shifts
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

function weekBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  '#D4C5F9', '#B8D4F9', '#B8F4D4', '#F9D4C5', '#F9F4B8',
  '#C5D4F9', '#D4F9C5', '#F9C5D4',
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Compute a light tint bg + dark text from any client hex color
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function clientEventStyle(colorHex: string): { backgroundColor: string; color: string } {
  const rgb = hexToRgb(colorHex);
  if (!rgb) return { backgroundColor: '#F2EEE6', color: '#6B6860' };
  const { r, g, b } = rgb;
  const dr = Math.round(r * 0.42);
  const dg = Math.round(g * 0.42);
  const db = Math.round(b * 0.42);
  return {
    backgroundColor: `rgba(${r},${g},${b},0.14)`,
    color: `rgb(${dr},${dg},${db})`,
  };
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── sub-components ─────────────────────────────────────────────────────────

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg2)',
        borderRadius: 8,
        padding: '12px 14px',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>{label}</div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 500,
          lineHeight: 1.1,
          marginTop: 4,
          color: 'var(--text)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Tag({
  variant,
  children,
}: {
  variant: 'green' | 'amber' | 'grey' | 'blue';
  children: React.ReactNode;
}) {
  const styles: Record<string, React.CSSProperties> = {
    green:  { backgroundColor: '#E6F4EE', color: '#1A6E47' },
    amber:  { backgroundColor: '#FDF2E0', color: '#8A5A0A' },
    grey:   { backgroundColor: 'var(--bg2)', color: 'var(--text2)' },
    blue:   { backgroundColor: '#EAF0FC', color: '#1A3D82' },
  };
  return (
    <span
      style={{
        ...styles[variant],
        fontSize: 11,
        fontWeight: 500,
        padding: '2px 7px',
        borderRadius: 5,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        backgroundColor: avatarColor(name),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text)',
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  );
}

// ─── PostTeamAvailability ────────────────────────────────────────────────────

interface TeamMemberRow {
  name: string;
  discipline: string;
  status: 'available' | 'on-project';
  projectName?: string;
}

function PostTeamPanel({ projects, teamMembers }: { projects: ProjectListItem[]; teamMembers: TeamMember[] }) {
  // Build map: team_member_id → project name (from active project milestones)
  const assignedTo = new Map<string, string>();
  for (const p of projects) {
    if (p.status !== 'ACTIVE') continue;
    for (const m of p.milestones) {
      if (m.tm_assignee_id && !assignedTo.has(m.tm_assignee_id)) {
        assignedTo.set(m.tm_assignee_id, p.name);
      }
    }
  }

  const filteredMembers = teamMembers.filter((tm) => tm.post === true);

  if (filteredMembers.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>No post team members yet.</p>;
  }

  const members: TeamMemberRow[] = filteredMembers.map((tm) => ({
    name: tm.name,
    discipline: tm.title ?? '',
    status: assignedTo.has(tm.id) ? 'on-project' : 'available',
    projectName: assignedTo.get(tm.id),
  }));

  return <PostTeamList members={members} />;
}

function PostTeamList({ members }: { members: TeamMemberRow[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {members.map((m, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 0',
            borderBottom: i < members.length - 1 ? '0.5px solid var(--border)' : 'none',
          }}
        >
          <Avatar name={m.name} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, lineHeight: 1.3 }}>
              {m.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.3 }}>
              {m.discipline}
            </div>
          </div>
          {m.status === 'available' && <Tag variant="green">Available</Tag>}
          {m.status === 'on-project' && <Tag variant="amber">On project</Tag>}
        </div>
      ))}
    </div>
  );
}

// ─── ProductionSchedule ──────────────────────────────────────────────────────

interface MilestoneRow {
  endDate: Date;
  name: string;
  assigneeName: string;
  isDueToday: boolean;
  clientName: string;
  clientColorHex: string;
}

function shortDay(date: Date) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[date.getDay()]} ${date.getDate()}`;
}

function ProductionSchedule({ projects }: { projects: ProjectListItem[] }) {
  const { start, end } = weekBounds();
  const today = new Date(start);
  const rows: MilestoneRow[] = [];

  for (const p of projects) {
    if (p.status !== 'ACTIVE') continue;
    for (const m of p.milestones) {
      if (m.completed || !m.end_date) continue;
      const d = isoToDate(m.end_date);
      if (!d || d < start || d >= end) continue;
      rows.push({
        endDate: d,
        name: m.name,
        assigneeName: m.tm_assignee?.name ?? '—',
        isDueToday: d.toDateString() === today.toDateString(),
        clientName: p.client.name,
        clientColorHex: `#${p.client.color_hex}`,
      });
    }
  }

  // Group by client
  const grouped = new Map<string, { colorHex: string; rows: MilestoneRow[] }>();
  for (const r of rows) {
    if (!grouped.has(r.clientName)) {
      grouped.set(r.clientName, { colorHex: r.clientColorHex, rows: [] });
    }
    grouped.get(r.clientName)!.rows.push(r);
  }

  if (grouped.size === 0) {
    return (
      <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>
        No milestones due this week.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Array.from(grouped.entries()).map(([clientName, group]) => (
        <div key={clientName}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: group.colorHex, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{clientName}</span>
          </div>
          {group.rows.map((row, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
              <span style={{ fontSize: 12, color: 'var(--text2)', width: 48, flexShrink: 0 }}>{shortDay(row.endDate)}</span>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text2)', flexShrink: 0, opacity: 0.7 }}>{row.clientName}</span>
              <span style={{ fontSize: 12, color: 'var(--text2)', flexShrink: 0 }}>{row.assigneeName}</span>
              {row.isDueToday ? <Tag variant="amber">Due today</Tag> : <Tag variant="blue">Upcoming</Tag>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Calendar ────────────────────────────────────────────────────────────────

interface CalBar {
  eventId: string;
  name: string;
  clientName: string;
  rawHex: string; // raw color_hex without #
  isStart: boolean;
  isEnd: boolean;
}

function dateToKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildCalendarEvents(projects: ProjectListItem[]): Map<string, CalBar[]> {
  const map = new Map<string, CalBar[]>();
  for (const p of projects) {
    for (const m of p.milestones) {
      if (!m.end_date || m.completed) continue;
      const startDate = m.start_date ? isoToDate(m.start_date) : isoToDate(m.end_date);
      const endDate = isoToDate(m.end_date);
      if (!startDate || !endDate) continue;
      const startKey = dateToKey(startDate);
      const endKey = dateToKey(endDate);
      const cur = new Date(startDate);
      while (cur <= endDate) {
        const key = dateToKey(cur);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({
          eventId: m.id,
          name: m.name,
          clientName: p.client.name,
          rawHex: p.client.color_hex,
          isStart: key === startKey,
          isEnd: key === endKey,
        });
        cur.setDate(cur.getDate() + 1);
      }
    }
  }
  return map;
}

function CalendarGrid({ projects }: { projects: ProjectListItem[] }) {
  const now = new Date();
  const [viewYear, setViewYear] = React.useState(now.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(now.getMonth());

  const year = viewYear;
  const month = viewMonth;

  const prevMonth = () => { if (month === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const events = buildCalendarEvents(projects);

  // Unique clients for legend: name → raw hex
  const clientsMap = new Map<string, string>();
  for (const p of projects) {
    if (!clientsMap.has(p.client.name)) {
      clientsMap.set(p.client.name, p.client.color_hex);
    }
  }

  // Build grid cells: leading blanks + day cells
  const cells: Array<{ day: number | null; dateStr: string }> = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: null, dateStr: '' });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr });
  }
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push({ day: null, dateStr: '' });

  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div>
      {/* Header: title + legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
          <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--text2)', padding: '0 6px', lineHeight: 1 }}>‹</button>
          {MONTHS[month]} {year}
          <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: 'var(--text2)', padding: '0 6px', lineHeight: 1 }}>›</button>
        </span>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Array.from(clientsMap.entries()).map(([name, rawHex]) => {
            const evStyle = clientEventStyle(rawHex);
            return (
              <div
                key={name}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    backgroundColor: evStyle.backgroundColor,
                    border: `1px solid ${evStyle.color}44`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--text2)' }}>{name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Calendar table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            {DAYS_SHORT.map((d) => (
              <th
                key={d}
                style={{
                  backgroundColor: 'var(--bg2)',
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--text2)',
                  textAlign: 'center',
                  padding: '5px 0',
                  borderRight: '0.5px solid var(--border)',
                  borderBottom: '0.5px solid var(--border)',
                }}
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((cell, ci) => {
                const isToday = cell.dateStr === todayStr;
                const dayEvents = cell.dateStr ? (events.get(cell.dateStr) ?? []) : [];
                return (
                  <td
                    key={ci}
                    style={{
                      borderRight: '0.5px solid var(--border)',
                      borderBottom: '0.5px solid var(--border)',
                      minHeight: 62,
                      height: 62,
                      padding: '4px 4px',
                      fontSize: 11,
                      verticalAlign: 'top',
                      backgroundColor: cell.day ? '#FFFFFF' : 'var(--bg)',
                      overflow: 'visible',
                    }}
                  >
                    {cell.day !== null && (
                      <>
                        <div
                          style={{
                            fontWeight: isToday ? 700 : 400,
                            color: isToday ? 'var(--accent)' : 'var(--text2)',
                            marginBottom: 3,
                            lineHeight: 1.4,
                          }}
                        >
                          {isToday && (
                            <span style={{ marginRight: 2 }}>•</span>
                          )}
                          {cell.day}
                        </div>
                        {dayEvents.map((bar, ei) => {
                          const evStyle = clientEventStyle(bar.rawHex);
                          return (
                            <div
                              key={bar.eventId + ei}
                              title={bar.name}
                              style={{
                                height: 14,
                                ...evStyle,
                                borderRadius: bar.isStart && bar.isEnd
                                  ? 3
                                  : bar.isStart
                                  ? '3px 0 0 3px'
                                  : bar.isEnd
                                  ? '0 3px 3px 0'
                                  : 0,
                                marginBottom: 2,
                                marginLeft: bar.isStart ? 0 : -4,
                                marginRight: bar.isEnd ? 0 : -4,
                                display: 'flex',
                                alignItems: 'center',
                                paddingLeft: bar.isStart ? 4 : 0,
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                fontSize: 10,
                                fontWeight: 500,
                              }}
                            >
                              {bar.isStart ? bar.name : ''}
                            </div>
                          );
                        })}
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

// ─── Main ────────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
      <div
        style={{
          height: 20,
          width: 100,
          borderRadius: 6,
          backgroundColor: 'var(--bg2)',
          marginBottom: 16,
        }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: 74, borderRadius: 8, backgroundColor: 'var(--bg2)' }} />
        ))}
      </div>
      <div style={{ height: 200, borderRadius: 10, backgroundColor: 'var(--bg2)' }} />
    </div>
  );
}

export default function Overview() {
  const { data: projects, isLoading } = useProjects();
  const { data: teamMembers } = useTeamMembers();
  useAuthStore((s) => s.user);

  if (isLoading) return <LoadingSkeleton />;

  const allProjects: ProjectListItem[] = projects ?? [];
  const active = allProjects.filter((p) => p.status === 'ACTIVE');
  const allTeamMembers = teamMembers ?? [];

  const incompleteMilestones = active.reduce(
    (sum, p) => sum + p.milestones.filter((m) => !m.completed).length,
    0,
  );

  // Count team members not assigned to any active project milestone
  const assignedIds = new Set<string>();
  for (const p of active) {
    for (const m of p.milestones) {
      if (m.tm_assignee_id) assignedIds.add(m.tm_assignee_id);
    }
  }
  const postTeamAvailable = allTeamMembers.filter((tm) =>
    tm.post === true && !assignedIds.has(tm.id)
  ).length;

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    border: '0.5px solid var(--border)',
    borderRadius: 10,
    padding: '14px 16px',
  };

  return (
    <div>
      {/* Title */}
      <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 16, marginTop: 0, color: 'var(--text)' }}>
        Overview
      </h1>

      {/* Metric cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <MetricCard label="Active projects" value={active.length} />
        <MetricCard label="Milestones due this week" value={incompleteMilestones} />
        <MetricCard label="Post team available" value={postTeamAvailable} />
      </div>

      {/* Two-column row: Post team availability + Production schedule */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {/* Left: Post team availability */}
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
            Post team availability
          </div>
          <PostTeamPanel projects={allProjects} teamMembers={allTeamMembers} />
        </div>

        {/* Right: Production schedule this week */}
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
            Production schedule — this week
          </div>
          <ProductionSchedule projects={allProjects} />
        </div>
      </div>

      {/* Calendar */}
      <div style={cardStyle}>
        <CalendarGrid projects={allProjects} />
      </div>
    </div>
  );
}
