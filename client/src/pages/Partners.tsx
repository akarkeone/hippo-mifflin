import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePartners, usePartner, usePartnerRatings } from '../hooks/usePartners';
import { useAuthStore } from '../stores/authStore';
import { useCategories } from '../hooks/useCategories';
import api from '../lib/api';
import type { Partner, PartnerRating, ProjectSummary } from '../types';

// ─── constants ───────────────────────────────────────────────────────────────

// Category filters are loaded dynamically from the DB

const AVATAR_LIGHT = '#E0DCFF';
const AVATAR_TEXT = '#2E2880';

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function avgRating(ratings: PartnerRating[]): number | null {
  if (!ratings || ratings.length === 0) return null;
  const total = ratings.reduce(
    (s, r) =>
      s + (r.speed_efficiency + r.budget_flexibility + r.creativity + r.onset_performance) / 4,
    0,
  );
  return Math.round((total / ratings.length) * 10) / 10;
}

// ─── PartnerRow (left list item) ─────────────────────────────────────────────

function PartnerRow({
  partner,
  selected,
  onClick,
  canSeeRating,
}: {
  partner: Partner;
  selected: boolean;
  onClick: () => void;
  canSeeRating: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: '12px 13px',
        backgroundColor: selected || hovered ? 'var(--bg2)' : 'var(--card)',
        border: `0.5px solid ${selected ? 'var(--border2)' : 'var(--border)'}`,
        borderRadius: 8,
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'background-color 0.1s',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          backgroundColor: AVATAR_LIGHT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 500,
          color: AVATAR_TEXT,
          flexShrink: 0,
        }}
      >
        {initials(partner.company_name)}
      </div>

      {/* Main content */}
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
          {partner.company_name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
          {[partner.type, `${partner.project_count ?? 0} project${(partner.project_count ?? 0) !== 1 ? 's' : ''}`]
            .filter(Boolean)
            .join(' · ')}
        </div>
        {/* Tags */}
        {(partner.specialities?.length > 0 || partner.categories?.length > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {partner.specialities?.map((s) => (
              <span
                key={s.id}
                style={{
                  fontSize: 11,
                  backgroundColor: AVATAR_LIGHT,
                  color: AVATAR_TEXT,
                  borderRadius: 4,
                  padding: '1px 6px',
                }}
              >
                {s.name}
              </span>
            ))}
            {partner.categories?.map((c) => (
              <span
                key={c.category.id}
                style={{
                  fontSize: 11,
                  backgroundColor: 'var(--bg2)',
                  color: 'var(--text2)',
                  border: '0.5px solid var(--border)',
                  borderRadius: 4,
                  padding: '1px 6px',
                }}
              >
                {c.category.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Rating */}
      {canSeeRating && partner.avg_rating != null && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>Avg</div>
          <div style={{ fontSize: 17, fontWeight: 500, color: 'var(--text)' }}>
            {partner.avg_rating.toFixed(1)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function RatingRow({ label, value }: { label: string; value: number }) {
  const fillPct = (value / 5) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--text2)', width: 120, flexShrink: 0 }}>
        {label}
      </div>
      <div
        style={{
          width: 90,
          height: 4,
          backgroundColor: 'var(--bg2)',
          borderRadius: 2,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${fillPct}%`,
            backgroundColor: '#C48A10',
            opacity: 0.7,
            borderRadius: 2,
          }}
        />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>
        {value.toFixed(1)}
      </div>
    </div>
  );
}

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
        backgroundColor: 'var(--card)',
        border: '0.5px solid var(--border)',
        borderRadius: 10,
        padding: '14px 16px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 10 }}>
      {children}
    </div>
  );
}

// ─── Inline editable field ────────────────────────────────────────────────────

function InlineEditField({
  label,
  value,
  onSave,
  placeholder,
}: {
  label: string;
  value: string | null;
  onSave: (val: string | null) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? '');

  const commit = () => {
    onSave(val || null);
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 3 }}>{label}</div>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          autoFocus
          placeholder={placeholder}
          style={{
            width: '100%',
            background: 'var(--bg2)',
            border: '1px solid var(--accent)',
            borderRadius: 6,
            padding: '5px 8px',
            fontSize: 13,
            color: 'var(--text)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>{label}</div>
      <div
        onClick={() => setEditing(true)}
        style={{
          fontSize: 13,
          color: value ? 'var(--text)' : 'var(--text3)',
          borderBottom: '1px dashed rgba(0,0,0,.12)',
          cursor: 'text',
          padding: '1px 2px',
          display: 'inline-block',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderBottomColor = 'var(--accent)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderBottomColor = 'rgba(0,0,0,.12)';
        }}
      >
        {value || placeholder || '—'}
      </div>
    </div>
  );
}

function PartnerDetail({ id, canEdit }: { id: string; canEdit: boolean }) {
  const { data: partner, isLoading } = usePartner(id);
  const { data: allCategories } = useCategories();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const canSeeRatings = user?.role === 'EP' || user?.role === 'PRODUCER';
  const { data: ratings } = usePartnerRatings(canSeeRatings ? id : null);

  // Add contact form state
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactTitle, setContactTitle] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // Edit contact state
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContactName, setEditContactName] = useState('');
  const [editContactTitle, setEditContactTitle] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');

  // Add category form state
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState('');

  // Add speciality form state
  const [showAddSpeciality, setShowAddSpeciality] = useState(false);
  const [newSpecialityName, setNewSpecialityName] = useState('');

  // Add rating form state
  const [showAddRating, setShowAddRating] = useState(false);
  const [ratingProjectId, setRatingProjectId] = useState('');
  const [ratingSpeed, setRatingSpeed] = useState('');
  const [ratingBudget, setRatingBudget] = useState('');
  const [ratingCreativity, setRatingCreativity] = useState('');
  const [ratingOnset, setRatingOnset] = useState('');

  const updateMutation = useMutation({
    mutationFn: (data: { company_name?: string; type?: string | null; location?: string | null; notes?: string | null }) =>
      api.patch(`/partners/${id}`, data).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['partner', id] }),
  });

  const addContactMutation = useMutation({
    mutationFn: (data: { name: string; title?: string; email?: string; phone?: string }) =>
      api.post(`/partners/${id}/contacts`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner', id] });
      setShowAddContact(false);
      setContactName('');
      setContactTitle('');
      setContactEmail('');
      setContactPhone('');
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: ({ contactId, data }: { contactId: string; data: { name?: string; title?: string | null; email?: string | null; phone?: string | null } }) =>
      api.patch(`/partners/${id}/contacts/${contactId}`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner', id] });
      setEditingContactId(null);
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: string) =>
      api.delete(`/partners/${id}/contacts/${contactId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['partner', id] }),
  });

  const addCategoryMutation = useMutation({
    mutationFn: (category_id: string) =>
      api.post(`/partners/${id}/categories`, { category_id }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner', id] });
      setShowAddCategory(false);
      setNewCategoryId('');
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryId: string) =>
      api.delete(`/partners/${id}/categories/${categoryId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['partner', id] }),
  });

  const addSpecialityMutation = useMutation({
    mutationFn: (name: string) =>
      api.post(`/partners/${id}/specialities`, { name }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner', id] });
      setShowAddSpeciality(false);
      setNewSpecialityName('');
    },
  });

  const deleteSpecialityMutation = useMutation({
    mutationFn: (specialityId: string) =>
      api.delete(`/partners/${id}/specialities/${specialityId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['partner', id] }),
  });

  const addRatingMutation = useMutation({
    mutationFn: (data: {
      project_id: string;
      speed_efficiency: number;
      budget_flexibility: number;
      creativity: number;
      onset_performance: number;
    }) => api.post(`/partners/${id}/ratings`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-ratings', id] });
      queryClient.invalidateQueries({ queryKey: ['partner', id] });
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      setShowAddRating(false);
      setRatingProjectId('');
      setRatingSpeed('');
      setRatingBudget('');
      setRatingCreativity('');
      setRatingOnset('');
    },
  });

  if (isLoading) {
    return (
      <div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{ height: 80, borderRadius: 10, backgroundColor: 'var(--bg2)', marginBottom: 10 }}
          />
        ))}
      </div>
    );
  }
  if (!partner) return null;

  const overall = ratings ? avgRating(ratings) : null;

  const avgByField = (field: keyof Pick<PartnerRating, 'speed_efficiency' | 'budget_flexibility' | 'creativity' | 'onset_performance'>) => {
    if (!ratings || ratings.length === 0) return 0;
    return ratings.reduce((s, r) => s + (r[field] ?? 0), 0) / ratings.length;
  };

  return (
    <div>
      {/* Detail header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 13,
          marginBottom: 16,
          paddingBottom: 16,
          borderBottom: '0.5px solid var(--border)',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            backgroundColor: AVATAR_LIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            fontWeight: 500,
            color: AVATAR_TEXT,
            flexShrink: 0,
          }}
        >
          {initials(partner.company_name)}
        </div>
        <div style={{ flex: 1 }}>
          {canEdit ? (
            <InlineEditField
              label=""
              value={partner.company_name}
              onSave={(val) => val && updateMutation.mutate({ company_name: val })}
              placeholder="Company name"
            />
          ) : (
            <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)' }}>
              {partner.company_name}
            </div>
          )}
          {canEdit ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <InlineEditField
                label="Type"
                value={partner.type}
                onSave={(val) => updateMutation.mutate({ type: val })}
                placeholder="e.g. Color house"
              />
              <InlineEditField
                label="Location"
                value={partner.location}
                onSave={(val) => updateMutation.mutate({ location: val })}
                placeholder="e.g. Los Angeles"
              />
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
              {[partner.type, partner.location].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        {canSeeRatings && overall != null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>Overall rating</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--accent)' }}>
              {overall.toFixed(1)}
            </div>
          </div>
        )}
      </div>

      {/* Two-column grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginBottom: 13,
        }}
      >
        {/* Left: Performance ratings (EP/Producer only) */}
        {canSeeRatings ? (
          <Card>
            {/* Permission note */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: 'var(--bg2)',
                borderRadius: 6,
                padding: '6px 10px',
                marginBottom: 10,
                fontSize: 11,
                color: 'var(--text2)',
              }}
            >
              <span>🔒</span>
              Visible to EP &amp; Producer only
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <CardTitle>Performance ratings</CardTitle>
              {canEdit && (
                <span
                  onClick={() => setShowAddRating(true)}
                  style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer' }}
                >
                  + Add rating
                </span>
              )}
            </div>
            {ratings && ratings.length > 0 ? (
              <>
                <RatingRow label="Speed / efficiency" value={avgByField('speed_efficiency')} />
                <RatingRow label="Budget flexibility" value={avgByField('budget_flexibility')} />
                <RatingRow label="Creativity" value={avgByField('creativity')} />
                <RatingRow label="On-set performance" value={avgByField('onset_performance')} />
              </>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>No ratings yet</p>
            )}

            {/* Add rating form */}
            {showAddRating && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg2)', borderRadius: 8, border: '0.5px solid var(--border2)' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>Add rating</div>
                <select
                  value={ratingProjectId}
                  onChange={(e) => setRatingProjectId(e.target.value)}
                  style={{ width: '100%', background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: 'var(--text)', outline: 'none', marginBottom: 8 }}
                >
                  <option value="">Select project...</option>
                  {partner.projects?.map((pp) => (
                    <option key={pp.project.id} value={pp.project.id}>{pp.project.name}</option>
                  ))}
                </select>
                {[
                  { label: 'Speed / efficiency', val: ratingSpeed, set: setRatingSpeed },
                  { label: 'Budget flexibility', val: ratingBudget, set: setRatingBudget },
                  { label: 'Creativity', val: ratingCreativity, set: setRatingCreativity },
                  { label: 'On-set performance', val: ratingOnset, set: setRatingOnset },
                ].map(({ label, val, set }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text2)', width: 120, flexShrink: 0 }}>{label}</span>
                    <input
                      type="number"
                      min="0"
                      max="5"
                      step="0.5"
                      placeholder="0–5"
                      value={val}
                      onChange={(e) => set(e.target.value)}
                      style={{ width: 60, background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '4px 6px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
                    />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <button
                    onClick={() => {
                      if (!ratingProjectId) return;
                      const s = parseFloat(ratingSpeed);
                      const b = parseFloat(ratingBudget);
                      const c = parseFloat(ratingCreativity);
                      const o = parseFloat(ratingOnset);
                      if (isNaN(s) || isNaN(b) || isNaN(c) || isNaN(o)) return;
                      addRatingMutation.mutate({
                        project_id: ratingProjectId,
                        speed_efficiency: s,
                        budget_flexibility: b,
                        creativity: c,
                        onset_performance: o,
                      });
                    }}
                    disabled={addRatingMutation.isPending}
                    style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                  >
                    {addRatingMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setShowAddRating(false)}
                    style={{ background: 'transparent', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--text2)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Card>
        ) : (
          <div />
        )}

        {/* Right: Specialities + Categories stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <CardTitle>Specialities</CardTitle>
              {canEdit && (
                <span
                  onClick={() => setShowAddSpeciality(true)}
                  style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer' }}
                >
                  + Add
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {partner.specialities?.map((s) => (
                <span
                  key={s.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    backgroundColor: AVATAR_LIGHT,
                    color: AVATAR_TEXT,
                    borderRadius: 4,
                    padding: '3px 8px',
                  }}
                >
                  {s.name}
                  {canEdit && (
                    <button
                      onClick={() => deleteSpecialityMutation.mutate(s.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: AVATAR_TEXT,
                        fontSize: 13,
                        lineHeight: 1,
                        opacity: 0.6,
                      }}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              {(!partner.specialities || partner.specialities.length === 0) && (
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>None</span>
              )}
            </div>
            {/* Add speciality inline form */}
            {showAddSpeciality && canEdit && (
              <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  placeholder="e.g. HDR, Dolby Vision"
                  value={newSpecialityName}
                  onChange={(e) => setNewSpecialityName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newSpecialityName.trim()) addSpecialityMutation.mutate(newSpecialityName.trim());
                    if (e.key === 'Escape') { setShowAddSpeciality(false); setNewSpecialityName(''); }
                  }}
                  autoFocus
                  style={{ flex: 1, background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
                />
                <button
                  onClick={() => { if (newSpecialityName.trim()) addSpecialityMutation.mutate(newSpecialityName.trim()); }}
                  disabled={addSpecialityMutation.isPending}
                  style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowAddSpeciality(false); setNewSpecialityName(''); }}
                  style={{ background: 'transparent', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text2)' }}
                >
                  Cancel
                </button>
              </div>
            )}
          </Card>

          <Card>
            <CardTitle>Categories</CardTitle>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {partner.categories?.map((c) => (
                <span
                  key={c.category.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    backgroundColor: 'var(--bg2)',
                    color: 'var(--text2)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 4,
                    padding: '3px 8px',
                  }}
                >
                  {c.category.name}
                  {canEdit && (
                    <button
                      onClick={() => deleteCategoryMutation.mutate(c.category.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        color: 'var(--text3)',
                        fontSize: 13,
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              {/* Add chip */}
              {canEdit && (
                <span
                  onClick={() => setShowAddCategory(true)}
                  style={{
                    fontSize: 12,
                    color: 'var(--text3)',
                    border: '0.5px dashed var(--border2)',
                    borderRadius: 4,
                    padding: '3px 8px',
                    cursor: 'pointer',
                  }}
                >
                  + Add
                </span>
              )}
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
                    .filter((c) => !partner.categories?.some((pc) => pc.category.id === c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => { if (newCategoryId) addCategoryMutation.mutate(newCategoryId); }}
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
        </div>
      </div>

      {/* Notes (editable) */}
      {canEdit && (
        <Card style={{ marginBottom: 12 }}>
          <InlineEditField
            label="Notes"
            value={partner.notes}
            onSave={(val) => updateMutation.mutate({ notes: val })}
            placeholder="Add notes..."
          />
        </Card>
      )}

      {/* Work history */}
      <Card style={{ marginBottom: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <CardTitle>Work history</CardTitle>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {partner.projects?.length ?? 0} project{(partner.projects?.length ?? 0) !== 1 ? 's' : ''}
          </div>
        </div>
        {partner.projects && partner.projects.length > 0 ? (
          partner.projects.map((pp) => (
            <WorkHistoryRow key={pp.project.id} project={pp.project} />
          ))
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>No work history</p>
        )}
      </Card>

      {/* Points of contact */}
      <Card>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <CardTitle>Points of contact</CardTitle>
          {canEdit && (
            <span
              onClick={() => setShowAddContact(true)}
              style={{ fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}
            >
              + Add
            </span>
          )}
        </div>

        {/* Add contact form */}
        {showAddContact && (
          <div style={{ marginBottom: 12, padding: '12px 14px', background: 'var(--bg2)', borderRadius: 8, border: '0.5px solid var(--border2)' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>Add contact</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                placeholder="Name *"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                style={{ background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
              />
              <input
                type="text"
                placeholder="Title"
                value={contactTitle}
                onChange={(e) => setContactTitle(e.target.value)}
                style={{ background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
              />
              <input
                type="email"
                placeholder="Email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                style={{ background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
              />
              <input
                type="text"
                placeholder="Phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                style={{ background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => {
                  if (!contactName) return;
                  addContactMutation.mutate({
                    name: contactName,
                    ...(contactTitle ? { title: contactTitle } : {}),
                    ...(contactEmail ? { email: contactEmail } : {}),
                    ...(contactPhone ? { phone: contactPhone } : {}),
                  });
                }}
                disabled={addContactMutation.isPending}
                style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
              >
                {addContactMutation.isPending ? 'Adding...' : 'Add'}
              </button>
              <button
                onClick={() => { setShowAddContact(false); setContactName(''); setContactTitle(''); setContactEmail(''); setContactPhone(''); }}
                style={{ background: 'transparent', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text2)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {partner.contacts && partner.contacts.length > 0 ? (
          partner.contacts.map((c) => (
            <div key={c.id} style={{ marginBottom: 12 }}>
              {editingContactId === c.id ? (
                /* ── Edit form ── */
                <div style={{ padding: '10px 12px', background: 'var(--bg2)', borderRadius: 8, border: '0.5px solid var(--border2)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      placeholder="Name *"
                      value={editContactName}
                      onChange={(e) => setEditContactName(e.target.value)}
                      style={{ background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
                    />
                    <input
                      type="text"
                      placeholder="Title"
                      value={editContactTitle}
                      onChange={(e) => setEditContactTitle(e.target.value)}
                      style={{ background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={editContactEmail}
                      onChange={(e) => setEditContactEmail(e.target.value)}
                      style={{ background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
                    />
                    <input
                      type="text"
                      placeholder="Phone"
                      value={editContactPhone}
                      onChange={(e) => setEditContactPhone(e.target.value)}
                      style={{ background: 'var(--card)', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text)', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => {
                        if (!editContactName) return;
                        updateContactMutation.mutate({
                          contactId: c.id,
                          data: {
                            name: editContactName,
                            title: editContactTitle || null,
                            email: editContactEmail || null,
                            phone: editContactPhone || null,
                          },
                        });
                      }}
                      disabled={updateContactMutation.isPending}
                      style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                    >
                      {updateContactMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingContactId(null)}
                      style={{ background: 'transparent', border: '0.5px solid var(--border2)', borderRadius: 6, padding: '5px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--text2)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Read view ── */
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      backgroundColor: 'var(--bg2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      color: 'var(--text2)',
                      flexShrink: 0,
                    }}
                  >
                    {initials(c.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1 }}>
                      {[c.title, c.email, c.phone].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={() => {
                          setEditingContactId(c.id);
                          setEditContactName(c.name);
                          setEditContactTitle(c.title ?? '');
                          setEditContactEmail(c.email ?? '');
                          setEditContactPhone(c.phone ?? '');
                        }}
                        style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--accent)', cursor: 'pointer', padding: 0 }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteContactMutation.mutate(c.id)}
                        style={{ background: 'none', border: 'none', fontSize: 11, color: '#C0352E', cursor: 'pointer', padding: 0 }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>No contacts added</p>
        )}
      </Card>
    </div>
  );
}

function WorkHistoryRow({ project }: { project: ProjectSummary }) {
  const statusColors: Record<string, { bg: string; color: string }> = {
    ACTIVE: { bg: '#E6F4EE', color: '#1A6E47' },
    PAUSED: { bg: '#FDF2E0', color: '#8A5A0A' },
    COMPLETED: { bg: 'var(--bg2)', color: 'var(--text2)' },
  };
  const sc = statusColors[project.status] ?? statusColors.COMPLETED;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          backgroundColor: 'var(--accent)',
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{project.name}</div>
        {project.client && <div style={{ fontSize: 11, color: 'var(--text2)' }}>{project.client.name}</div>}
      </div>
      <div
        style={{
          fontSize: 11,
          backgroundColor: sc.bg,
          color: sc.color,
          borderRadius: 4,
          padding: '2px 7px',
          flexShrink: 0,
        }}
      >
        {project.status.charAt(0) + project.status.slice(1).toLowerCase()}
      </div>
    </div>
  );
}

// ─── Add Partner Modal ────────────────────────────────────────────────────────

function AddPartnerModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [location, setLocation] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: { company_name: string; type?: string; location?: string }) =>
      api.post('/partners', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      onClose();
    },
  });

  return (
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
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--card)',
          borderRadius: 12,
          padding: '24px 26px',
          width: 380,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text)', marginBottom: 18 }}>
          Add partner
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>
            Company name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Framestore"
            style={{ width: '100%', background: 'var(--bg2)', border: '0.5px solid var(--border2)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>
            Type
          </label>
          <input
            type="text"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="e.g. Color house"
            style={{ width: '100%', background: 'var(--bg2)', border: '0.5px solid var(--border2)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 5 }}>
            Location
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Los Angeles"
            style={{ width: '100%', background: 'var(--bg2)', border: '0.5px solid var(--border2)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ background: 'var(--bg2)', border: '0.5px solid var(--border2)', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: 'var(--text2)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!name) return;
              createMutation.mutate({
                company_name: name,
                ...(type ? { type } : {}),
                ...(location ? { location } : {}),
              });
            }}
            disabled={createMutation.isPending || !name}
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 500, cursor: createMutation.isPending || !name ? 'not-allowed' : 'pointer', opacity: !name || createMutation.isPending ? 0.6 : 1 }}
          >
            {createMutation.isPending ? 'Adding...' : 'Add partner'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Partners() {
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddPartner, setShowAddPartner] = useState(false);

  const user = useAuthStore((s) => s.user);
  const canSeeRating = user?.role === 'EP' || user?.role === 'PRODUCER';
  const canEdit = user?.role === 'EP' || user?.role === 'PRODUCER';
  const { data: dbCategories } = useCategories();
  const categoryFilters = ['All', ...(dbCategories ?? []).map((c) => c.name)];

  const filterArg =
    activeFilter !== 'All' ? { category: activeFilter } : undefined;
  const { data: partners, isLoading } = usePartners(filterArg);

  const filtered = useMemo(() => {
    if (!partners) return [];
    const q = search.toLowerCase().trim();
    if (!q) return partners;
    return partners.filter(
      (p) =>
        p.company_name.toLowerCase().includes(q) ||
        (p.type ?? '').toLowerCase().includes(q) ||
        (p.location ?? '').toLowerCase().includes(q),
    );
  }, [partners, search]);

  return (
    <div>
      {/* Add partner modal */}
      {showAddPartner && <AddPartnerModal onClose={() => setShowAddPartner(false)} />}

      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)', margin: 0 }}>
          Partners
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="text"
            placeholder="Search partners..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: 190,
              height: 32,
              backgroundColor: 'var(--bg2)',
              border: '0.5px solid var(--border2)',
              borderRadius: 8,
              padding: '0 10px',
              fontSize: 12,
              color: 'var(--text)',
              outline: 'none',
            }}
          />
          {canEdit && (
            <button
              onClick={() => setShowAddPartner(true)}
              style={{
                height: 32,
                padding: '0 12px',
                backgroundColor: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              + Add partner
            </button>
          )}
        </div>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: 14 }}>
        {categoryFilters.map((f) => {
          const active = f === activeFilter;
          return (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              style={{
                backgroundColor: active ? 'var(--text)' : 'var(--bg2)',
                color: active ? 'var(--bg)' : 'var(--text2)',
                border: `0.5px solid ${active ? 'var(--text)' : 'var(--border)'}`,
                borderRadius: 99,
                padding: '4px 12px',
                fontSize: 12,
                cursor: 'pointer',
                margin: '0 4px 6px 0',
                fontFamily: 'inherit',
                lineHeight: 1.4,
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* Main layout: 280px left + 1fr right */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* Left: partner list */}
        <div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text2)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 8,
            }}
          >
            {filtered.length} partner{filtered.length !== 1 ? 's' : ''}
          </div>

          {isLoading ? (
            <div>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{ height: 72, borderRadius: 8, backgroundColor: 'var(--bg2)', marginBottom: 8 }}
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>No partners found</p>
          ) : (
            filtered.map((p) => (
              <PartnerRow
                key={p.id}
                partner={p}
                selected={p.id === selectedId}
                onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
                canSeeRating={canSeeRating}
              />
            ))
          )}
        </div>

        {/* Right: detail panel */}
        <div>
          {selectedId ? (
            <PartnerDetail id={selectedId} canEdit={canEdit} />
          ) : (
            <div
              style={{
                backgroundColor: 'var(--card)',
                border: '0.5px solid var(--border)',
                borderRadius: 10,
                padding: 32,
                textAlign: 'center',
              }}
            >
              <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>
                Select a partner to view their profile
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
