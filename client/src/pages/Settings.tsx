import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useUsers } from '../hooks/useUsers';
import api from '../lib/api';
import type { Role } from '../types';

const roleOptions: { value: Role; label: string }[] = [
  { value: 'EP', label: 'Executive Producer' },
  { value: 'PRODUCER', label: 'Producer' },
  { value: 'ASSOC_PRODUCER', label: 'Associate Producer' },
  { value: 'INTERN', label: 'Intern' },
];

const roleLabel = (role: Role) =>
  roleOptions.find((r) => r.value === role)?.label ?? role;

const levelBadgeStyle = (role: Role): React.CSSProperties => {
  if (role === 'EP') return { background: '#EEEDFE', color: '#2E2880' };
  if (role === 'PRODUCER') return { background: '#E6F4EE', color: '#1A6E47' };
  if (role === 'ASSOC_PRODUCER') return { background: '#FDF2E0', color: '#8A5A0A' };
  return { background: 'var(--bg2)', color: 'var(--text2)' };
};

const levelShortLabel = (role: Role) => {
  if (role === 'EP') return 'EP';
  if (role === 'PRODUCER') return 'Producer';
  if (role === 'ASSOC_PRODUCER') return 'Assoc. Producer';
  return 'Intern';
};

const defaultPermissionMatrix: [string, boolean, boolean, boolean, boolean][] = [
  ['View all projects', true, true, true, true],
  ['Create / edit projects', true, true, true, false],
  ['Delete projects', true, true, false, false],
  ['View budget breakdown', true, true, true, false],
  ['Edit budget', true, true, false, false],
  ['Export to Sheets / Drive', true, true, true, false],
  ['View production schedule', true, true, true, true],
  ['Edit production schedule', true, true, true, false],
  ['View resourcing', true, true, true, false],
  ['Edit resourcing', true, true, false, false],
  ['View partners', true, true, true, true],
  ['Add / edit partners', true, true, false, false],
  ['View performance ratings', true, true, false, false],
  ['Use Scout', true, true, true, false],
  ['Manage users / Settings', true, false, false, false],
];

const initials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

// ─── Manage Options Section ────────────────────────────────────────────────────

interface Category { id: string; name: string }
interface Client { id: string; name: string; color_hex: string }
interface TeamMember { id: string; name: string; title?: string | null; email?: string | null; post?: boolean }

function ManageOptionsSection({ cardStyle }: { cardStyle: React.CSSProperties }) {
  const queryClient = useQueryClient();

  // Team members — separate from Users (no login account created)
  const { data: teamMembers } = useQuery<TeamMember[]>({
    queryKey: ['team-members'],
    queryFn: () => api.get('/team-members').then((r) => r.data),
  });
  const [tmFirstName, setTmFirstName] = useState('');
  const [tmLastName, setTmLastName] = useState('');
  const [tmTitle, setTmTitle] = useState('');
  const [tmEmail, setTmEmail] = useState('');
  const [tmPost, setTmPost] = useState(false);
  const [showAddTm, setShowAddTm] = useState(false);
  const [editingTmId, setEditingTmId] = useState<string | null>(null);
  const [editTmName, setEditTmName] = useState('');
  const [editTmTitle, setEditTmTitle] = useState('');
  const [editTmEmail, setEditTmEmail] = useState('');
  const [editTmPost, setEditTmPost] = useState(false);

  const addTeamMemberMutation = useMutation({
    mutationFn: (data: { name: string; title?: string; email?: string; post?: boolean }) =>
      api.post('/team-members', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      setTmFirstName(''); setTmLastName(''); setTmTitle(''); setTmEmail(''); setTmPost(false); setShowAddTm(false);
    },
  });

  const updateTeamMemberMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; title?: string; email?: string; post?: boolean }) =>
      api.patch(`/team-members/${id}`, data).then((r) => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['team-members'] }); setEditingTmId(null); },
  });

  const deleteTeamMemberMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/team-members/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-members'] }),
  });

  // Categories
  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });
  const [newCategoryName, setNewCategoryName] = useState('');
  const addCategoryMutation = useMutation({
    mutationFn: (name: string) => api.post('/categories', { name }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setNewCategoryName('');
    },
  });
  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });

  // Clients
  const { data: clients } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients').then((r) => r.data),
  });
  const [newClientName, setNewClientName] = useState('');
  const [newClientColor, setNewClientColor] = useState('534AB7');
  const addClientMutation = useMutation({
    mutationFn: (data: { name: string; color_hex: string }) =>
      api.post('/clients', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setNewClientName('');
      setNewClientColor('534AB7');
    },
  });
  const deleteClientMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg2)',
    border: '0.5px solid var(--border2)',
    borderRadius: 8,
    padding: '7px 10px',
    fontSize: 13,
    color: 'var(--text)',
    outline: 'none',
  };

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>
        Manage menu options
      </div>
      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 18 }}>
        Add or remove items that appear in menus and filters across the app.
      </div>

      {/* Team members */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>Team members</div>
          {!showAddTm && (
            <span
              onClick={() => setShowAddTm(true)}
              style={{ fontSize: 12, color: 'var(--accent)', cursor: 'pointer' }}
            >
              + Add team member
            </span>
          )}
        </div>

        {/* Existing team members list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: showAddTm ? 12 : 0 }}>
          {(teamMembers ?? []).map((tm) => (
            editingTmId === tm.id ? (
              <div key={tm.id} style={{ padding: '12px 14px', background: 'var(--bg2)', borderRadius: 8, border: '0.5px solid var(--border2)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <input type="text" value={editTmName} onChange={(e) => setEditTmName(e.target.value)} placeholder="Full name" style={{ ...inputStyle, fontSize: 12, padding: '6px 10px', gridColumn: '1 / -1' }} />
                  <select value={editTmTitle} onChange={(e) => setEditTmTitle(e.target.value)} style={{ ...inputStyle, fontSize: 12, padding: '6px 10px', cursor: 'pointer' }}>
                    <option value="">Select title...</option>
                    <option value="Executive Producer">Executive Producer</option>
                    <option value="Producer">Producer</option>
                    <option value="Associate Producer">Associate Producer</option>
                    <option value="Creative Director">Creative Director</option>
                    <option value="Engagement Manager">Engagement Manager</option>
                    <option value="Editor">Editor</option>
                    <option value="VFX">VFX</option>
                    <option value="Animator">Animator</option>
                  </select>
                  <input type="email" value={editTmEmail} onChange={(e) => setEditTmEmail(e.target.value)} placeholder="Email (optional)" style={{ ...inputStyle, fontSize: 12, padding: '6px 10px' }} />
                  <select value={editTmPost ? 'yes' : 'no'} onChange={(e) => setEditTmPost(e.target.value === 'yes')} style={{ ...inputStyle, fontSize: 12, padding: '6px 10px', cursor: 'pointer' }}>
                    <option value="no">Post: No</option>
                    <option value="yes">Post: Yes</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => updateTeamMemberMutation.mutate({ id: tm.id, name: editTmName || tm.name, title: editTmTitle || undefined, email: editTmEmail || undefined, post: editTmPost })} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setEditingTmId(null)} style={{ background: 'transparent', border: '0.5px solid var(--border2)', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text2)' }}>Cancel</button>
                </div>
              </div>
            ) : (
            <div
              key={tm.id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'var(--bg2)', borderRadius: 8, border: '0.5px solid var(--border)' }}
            >
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'white', flexShrink: 0 }}>
                {tm.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{tm.name}</div>
                {tm.email && <div style={{ fontSize: 11, color: 'var(--text2)' }}>{tm.email}</div>}
              </div>
              {tm.title && <span style={{ fontSize: 11, background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 99, padding: '2px 8px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>{tm.title}</span>}
              {tm.post && <span style={{ fontSize: 11, background: '#E6F4EE', color: '#1A6E47', borderRadius: 99, padding: '2px 8px', whiteSpace: 'nowrap' }}>Post</span>}
              <button onClick={() => { setEditingTmId(tm.id); setEditTmName(tm.name); setEditTmTitle(tm.title ?? ''); setEditTmEmail(tm.email ?? ''); setEditTmPost(tm.post ?? false); }} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }} title="Edit">✎</button>
              <button onClick={() => deleteTeamMemberMutation.mutate(tm.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 15, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>×</button>
            </div>
            )
          ))}
          {(teamMembers ?? []).length === 0 && !showAddTm && (
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>No team members yet</span>
          )}
        </div>

        {/* Add team member form */}
        {showAddTm && (
          <div style={{ padding: '14px 16px', background: 'var(--bg2)', borderRadius: 8, border: '0.5px solid var(--border2)' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 10 }}>Add team member</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                placeholder="First name"
                value={tmFirstName}
                onChange={(e) => setTmFirstName(e.target.value)}
                style={{ ...inputStyle, fontSize: 12, padding: '6px 10px' }}
              />
              <input
                type="text"
                placeholder="Last name"
                value={tmLastName}
                onChange={(e) => setTmLastName(e.target.value)}
                style={{ ...inputStyle, fontSize: 12, padding: '6px 10px' }}
              />
              <select
                value={tmTitle}
                onChange={(e) => setTmTitle(e.target.value)}
                style={{ ...inputStyle, fontSize: 12, padding: '6px 10px', cursor: 'pointer' }}
              >
                <option value="">Select title...</option>
                <option value="Executive Producer">Executive Producer</option>
                <option value="Producer">Producer</option>
                <option value="Associate Producer">Associate Producer</option>
                <option value="Creative Director">Creative Director</option>
                <option value="Engagement Manager">Engagement Manager</option>
                <option value="Editor">Editor</option>
                <option value="VFX">VFX</option>
                <option value="Animator">Animator</option>
              </select>
              <input
                type="email"
                placeholder="Email (optional)"
                value={tmEmail}
                onChange={(e) => setTmEmail(e.target.value)}
                style={{ ...inputStyle, fontSize: 12, padding: '6px 10px' }}
              />
              <select value={tmPost ? 'yes' : 'no'} onChange={(e) => setTmPost(e.target.value === 'yes')} style={{ ...inputStyle, fontSize: 12, padding: '6px 10px', cursor: 'pointer' }}>
                <option value="no">Post: No</option>
                <option value="yes">Post: Yes</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  if (!tmFirstName && !tmLastName) return;
                  const name = [tmFirstName, tmLastName].filter(Boolean).join(' ');
                  addTeamMemberMutation.mutate({
                    name,
                    ...(tmTitle ? { title: tmTitle } : {}),
                    ...(tmEmail ? { email: tmEmail } : {}),
                    post: tmPost,
                  });
                }}
                disabled={addTeamMemberMutation.isPending || (!tmFirstName && !tmLastName)}
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '7px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  opacity: addTeamMemberMutation.isPending || (!tmFirstName && !tmLastName) ? 0.6 : 1,
                }}
              >
                {addTeamMemberMutation.isPending ? 'Adding...' : 'Add member'}
              </button>
              <button
                onClick={() => { setShowAddTm(false); setTmFirstName(''); setTmLastName(''); setTmTitle(''); setTmEmail(''); setTmPost(false); }}
                style={{
                  background: 'transparent',
                  border: '0.5px solid var(--border2)',
                  borderRadius: 8,
                  padding: '7px 16px',
                  fontSize: 13,
                  cursor: 'pointer',
                  color: 'var(--text2)',
                }}
              >
                Cancel
              </button>
            </div>
            {addTeamMemberMutation.isError && (
              <div style={{ fontSize: 12, color: '#C0352E', marginTop: 8 }}>
                Failed to add team member. Please try again.
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ borderTop: '0.5px solid var(--border)', marginBottom: 20 }} />

      {/* Categories */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 10 }}>
          Categories
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {categories?.map((c) => (
            <span
              key={c.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                background: 'var(--bg2)',
                border: '0.5px solid var(--border)',
                borderRadius: 6,
                padding: '3px 8px',
                color: 'var(--text)',
              }}
            >
              {c.name}
              <button
                onClick={() => {
                  if (confirm(`Delete category "${c.name}"?`)) deleteCategoryMutation.mutate(c.id);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: 'var(--text3)',
                  fontSize: 13,
                  lineHeight: 1,
                  marginLeft: 2,
                }}
              >
                ×
              </button>
            </span>
          ))}
          {(!categories || categories.length === 0) && (
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>No categories yet</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="New category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newCategoryName.trim()) {
                addCategoryMutation.mutate(newCategoryName.trim());
              }
            }}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={() => { if (newCategoryName.trim()) addCategoryMutation.mutate(newCategoryName.trim()); }}
            disabled={!newCategoryName.trim() || addCategoryMutation.isPending}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '7px 16px',
              fontSize: 13,
              fontWeight: 500,
              cursor: !newCategoryName.trim() || addCategoryMutation.isPending ? 'not-allowed' : 'pointer',
              opacity: !newCategoryName.trim() || addCategoryMutation.isPending ? 0.6 : 1,
            }}
          >
            Add
          </button>
        </div>
      </div>

      <div style={{ borderTop: '0.5px solid var(--border)', marginBottom: 20 }} />

      {/* Clients */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 10 }}>
          Clients
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {clients?.map((c) => (
            <span
              key={c.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                background: 'var(--bg2)',
                border: '0.5px solid var(--border)',
                borderRadius: 6,
                padding: '3px 8px',
                color: 'var(--text)',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: `#${c.color_hex}`,
                  flexShrink: 0,
                }}
              />
              {c.name}
              <button
                onClick={() => {
                  if (confirm(`Delete client "${c.name}"?`)) deleteClientMutation.mutate(c.id);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: 'var(--text3)',
                  fontSize: 13,
                  lineHeight: 1,
                  marginLeft: 2,
                }}
              >
                ×
              </button>
            </span>
          ))}
          {(!clients || clients.length === 0) && (
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>No clients yet</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Client name"
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text2)' }}>Color:</span>
            <input
              type="color"
              value={`#${newClientColor}`}
              onChange={(e) => setNewClientColor(e.target.value.replace('#', ''))}
              style={{ width: 32, height: 32, border: '0.5px solid var(--border2)', borderRadius: 6, cursor: 'pointer', padding: 2 }}
            />
          </div>
          <button
            onClick={() => {
              if (newClientName.trim()) {
                addClientMutation.mutate({ name: newClientName.trim(), color_hex: newClientColor });
              }
            }}
            disabled={!newClientName.trim() || addClientMutation.isPending}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '7px 16px',
              fontSize: 13,
              fontWeight: 500,
              cursor: !newClientName.trim() || addClientMutation.isPending ? 'not-allowed' : 'pointer',
              opacity: !newClientName.trim() || addClientMutation.isPending ? 0.6 : 1,
            }}
          >
            Add
          </button>
        </div>
      </div>

      <div style={{ borderTop: '0.5px solid var(--border)', marginBottom: 14 }} />

      {/* Specialities note */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
          Specialities
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>
          Specialities are managed per-partner. Open any partner in the Partners page to add or remove their specialities.
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function Settings() {
  const user = useAuthStore((s) => s.user);
  const { data: users } = useUsers();
  const queryClient = useQueryClient();
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('PRODUCER');
  const [permissionMatrix, setPermissionMatrix] = useState(defaultPermissionMatrix);

  const isEP = user?.role === 'EP';

  const togglePermission = (rowIdx: number, colIdx: number) => {
    setPermissionMatrix((prev) =>
      prev.map((row, ri) => {
        if (ri !== rowIdx) return row;
        const updated = [...row] as [string, boolean, boolean, boolean, boolean];
        updated[colIdx + 1] = !updated[colIdx + 1];
        return updated;
      }),
    );
  };

  const roleChangeMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      api.patch(`/users/${id}`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const inviteMutation = useMutation({
    mutationFn: ({ email, role, name }: { email: string; role: Role; name: string }) =>
      api.post('/users/invite', { email, role, name }),
    onSuccess: () => {
      setInviteFirstName('');
      setInviteLastName('');
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    const name = [inviteFirstName, inviteLastName].filter(Boolean).join(' ') || undefined;
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole, name: name ?? inviteEmail.split('@')[0] });
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--card)',
    border: '0.5px solid var(--border)',
    borderRadius: 10,
    padding: '18px 20px',
    marginBottom: 16,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg2)',
    border: '0.5px solid var(--border2)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    color: 'var(--text)',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    color: 'var(--text2)',
    textTransform: 'uppercase',
    letterSpacing: '.04em',
    marginBottom: 5,
  };

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Header */}
      <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>Settings</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
        Executive Producer — full access
      </div>

      {/* EP Badge */}
      {user && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--accent-light)',
            border: '0.5px solid rgba(83,74,183,.2)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 600,
              color: 'white',
              flexShrink: 0,
            }}
          >
            {initials(user.name)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{user.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>
              {user.email}{user.title ? ` · ${user.title}` : ` · ${roleLabel(user.role)}`}
            </div>
          </div>
          <span
            style={{
              ...levelBadgeStyle('EP'),
              borderRadius: 99,
              padding: '2px 10px',
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            EP
          </span>
        </div>
      )}

      {/* Users card */}
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>
          Users
        </div>
        <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 12, marginTop: -6 }}>
          Manage roles and access. Only Executive Producers can change permissions.
        </div>

        {/* Column headers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '32px 1fr 160px 100px 60px',
            gap: 12,
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text3)',
            paddingBottom: 6,
          }}
        >
          <div />
          <div>NAME</div>
          <div>ROLE</div>
          <div>TITLE</div>
          <div />
        </div>

        {users?.map((u) => (
          <div
            key={u.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr 160px 100px 60px',
              gap: 12,
              alignItems: 'center',
              padding: '10px 0',
              borderBottom: '0.5px solid var(--border)',
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 600,
                color: 'white',
                flexShrink: 0,
              }}
            >
              {initials(u.name)}
            </div>

            {/* Name + email */}
            <div>
              <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--text)' }}>{u.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>{u.email}</div>
            </div>

            {/* Role select */}
            <select
              value={u.role}
              onChange={(e) => roleChangeMutation.mutate({ id: u.id, role: e.target.value as Role })}
              disabled={u.id === user?.id}
              style={{
                background: 'var(--bg2)',
                border: '0.5px solid var(--border2)',
                borderRadius: 6,
                padding: '5px 8px',
                fontSize: 12,
                color: 'var(--text)',
                width: '100%',
                cursor: u.id === user?.id ? 'default' : 'pointer',
                outline: 'none',
              }}
            >
              {roleOptions.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>

            {/* Title badge */}
            <div>
              <span
                style={{
                  background: 'var(--bg2)',
                  color: 'var(--text2)',
                  borderRadius: 99,
                  padding: '2px 10px',
                  fontSize: 11,
                  fontWeight: 500,
                  display: 'inline-block',
                  border: '0.5px solid var(--border)',
                }}
              >
                {u.title || levelShortLabel(u.role)}
              </span>
            </div>

            {/* Remove / You */}
            <div style={{ fontSize: 12 }}>
              {u.id === user?.id ? (
                <span style={{ color: 'var(--text3)' }}>You</span>
              ) : (
                <button
                  onClick={() => removeMutation.mutate(u.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#C0352E',
                    fontSize: 12,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Invite new user card */}
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 12 }}>
          Invite new user
        </div>
        <form onSubmit={handleInvite}>
          {/* Name row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              marginBottom: 10,
            }}
          >
            <div>
              <label style={labelStyle}>FIRST NAME</label>
              <input
                type="text"
                value={inviteFirstName}
                onChange={(e) => setInviteFirstName(e.target.value)}
                placeholder="Jane"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>LAST NAME</label>
              <input
                type="text"
                value={inviteLastName}
                onChange={(e) => setInviteLastName(e.target.value)}
                placeholder="Smith"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Email + Role + Send row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr auto',
              gap: 10,
              alignItems: 'end',
            }}
          >
            {/* Email */}
            <div>
              <label style={labelStyle}>EMAIL</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                placeholder="email@company.com"
                style={inputStyle}
              />
            </div>

            {/* Role */}
            <div>
              <label style={labelStyle}>ROLE</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                style={{
                  ...inputStyle,
                  cursor: 'pointer',
                }}
              >
                {roleOptions.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Send invite button */}
            <button
              type="submit"
              disabled={inviteMutation.isPending}
              style={{
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '9px 18px',
                fontWeight: 500,
                fontSize: 13,
                cursor: inviteMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: inviteMutation.isPending ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {inviteMutation.isPending ? 'Sending...' : 'Send invite'}
            </button>
          </div>
        </form>
      </div>

      {/* Manage menu options — EP only */}
      {isEP && <ManageOptionsSection cardStyle={cardStyle} />}

      {/* Permission levels card — EP only */}
      {isEP && (
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4 }}>
            Permission levels
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 14 }}>
            What each role can see and do across Hippo. Click checkboxes to toggle.
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)' }}>
                <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 500 }}>Feature</th>
                <th style={{ textAlign: 'center', paddingBottom: 8, fontWeight: 500 }}>EP</th>
                <th style={{ textAlign: 'center', paddingBottom: 8, fontWeight: 500 }}>Producer</th>
                <th style={{ textAlign: 'center', paddingBottom: 8, fontWeight: 500 }}>Assoc. Prod.</th>
                <th style={{ textAlign: 'center', paddingBottom: 8, fontWeight: 500 }}>Intern</th>
              </tr>
            </thead>
            <tbody>
              {permissionMatrix.map(([feature, ep, producer, assoc, intern], rowIdx) => {
                const isHighlighted = feature === 'View performance ratings';
                return (
                  <tr
                    key={feature}
                    style={{
                      borderTop: '0.5px solid var(--border)',
                      background: isHighlighted ? 'var(--accent-light)' : 'transparent',
                    }}
                  >
                    <td
                      style={{
                        padding: '7px 0',
                        fontSize: 12,
                        color: 'var(--text)',
                        fontWeight: isHighlighted ? 500 : 400,
                      }}
                    >
                      {feature}
                    </td>
                    {[ep, producer, assoc, intern].map((allowed, colIdx) => (
                      <td key={colIdx} style={{ textAlign: 'center', padding: '7px 0' }}>
                        <span
                          onClick={() => togglePermission(rowIdx, colIdx)}
                          title="Click to toggle"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 16,
                            height: 16,
                            borderRadius: 4,
                            background: allowed ? '#E6F4EE' : 'var(--bg2)',
                            border: `0.5px solid ${allowed ? '#1A6E47' : 'var(--border2)'}`,
                            fontSize: 10,
                            color: allowed ? '#1A6E47' : 'var(--text3)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            userSelect: 'none',
                          }}
                        >
                          {allowed ? '✓' : ''}
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
