import { useMemo, useState } from 'react';
import { useProjects } from '../hooks/useProjects';
import { useTeamMembers } from '../hooks/useTeamMembers';
import { clientColor } from '../lib/format';
import type { ProjectListItem, TeamMember } from '../types';

// ─── constants ───────────────────────────────────────────────────────────────

const CELL = 28; // px per day column
const LABEL_COL = 110; // px for the name label column

const AVATAR_COLORS = [
  '#C5B4F0', '#93C5FD', '#6EE7B7', '#FCA5A5', '#FCD34D',
  '#A5F3FC', '#F0ABFC', '#86EFAC', '#FDA4AF', '#BEF264',
];

function avatarBg(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function isoToLocal(iso: string): Date {
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Section 1: Post team workload ───────────────────────────────────────────

interface TaskEntry {
  milestoneId: string;
  name: string;
  projectName: string;
  clientName: string;
  colorHex: string; // raw hex without #
  startDate: string | null;
  endDate: string | null;
}

interface TeamMemberWorkload {
  tmId: string;
  name: string;
  avatarIndex: number;
  discipline: string;
  tasks: TaskEntry[];
  loadPct: number;
}

function capacityTag(loadPct: number): { label: string; bg: string; color: string } {
  if (loadPct >= 67) return { label: 'At capacity', bg: '#FDECEA', color: '#8A2020' };
  if (loadPct >= 34) return { label: 'On project', bg: '#FDF2E0', color: '#8A5A0A' };
  return { label: 'Available', bg: '#E6F4EE', color: '#1A6E47' };
}

function loadBarColor(loadPct: number): string {
  if (loadPct >= 67) return '#E53935';
  if (loadPct >= 34) return '#F59E0B';
  return '#22C55E';
}

function WorkloadSection({ projects, teamMembers }: { projects: ProjectListItem[]; teamMembers: TeamMember[] }) {
  const members = useMemo<TeamMemberWorkload[]>(() => {
    // Build milestone assignments: tm_id → TaskEntry[]
    const taskMap = new Map<string, TaskEntry[]>();
    for (const proj of projects) {
      const milestones = (proj as any).milestones ?? [];
      for (const ms of milestones) {
        const assigneeId = ms.tm_assignee?.id ?? ms.tm_assignee_id;
        if (!assigneeId) continue;
        if (!taskMap.has(assigneeId)) taskMap.set(assigneeId, []);
        taskMap.get(assigneeId)!.push({
          milestoneId: ms.id,
          name: ms.name,
          projectName: proj.name,
          clientName: proj.client.name,
          colorHex: proj.client.color_hex,
          startDate: ms.start_date ?? null,
          endDate: ms.end_date ?? null,
        });
      }
    }

    // List ALL post=true members
    const postMembers = teamMembers.filter((tm) => tm.post === true);
    return postMembers.map((tm, idx) => {
      const tasks = taskMap.get(tm.id) ?? [];
      const loadPct = tasks.length === 0 ? 0 : Math.min(100, Math.round((tasks.length / 4) * 100));
      return {
        tmId: tm.id,
        name: tm.name,
        avatarIndex: idx,
        discipline: tm.title ?? 'Post production',
        tasks,
        loadPct,
      };
    });
  }, [projects, teamMembers]);

  return (
    <div
      style={{
        backgroundColor: 'var(--card)',
        border: '0.5px solid var(--border)',
        borderRadius: 12,
        padding: '16px 18px 18px',
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 14 }}>
        Post team — current workload
      </div>

      {members.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>No post team members yet. Add members in Settings.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }}
        >
          {members.map((m) => (
            <MemberCard key={m.tmId} member={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberCard({ member }: { member: TeamMemberWorkload }) {
  const cap = capacityTag(member.loadPct);
  const barColor = loadBarColor(member.loadPct);
  const bg = avatarBg(member.avatarIndex);

  return (
    <div
      style={{
        backgroundColor: '#fff',
        border: '0.5px solid var(--border)',
        borderRadius: 8,
        padding: 13,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 600,
            color: '#2A2825',
            flexShrink: 0,
          }}
        >
          {initials(member.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {member.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>{member.discipline}</div>
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            backgroundColor: cap.bg,
            color: cap.color,
            borderRadius: 99,
            padding: '2px 8px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {cap.label}
        </div>
      </div>

      {/* Load bar */}
      <div
        style={{
          height: 5,
          backgroundColor: 'var(--bg2)',
          borderRadius: 3,
          marginTop: 7,
          marginBottom: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${member.loadPct}%`,
            backgroundColor: barColor,
            borderRadius: 3,
            opacity: 0.6,
          }}
        />
      </div>

      {/* Task count */}
      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: member.tasks.length > 0 ? 8 : 0 }}>
        {member.tasks.length === 0
          ? 'No active tasks'
          : `${member.tasks.length} active task${member.tasks.length !== 1 ? 's' : ''}`}
      </div>

      {/* Task list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {member.tasks.map((task) => (
          <div
            key={task.milestoneId}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
              padding: '5px 7px',
              backgroundColor: 'var(--bg)',
              borderRadius: 6,
              border: '0.5px solid var(--border)',
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: clientColor(task.colorHex),
                flexShrink: 0,
                marginTop: 3,
              }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {task.name}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text2)' }}>
                {task.projectName} · {task.clientName}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>
                {shortDate(task.startDate)} → {shortDate(task.endDate)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Section 2: Gantt ────────────────────────────────────────────────────────

interface GanttBar {
  id: string;
  label: string;
  color: string;
  startIdx: number;
  spanDays: number;
}

interface GanttRow {
  userId: string;
  name: string;
  role: string;
  avatarIndex: number;
  lanes: GanttBar[][];
}

interface DayInfo {
  date: Date;
  isWeekend: boolean;
  isToday: boolean;
  showLabel: boolean;
  labelText: string;
}

function buildDays(rangeStart: Date, totalDays: number): DayInfo[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const result: DayInfo[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    const isWeekendDay = dow === 0 || dow === 6;
    const isFirstOfMonth = d.getDate() === 1;
    const showLabel = !isWeekendDay;
    const labelText = isFirstOfMonth
      ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : String(d.getDate());
    result.push({
      date: d,
      isWeekend: dow === 0 || dow === 6,
      isToday: d.toDateString() === today.toDateString(),
      showLabel,
      labelText,
    });
  }
  return result;
}

function assignLanes(bars: GanttBar[]): GanttBar[][] {
  const lanes: GanttBar[][] = [];
  for (const bar of [...bars].sort((a, b) => a.startIdx - b.startIdx)) {
    let placed = false;
    for (const lane of lanes) {
      const last = lane[lane.length - 1];
      if (last.startIdx + last.spanDays <= bar.startIdx) {
        lane.push(bar);
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([bar]);
  }
  return lanes;
}

const DEFAULT_TOTAL_DAYS = 28; // 4-week default view

function GanttSection({ projects }: { projects: ProjectListItem[] }) {
  // offsetDays = how many days from today the view window starts
  // default: start 3 days before today so "today" sits near the left
  const [offsetDays, setOffsetDays] = useState(-3);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const rangeStart = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return d;
  }, [today, offsetDays]);

  const totalDays = DEFAULT_TOTAL_DAYS;
  const days = useMemo(() => buildDays(rangeStart, totalDays), [rangeStart, totalDays]);
  const todayIndex = useMemo(() => days.findIndex((d) => d.isToday), [days]);

  const dateRangeLabel = useMemo(() => {
    const s = days[0].date;
    const e = days[days.length - 1].date;
    const fmt = (d: Date, yr = false) =>
      d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        ...(yr ? { year: 'numeric' } : {}),
      });
    return `${fmt(s)} \u2013 ${fmt(e, true)}`;
  }, [days]);

  const rows = useMemo<GanttRow[]>(() => {
    const map = new Map<
      string,
      { name: string; role: string; avatarIndex: number; bars: GanttBar[] }
    >();
    let idx = 0;

    for (const proj of projects) {
      const color = clientColor(proj.client.color_hex);
      const milestones = (proj as any).milestones ?? [];

      for (const ms of milestones) {
        const assigneeId = ms.tm_assignee?.id ?? ms.tm_assignee_id ?? ms.assignee?.id ?? ms.assignee_id;
        if (!assigneeId || !ms.start_date || !ms.end_date) continue;

        if (!map.has(assigneeId)) {
          map.set(assigneeId, {
            name: ms.tm_assignee?.name ?? ms.assignee?.name ?? 'Unknown',
            role: 'Post',
            avatarIndex: idx++,
            bars: [],
          });
        }

        const start = isoToLocal(ms.start_date);
        const end = isoToLocal(ms.end_date);
        const startIdx = Math.round((start.getTime() - rangeStart.getTime()) / 86400000);
        const endIdx = Math.round((end.getTime() - rangeStart.getTime()) / 86400000);
        const clampedStart = Math.max(0, startIdx);
        const clampedEnd = Math.min(totalDays - 1, endIdx);
        if (clampedEnd < clampedStart) continue;

        map.get(assigneeId)!.bars.push({
          id: ms.id,
          label: ms.name,
          color,
          startIdx: clampedStart,
          spanDays: clampedEnd - clampedStart + 1,
        });
      }

      // Ensure all project members have a row even if no milestones yet
      const allMembers = (proj as any).members?.length ? (proj as any).members : proj.team_members.map((tm: any) => ({ team_member: { id: tm.user.id, name: tm.user.name } }));
      for (const m of allMembers) {
        const uid = m.team_member?.id ?? m.user?.id;
        const uname = m.team_member?.name ?? m.user?.name ?? 'Unknown';
        if (!uid || map.has(uid)) continue;
        map.set(uid, {
          name: uname,
          role: 'Post',
          avatarIndex: idx++,
          bars: [],
        });
      }
    }

    return Array.from(map.entries()).map(([userId, v]) => ({
      userId,
      name: v.name,
      role: v.role,
      avatarIndex: v.avatarIndex,
      lanes: assignLanes(v.bars),
    }));
  }, [projects, rangeStart, totalDays]);

  const totalWidth = totalDays * CELL;

  const navBtnStyle: React.CSSProperties = {
    background: 'var(--bg2)',
    border: '0.5px solid var(--border2)',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    color: 'var(--text2)',
    cursor: 'pointer',
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--card)',
        border: '0.5px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px 10px',
          borderBottom: '0.5px solid var(--border)',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
          Timeline — {dateRangeLabel}
        </div>
        {/* Navigation controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setOffsetDays((o) => o - 7)}
            style={navBtnStyle}
          >
            ‹ Prev week
          </button>
          {offsetDays !== -3 && (
            <button
              onClick={() => setOffsetDays(-3)}
              style={{ ...navBtnStyle, color: 'var(--accent)', borderColor: 'var(--accent)' }}
            >
              Today
            </button>
          )}
          <button
            onClick={() => setOffsetDays((o) => o + 7)}
            style={navBtnStyle}
          >
            Next week ›
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p style={{ padding: 16, fontSize: 12, color: 'var(--text3)', margin: 0 }}>
          No milestone data with assignees
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: LABEL_COL + totalWidth }}>
            {/* Date label row */}
            <div
              style={{
                display: 'flex',
                borderBottom: '0.5px solid var(--border)',
              }}
            >
              <div style={{ width: LABEL_COL, flexShrink: 0 }} />
              {days.map((d, i) => (
                <div
                  key={i}
                  style={{
                    width: CELL,
                    flexShrink: 0,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 2,
                    backgroundColor: d.isWeekend ? 'rgba(0,0,0,0.015)' : 'transparent',
                  }}
                >
                  {d.showLabel && (
                    <span
                      style={{
                        fontSize: 9,
                        color: d.isToday ? 'var(--accent)' : 'var(--text3)',
                        fontWeight: d.isToday ? 600 : 400,
                        whiteSpace: 'nowrap',
                        lineHeight: 1,
                      }}
                    >
                      {d.labelText}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Tick row */}
            <div
              style={{
                display: 'flex',
                borderBottom: '0.5px solid var(--border)',
                height: 6,
              }}
            >
              <div style={{ width: LABEL_COL, flexShrink: 0 }} />
              {days.map((d, i) => (
                <div
                  key={i}
                  style={{
                    width: CELL,
                    flexShrink: 0,
                    borderLeft: `0.5px solid ${d.isWeekend ? 'transparent' : 'var(--border)'}`,
                    backgroundColor: d.isWeekend ? 'rgba(0,0,0,0.025)' : 'transparent',
                  }}
                />
              ))}
            </div>

            {/* Person rows */}
            {rows.map((row) => {
              const laneCount = Math.max(row.lanes.length, 1);
              const rowHeight = laneCount * 20 + 12;
              return (
                <div
                  key={row.userId}
                  style={{
                    display: 'flex',
                    borderBottom: '0.5px solid var(--border)',
                    minHeight: rowHeight,
                  }}
                >
                  {/* Label column */}
                  <div
                    style={{
                      width: LABEL_COL,
                      flexShrink: 0,
                      padding: '6px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      borderRight: '0.5px solid var(--border)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: 'var(--text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {row.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{row.role}</div>
                  </div>

                  {/* Track area */}
                  <div
                    style={{
                      position: 'relative',
                      width: totalWidth,
                      flexShrink: 0,
                      minHeight: rowHeight,
                    }}
                  >
                    {/* Weekend shading */}
                    {days.map((d, i) => (
                      <div
                        key={i}
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: i * CELL,
                          width: CELL,
                          backgroundColor: d.isWeekend ? 'rgba(0,0,0,0.025)' : 'transparent',
                          borderLeft: `0.5px solid ${d.isWeekend ? 'transparent' : 'var(--border)'}`,
                        }}
                      />
                    ))}

                    {/* Today line */}
                    {todayIndex >= 0 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: todayIndex * CELL + CELL / 2,
                          width: 1,
                          backgroundColor: 'rgba(83,74,183,.5)',
                          zIndex: 4,
                          pointerEvents: 'none',
                        }}
                      />
                    )}

                    {/* Bars */}
                    {row.lanes.map((lane, laneIdx) =>
                      lane.map((bar) => (
                        <div
                          key={bar.id}
                          title={bar.label}
                          style={{
                            position: 'absolute',
                            top: laneIdx * 20 + 6,
                            left: bar.startIdx * CELL + 1,
                            width: Math.max(bar.spanDays * CELL - 2, CELL),
                            height: 12,
                            borderRadius: 3,
                            backgroundColor: bar.color,
                            opacity: 0.55,
                            display: 'flex',
                            alignItems: 'center',
                            paddingLeft: 4,
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            zIndex: 2,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 9,
                              color: '#fff',
                              fontWeight: 500,
                              // override parent opacity for text readability
                              filter: 'none',
                              mixBlendMode: 'normal',
                            }}
                          >
                            {bar.label}
                          </span>
                        </div>
                      )),
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Resourcing() {
  const { data: projects, isLoading } = useProjects({ status: 'ACTIVE' });
  const { data: teamMembers, isLoading: tmLoading } = useTeamMembers();

  if (isLoading || tmLoading) return <LoadingSkeleton />;

  const safeProjects = projects ?? [];
  const safeTeamMembers = teamMembers ?? [];

  return (
    <div>
      <h1
        style={{
          fontSize: 18,
          fontWeight: 500,
          color: 'var(--text)',
          marginBottom: 20,
          marginTop: 0,
        }}
      >
        Resourcing
      </h1>

      <WorkloadSection projects={safeProjects} teamMembers={safeTeamMembers} />
      <GanttSection projects={safeProjects} />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div>
      <div
        style={{
          height: 20,
          width: 120,
          borderRadius: 6,
          backgroundColor: 'var(--bg2)',
          marginBottom: 20,
        }}
      />
      <div
        style={{ height: 200, borderRadius: 12, backgroundColor: 'var(--bg2)', marginBottom: 12 }}
      />
      <div style={{ height: 300, borderRadius: 12, backgroundColor: 'var(--bg2)' }} />
    </div>
  );
}
