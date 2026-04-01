import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import type { ScoutResult } from '../types';

const serviceTypes = ['Production company', 'Color house', 'Sound studio', 'VFX / CGI', 'Animation', 'Editorial'];
const categoryOptions = ['Food & beverage', 'CPG', 'Pets', 'Documentary', 'Automotive', 'Healthcare', 'Tech / SaaS', 'Fashion'];
const budgetRanges = ['Under $25K', '$25K – $75K', '$75K – $150K', '$150K – $500K', '$500K+'];
const locationOptions = ['Los Angeles', 'New York', 'Chicago', 'Remote / anywhere'];

export default function Scout() {
  useAuthStore((s) => s.user);
  const [boyShown, setBoyShown] = useState(true);
  const [serviceType, setServiceType] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [budgetRange, setBudgetRange] = useState('');
  const [location, setLocation] = useState('');
  const [serviceText, setServiceText] = useState('');
  const [categoryText, setCategoryText] = useState('');
  const [budgetText, setBudgetText] = useState('');
  const [locationText, setLocationText] = useState('');
  const [specialities, setSpecialities] = useState('');
  const [results, setResults] = useState<ScoutResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const bubbleBg = boyShown ? '#FDF5E8' : '#EAF4EA';

  const toggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const showQ5 = !!location;

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const extraContext = [categoryText, budgetText, locationText, specialities].filter(Boolean).join('. ');
      const res = await api.post('/scout/search', {
        service_type: serviceType || serviceText,
        categories,
        budget_range: budgetRange,
        location,
        specialities: extraContext || undefined,
      });
      setResults(res.data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const addToPartners = async (result: ScoutResult) => {
    const key = result.company_name;
    setAddingId(key);
    try {
      const contact = result.ep_name
        ? {
            name: result.ep_name,
            ...(result.ep_email ? { email: result.ep_email } : {}),
            ...(result.ep_phone ? { phone: result.ep_phone } : {}),
          }
        : null;
      await api.post('/partners', {
        company_name: result.company_name,
        ...(result.type ? { type: result.type } : {}),
        ...(result.location ? { location: result.location } : {}),
        specialities: result.specialities?.length ? result.specialities : undefined,
        contacts: contact ? [contact] : undefined,
      });
      setAddedIds((prev) => new Set(prev).add(key));
      setToast(`${result.company_name} added to Partners`);
      setTimeout(() => setToast(''), 3000);
    } catch {
      setToast(`Failed to add ${result.company_name}`);
      setTimeout(() => setToast(''), 3000);
    }
    setAddingId(null);
  };

  // Build Q5 summary text
  const q5Summary = location && serviceType
    ? `Searching for ${location}-based ${serviceType} with ${categories.join(', ') || '...'} experience in the ${budgetRange || '...'} range. Found ${results.length} match${results.length !== 1 ? 'es' : ''}.`
    : '';

  return (
    <div style={{ maxWidth: 680 }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            background: '#1A6E47',
            color: 'white',
            borderRadius: 8,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 500,
            zIndex: 9999,
            boxShadow: '0 2px 12px rgba(0,0,0,.15)',
          }}
        >
          {toast}
        </div>
      )}

      {/* Title */}
      <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text)', marginBottom: 16 }}>Scout</div>

      {/* Top section */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 20 }}>
        {/* Left: Hippo image */}
        <div style={{ flexShrink: 0, cursor: 'pointer' }} onClick={() => setBoyShown(!boyShown)}>
          <img
            src={boyShown ? '/hippoBoy.png' : '/hippoGirl.png'}
            alt="Scout"
            style={{ height: 140, display: 'block', background: 'transparent' }}
          />
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5, textAlign: 'center' }}>
            Click to switch
          </div>
        </div>

        {/* Right: Intro text */}
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, paddingTop: 8 }}>
          Answer a few questions and Scout will search the web to find up to 10 production partners that match your needs — with contact details ready to add to your Partners database.
        </div>
      </div>

      {/* Main card */}
      <div
        style={{
          background: 'var(--card)',
          border: '0.5px solid var(--border)',
          borderRadius: 12,
          padding: '18px 20px',
        }}
      >
        {/* Q1 */}
        <div style={{ marginBottom: 16 }}>
          <ScoutLabel />
          <div style={{ borderRadius: '12px 12px 12px 2px', padding: '11px 15px', background: bubbleBg, maxWidth: '88%', marginBottom: 10, fontSize: 13, color: 'var(--text)' }}>
            Hi! I'll help you find the right production partner. What's the primary service you're looking for?
          </div>
          <ChipRow
            options={serviceTypes}
            selected={serviceType ? [serviceType] : []}
            onToggle={(v) => setServiceType(v === serviceType ? '' : v)}
          />
          <textarea
            className="ans-box"
            placeholder="e.g. tabletop, lifestyle, director-led..."
            value={serviceText}
            onChange={(e) => setServiceText(e.target.value)}
            style={{
              width: '100%',
              border: '0.5px solid var(--border2)',
              borderRadius: 8,
              padding: '9px 13px',
              fontSize: 13,
              fontFamily: 'sans-serif',
              marginTop: 8,
              background: 'var(--bg2)',
              color: 'var(--text)',
              outline: 'none',
              resize: 'none',
              minHeight: 52,
            }}
          />
        </div>

        {/* User bubble after Q1 */}
        {(serviceType || serviceText) && (
          <div style={{ background: 'var(--bg2)', borderRadius: '12px 12px 2px 12px', marginLeft: 'auto', maxWidth: '72%', marginBottom: 10, padding: '11px 15px', fontSize: 13, color: 'var(--text)' }}>
            {serviceType || serviceText}
          </div>
        )}

        {/* Q2 */}
        <div style={{ marginBottom: 16 }}>
          <ScoutLabel />
          <div style={{ borderRadius: '12px 12px 12px 2px', padding: '11px 15px', background: bubbleBg, maxWidth: '88%', marginBottom: 10, fontSize: 13, color: 'var(--text)' }}>
            What category of content? Select all that apply.
          </div>
          <ChipRow
            options={categoryOptions}
            selected={categories}
            onToggle={toggleCategory}
            multi
          />
          <textarea
            placeholder="Any additional category details..."
            value={categoryText}
            onChange={(e) => setCategoryText(e.target.value)}
            style={{
              width: '100%',
              border: '0.5px solid var(--border2)',
              borderRadius: 8,
              padding: '9px 13px',
              fontSize: 13,
              fontFamily: 'sans-serif',
              marginTop: 8,
              background: 'var(--bg2)',
              color: 'var(--text)',
              outline: 'none',
              resize: 'none',
              minHeight: 52,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* User bubble after Q2 */}
        {categories.length > 0 && (
          <div style={{ background: 'var(--bg2)', borderRadius: '12px 12px 2px 12px', marginLeft: 'auto', maxWidth: '72%', marginBottom: 10, padding: '11px 15px', fontSize: 13, color: 'var(--text)' }}>
            {categories.join(', ')}
          </div>
        )}

        {/* Q3 */}
        <div style={{ marginBottom: 16 }}>
          <ScoutLabel />
          <div style={{ borderRadius: '12px 12px 12px 2px', padding: '11px 15px', background: bubbleBg, maxWidth: '88%', marginBottom: 10, fontSize: 13, color: 'var(--text)' }}>
            What's the approximate production budget range?
          </div>
          <ChipRow
            options={budgetRanges}
            selected={budgetRange ? [budgetRange] : []}
            onToggle={(v) => setBudgetRange(v === budgetRange ? '' : v)}
          />
          <textarea
            placeholder="Any budget flexibility or notes..."
            value={budgetText}
            onChange={(e) => setBudgetText(e.target.value)}
            style={{
              width: '100%',
              border: '0.5px solid var(--border2)',
              borderRadius: 8,
              padding: '9px 13px',
              fontSize: 13,
              fontFamily: 'sans-serif',
              marginTop: 8,
              background: 'var(--bg2)',
              color: 'var(--text)',
              outline: 'none',
              resize: 'none',
              minHeight: 52,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* User bubble after Q3 */}
        {budgetRange && (
          <div style={{ background: 'var(--bg2)', borderRadius: '12px 12px 2px 12px', marginLeft: 'auto', maxWidth: '72%', marginBottom: 10, padding: '11px 15px', fontSize: 13, color: 'var(--text)' }}>
            {budgetRange}
          </div>
        )}

        {/* Q4 */}
        <div style={{ marginBottom: 16 }}>
          <ScoutLabel />
          <div style={{ borderRadius: '12px 12px 12px 2px', padding: '11px 15px', background: bubbleBg, maxWidth: '88%', marginBottom: 10, fontSize: 13, color: 'var(--text)' }}>
            Any location preference?
          </div>
          <ChipRow
            options={locationOptions}
            selected={location ? [location] : []}
            onToggle={(v) => setLocation(v === location ? '' : v)}
          />
          <textarea
            placeholder="Any location flexibility or preferences..."
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            style={{
              width: '100%',
              border: '0.5px solid var(--border2)',
              borderRadius: 8,
              padding: '9px 13px',
              fontSize: 13,
              fontFamily: 'sans-serif',
              marginTop: 8,
              background: 'var(--bg2)',
              color: 'var(--text)',
              outline: 'none',
              resize: 'none',
              minHeight: 52,
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* User bubble after Q4 */}
        {location && (
          <div style={{ background: 'var(--bg2)', borderRadius: '12px 12px 2px 12px', marginLeft: 'auto', maxWidth: '72%', marginBottom: 10, padding: '11px 15px', fontSize: 13, color: 'var(--text)' }}>
            {location}
          </div>
        )}

        {/* Q5 — shown after Q4 answered */}
        {showQ5 && (
          <div style={{ marginBottom: 16 }}>
            <ScoutLabel />
            <div style={{ borderRadius: '12px 12px 12px 2px', padding: '11px 15px', background: bubbleBg, maxWidth: '88%', marginBottom: 10, fontSize: 13, color: 'var(--text)' }}>
              {q5Summary || `Searching for ${location}-based partners. Any specialities to prioritize?`} Any specialities to prioritize?
            </div>
            <textarea
              placeholder="e.g. tabletop, lifestyle, director-led..."
              value={specialities}
              onChange={(e) => setSpecialities(e.target.value)}
              style={{
                width: '100%',
                border: '0.5px solid var(--border2)',
                borderRadius: 8,
                padding: '9px 13px',
                fontSize: 13,
                fontFamily: 'sans-serif',
                marginTop: 8,
                background: 'var(--bg2)',
                color: 'var(--text)',
                outline: 'none',
                resize: 'none',
                minHeight: 52,
              }}
            />
          </div>
        )}

        {/* Search button */}
        <button
          onClick={handleSearch}
          disabled={loading}
          style={{
            background: '#B8862A',
            color: 'white',
            borderRadius: 8,
            padding: '9px 16px',
            fontWeight: 500,
            fontSize: 13,
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            marginTop: 4,
          }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>

        {/* Results */}
        {searched && !loading && (
          <>
            <hr style={{ margin: '18px 0', border: 'none', borderTop: '0.5px solid var(--border)' }} />
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--text2)',
                textTransform: 'uppercase',
                letterSpacing: '.05em',
                marginBottom: 10,
              }}
            >
              {results.length} result{results.length !== 1 ? 's' : ''} found
            </div>
            {results.map((r) => (
              <div
                key={r.company_name}
                style={{
                  background: 'white',
                  border: '0.5px solid var(--border)',
                  borderRadius: 8,
                  padding: '13px 14px',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                {/* Left */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
                    {r.company_name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
                    {r.location}{r.type ? ` · ${r.type}` : ''}
                  </div>
                  {/* Tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 7 }}>
                    {r.specialities?.map((s) => (
                      <span
                        key={s}
                        style={{
                          background: 'var(--accent-light)',
                          color: 'var(--accent)',
                          borderRadius: 99,
                          padding: '2px 8px',
                          fontSize: 11,
                        }}
                      >
                        {s}
                      </span>
                    ))}
                    {r.categories?.map((c) => (
                      <span
                        key={c}
                        style={{
                          background: 'var(--bg2)',
                          color: 'var(--text2)',
                          border: '0.5px solid var(--border)',
                          borderRadius: 99,
                          padding: '2px 8px',
                          fontSize: 11,
                        }}
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                  {/* EP contact */}
                  <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                    {r.ep_name && (
                      <div>EP: {r.ep_name}{r.ep_email ? ` · ${r.ep_email}` : ''}{r.ep_phone ? ` · ${r.ep_phone}` : ''}</div>
                    )}
                    {r.website && (
                      <div>
                        Web:{' '}
                        <a
                          href={r.website.startsWith('http') ? r.website : `https://${r.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--accent)', textDecoration: 'none' }}
                        >
                          {r.website}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                {/* Right: Add button */}
                <button
                  onClick={() => addToPartners(r)}
                  disabled={addingId === r.company_name || addedIds.has(r.company_name)}
                  style={{
                    background: addedIds.has(r.company_name) ? 'var(--bg2)' : 'var(--accent)',
                    color: addedIds.has(r.company_name) ? 'var(--text2)' : 'white',
                    border: 'none',
                    borderRadius: 7,
                    padding: '5px 12px',
                    fontWeight: 500,
                    fontSize: 12,
                    cursor: addedIds.has(r.company_name) ? 'default' : 'pointer',
                    flexShrink: 0,
                    opacity: addingId === r.company_name ? 0.6 : 1,
                  }}
                >
                  {addedIds.has(r.company_name)
                    ? 'Added'
                    : addingId === r.company_name
                      ? 'Adding...'
                      : '+ Add to Partners'}
                </button>
              </div>
            ))}
          </>
        )}

        {searched && loading && (
          <>
            <hr style={{ margin: '18px 0', border: 'none', borderTop: '0.5px solid var(--border)' }} />
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Searching...</div>
          </>
        )}
      </div>
    </div>
  );
}

function ScoutLabel() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        fontWeight: 500,
        color: 'var(--accent)',
        marginBottom: 6,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: '#7F77DD',
          flexShrink: 0,
          display: 'inline-block',
        }}
      />
      Scout
    </div>
  );
}

function ChipRow({
  options,
  selected,
  onToggle,
  multi: _multi,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  multi?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const isSel = selected.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            style={{
              background: isSel ? 'var(--accent-light)' : 'var(--bg2)',
              border: `0.5px solid ${isSel ? 'var(--accent)' : 'var(--border2)'}`,
              borderRadius: 99,
              padding: '5px 14px',
              fontSize: 12,
              color: isSel ? 'var(--accent)' : 'var(--text2)',
              cursor: 'pointer',
              margin: 3,
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
