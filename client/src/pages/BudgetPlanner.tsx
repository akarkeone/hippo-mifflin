import { useRef, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import api from '../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BudgetRow {
  id: number;
  category: string;
  desc: string;
}

interface BudgetCol {
  id: string;
  name: string;
  values: Record<string, number>;
}

interface Scenario {
  id: string;
  name: string;
  project_name: string;
  client_name: string;
  client_color: string;
  rows: BudgetRow[];
  budgets: BudgetCol[];
  cad_rate: number;
  updated_at: string;
}

interface Client {
  id: string;
  name: string;
  color_hex: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

function parseDollar(s: string) {
  return parseInt(s.replace(/[^0-9]/g, '')) || 0;
}

function totalFor(bud: BudgetCol, rows: BudgetRow[]) {
  let sum = 0;
  rows.forEach((r) => { sum += bud.values[r.id] || 0; });
  sum += bud.values['fee'] || 0;
  return sum;
}

function pct(val: number, total: number) {
  if (!total) return '—';
  return Math.round((val / total) * 100) + '%';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BudgetPlanner() {
  const qc = useQueryClient();

  // ── Local state ─────────────────────────────────────────────────────────────
  const [rows, setRows] = useState<BudgetRow[]>([{ id: 1, category: '', desc: '' }]);
  const [budgets, setBudgets] = useState<BudgetCol[]>([
    { id: 'a', name: 'Budget A', values: { '1': 0, fee: 0 } },
  ]);
  const [cadRate, setCadRate] = useState(1.38);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [showNewClient, setShowNewClient] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // id of scenario being edited
  const [statusMode, setStatusMode] = useState<'editing' | 'cloning' | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const nextRowId = useRef(2);
  const nextBudgetLetter = useRef('b');

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients').then((r) => r.data),
  });

  const { data: scenarios = [] } = useQuery<Scenario[]>({
    queryKey: ['budget-scenarios'],
    queryFn: () => api.get('/budget-scenarios').then((r) => r.data),
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (body: object) => api.post('/budget-scenarios', body).then((r) => r.data),
    onSuccess: (created: Scenario) => {
      qc.invalidateQueries({ queryKey: ['budget-scenarios'] });
      setEditingId(created.id);
      setStatusMode('editing');
      setStatusMsg(`Saved "${created.name}"`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      api.put(`/budget-scenarios/${id}`, body).then((r) => r.data),
    onSuccess: (updated: Scenario) => {
      qc.invalidateQueries({ queryKey: ['budget-scenarios'] });
      setStatusMode('editing');
      setStatusMsg(`Saved changes to "${updated.name}"`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/budget-scenarios/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budget-scenarios'] }),
  });

  // ── Derived ──────────────────────────────────────────────────────────────────
  const selectedClient = clients.find((c) => c.id === selectedClientId);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function addRow() {
    const id = nextRowId.current++;
    setRows((prev) => [...prev, { id, category: '', desc: '' }]);
    setBudgets((prev) =>
      prev.map((b) => ({ ...b, values: { ...b.values, [id]: 0 } }))
    );
  }

  function removeRow(id: number) {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRow(id: number, field: 'category' | 'desc', value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function setVal(budId: string, key: string, raw: string) {
    const val = parseDollar(raw);
    setBudgets((prev) =>
      prev.map((b) =>
        b.id === budId ? { ...b, values: { ...b.values, [key]: val } } : b
      )
    );
  }

  function updateBudgetName(budId: string, name: string) {
    setBudgets((prev) => prev.map((b) => (b.id === budId ? { ...b, name } : b)));
  }

  function addBudget() {
    if (budgets.length >= 3) return;
    const id = nextBudgetLetter.current;
    nextBudgetLetter.current = String.fromCharCode(id.charCodeAt(0) + 1);
    const values: Record<string, number> = { fee: 0 };
    rows.forEach((r) => { values[r.id] = 0; });
    setBudgets((prev) => [...prev, { id, name: 'Budget ' + id.toUpperCase(), values }]);
  }

  function removeBudget(id: string) {
    if (budgets.length <= 1) return;
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  }

  function loadScenario(s: Scenario) {
    setRows(s.rows.map((r) => ({ ...r })));
    setBudgets(s.budgets.map((b) => ({ ...b, values: { ...b.values } })));
    setCadRate(s.cad_rate);
    nextRowId.current = Math.max(...s.rows.map((r) => r.id)) + 10;
    const match = clients.find((c) => c.name === s.client_name);
    setSelectedClientId(match?.id ?? '');
    setProjectName(s.project_name);
    setEditingId(s.id);
    setStatusMode('editing');
    setStatusMsg(`Editing saved scenario: "${s.name}"`);
  }

  function cloneScenario(s: Scenario) {
    setRows(s.rows.map((r) => ({ ...r })));
    setBudgets(s.budgets.map((b) => ({ ...b, values: { ...b.values } })));
    setCadRate(s.cad_rate);
    nextRowId.current = Math.max(...s.rows.map((r) => r.id)) + 10;
    setSelectedClientId('');
    setProjectName('');
    setEditingId(null);
    setStatusMode('cloning');
    setStatusMsg(`New scenario cloned from "${s.name}" — save when ready`);
  }

  function newScenario() {
    if (!confirm('Clear the current planner and start a new scenario?')) return;
    setRows([{ id: 1, category: '', desc: '' }]);
    setBudgets([{ id: 'a', name: 'Budget A', values: { '1': 0, fee: 0 } }]);
    setCadRate(1.38);
    nextRowId.current = 2;
    nextBudgetLetter.current = 'b';
    setSelectedClientId('');
    setProjectName('');
    setEditingId(null);
    setStatusMode(null);
    setStatusMsg('');
  }

  function saveScenario() {
    if (!selectedClient) {
      alert('Please select a client before saving.');
      return;
    }
    if (!projectName.trim()) {
      alert('Please enter a project name before saving.');
      return;
    }

    const body = {
      name: `${selectedClient.name} — ${projectName.trim()}`,
      project_name: projectName.trim(),
      client_name: selectedClient.name,
      client_color: selectedClient.color_hex,
      rows,
      budgets,
      cad_rate: cadRate,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, body });
    } else {
      createMutation.mutate(body);
    }
  }

  const addNewClient = useCallback(() => {
    const name = newClientName.trim();
    if (!name) return;
    api.post('/clients', { name, color_hex: '888888' }).then(() => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      setNewClientName('');
      setShowNewClient(false);
    });
  }, [newClientName, qc]);

  function downloadXlsx() {
    const clientLabel = selectedClient?.name ?? 'Budget';
    const projLabel = projectName.trim() || 'Plan';

    const headerRow1 = ['Work Category', 'Description'];
    const headerRow2 = ['', ''];
    budgets.forEach((b) => { headerRow1.push(b.name, ''); headerRow2.push('Estimated', '% Total'); });

    const dataRows = rows.map((row) => {
      const cells: (string | number)[] = [row.category, row.desc];
      budgets.forEach((b) => {
        const total = totalFor(b, rows);
        const val = b.values[row.id] || 0;
        cells.push(val, total ? Math.round((val / total) * 100) / 100 : 0);
      });
      return cells;
    });

    const feeRow: (string | number)[] = ['Agency fee', ''];
    budgets.forEach((b) => {
      const total = totalFor(b, rows);
      const val = b.values['fee'] || 0;
      feeRow.push(val, total ? Math.round((val / total) * 100) / 100 : 0);
    });

    const totalRow: (string | number)[] = ['Total USD', ''];
    budgets.forEach((b) => { totalRow.push(totalFor(b, rows), 1); });

    const cadRow: (string | number)[] = [`Total CAD (${cadRate}×)`, ''];
    budgets.forEach((b) => { cadRow.push(Math.round(totalFor(b, rows) * cadRate), ''); });

    const wsData = [headerRow1, headerRow2, ...dataRows, feeRow, [], totalRow, cadRow];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    ws['!cols'] = [{ wch: 22 }, { wch: 28 }];
    budgets.forEach(() => { ws['!cols']!.push({ wch: 16 }, { wch: 10 }); });

    ws['!merges'] = budgets.map((_, i) => ({
      s: { r: 0, c: 2 + i * 2 },
      e: { r: 0, c: 3 + i * 2 },
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Budget Plan');
    const filename = `${clientLabel} — ${projLabel}.xlsx`.replace(/[/\\?%*:|"<>]/g, '-');
    XLSX.writeFile(wb, filename);
  }

  // ── Styles ───────────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    height: 32,
    border: '1.5px solid var(--border)',
    borderRadius: 6,
    padding: '0 10px',
    fontSize: 12,
    color: 'var(--text)',
    background: 'var(--card)',
    outline: 'none',
  };

  const cellInputStyle: React.CSSProperties = {
    width: '100%',
    border: 'none',
    background: 'transparent',
    fontSize: 12,
    color: 'var(--text)',
    padding: '9px 0',
    outline: 'none',
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>Budget Planner</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>Client</span>
            <select
              style={{ ...inputStyle, minWidth: 180 }}
              value={selectedClientId}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  setShowNewClient(true);
                  setSelectedClientId('');
                } else {
                  setSelectedClientId(e.target.value);
                  setShowNewClient(false);
                }
              }}
            >
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="__new__">+ Add new client…</option>
            </select>
            {showNewClient && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  style={{ ...inputStyle, width: 170, border: '1.5px solid var(--accent)' }}
                  placeholder="Client name…"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addNewClient(); }}
                  autoFocus
                />
                <button
                  onClick={addNewClient}
                  style={{ height: 30, padding: '0 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                >
                  Add
                </button>
                <button
                  onClick={() => { setShowNewClient(false); setNewClientName(''); }}
                  style={{ height: 30, padding: '0 10px', background: 'none', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--text3)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            )}
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, marginLeft: 8 }}>Project name</span>
            <input
              style={{ ...inputStyle, minWidth: 210 }}
              placeholder="e.g. Spring Campaign 2026"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <button onClick={newScenario} style={btnStyle}>+ New scenario</button>
          <button onClick={downloadXlsx} style={btnStyle}>↓ Download (.xlsx)</button>
          <button
            onClick={saveScenario}
            disabled={createMutation.isPending || updateMutation.isPending}
            style={{ ...btnStyle, background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }}
          >
            {createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save scenario'}
          </button>
        </div>
      </div>

      {/* Status bar */}
      {statusMode && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 7, fontSize: 12, marginBottom: 14,
          ...(statusMode === 'editing'
            ? { background: '#FDF2E0', color: '#8A5A0A', border: '1px solid #f5d98a' }
            : { background: '#E6F4EE', color: '#1A6E47', border: '1px solid #a3d9bc' }),
        }}>
          <span>{statusMode === 'editing' ? '✎ ' : '⎘ '}{statusMsg}</span>
          <button
            onClick={() => setStatusMode(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, opacity: 0.6 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Budget card */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              {/* Row 1: budget group labels */}
              <tr>
                <th style={thShared({ width: 150 })}>Work Category</th>
                <th style={thShared({ width: 180 })}>Description</th>
                {budgets.map((b) => (
                  <th key={b.id} colSpan={2} style={{ background: 'var(--bg2)', borderLeft: '2px solid var(--border)', borderBottom: '1px solid var(--border)', padding: 0, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '6px 8px 4px', gap: 4 }}>
                      <input
                        value={b.name}
                        onChange={(e) => updateBudgetName(b.id, e.target.value)}
                        placeholder="Budget name…"
                        style={{
                          flex: 1, background: 'var(--card)', border: '1px dashed var(--border)',
                          borderRadius: 5, fontSize: 12, fontWeight: 600, color: 'var(--text)',
                          textAlign: 'center', padding: '5px 6px', outline: 'none', minWidth: 0,
                        }}
                      />
                      {budgets.length > 1 && (
                        <button
                          onClick={() => removeBudget(b.id)}
                          title="Remove this budget"
                          style={{ width: 20, height: 20, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text3)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1 }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                {budgets.length < 3 && (
                  <th
                    rowSpan={2}
                    onClick={addBudget}
                    style={{ width: 38, background: 'var(--bg2)', borderLeft: '2px dashed var(--border)', cursor: 'pointer', padding: 0, textAlign: 'center', verticalAlign: 'middle' }}
                  >
                    <div style={{ writingMode: 'vertical-lr', fontSize: 10, color: 'var(--text3)', fontWeight: 600, padding: '14px 10px', whiteSpace: 'nowrap' }}>
                      + Add budget
                    </div>
                  </th>
                )}
                <th style={{ width: 28, background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }} />
              </tr>
              {/* Row 2: sub-headers */}
              <tr>
                <th style={subTh({ textAlign: 'left', color: 'var(--text2)' })}>Category</th>
                <th style={subTh({ textAlign: 'left', color: 'var(--text2)' })}>Description</th>
                {budgets.map((b) => (
                  <>
                    <th key={b.id + '-est'} style={subTh({ textAlign: 'right', borderLeft: '2px solid var(--border)' })}>Estimated</th>
                    <th key={b.id + '-pct'} style={subTh({ textAlign: 'right', borderLeft: '1px solid var(--border)' })}>% Total</th>
                  </>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {/* Data rows */}
              {rows.map((row) => (
                <tr key={row.id} style={{ borderBottom: '0.5px solid var(--border)' }}>
                  <td style={{ padding: '0 4px 0 14px', minWidth: 140 }}>
                    <input
                      style={cellInputStyle}
                      value={row.category}
                      placeholder="Work category…"
                      onChange={(e) => updateRow(row.id, 'category', e.target.value)}
                    />
                  </td>
                  <td style={{ padding: '0 10px', minWidth: 160 }}>
                    <input
                      style={cellInputStyle}
                      value={row.desc}
                      placeholder="Optional notes…"
                      onChange={(e) => updateRow(row.id, 'desc', e.target.value)}
                    />
                  </td>
                  {budgets.map((b, bi) => {
                    const total = totalFor(b, rows);
                    const val = b.values[row.id] || 0;
                    return (
                      <>
                        <td key={b.id + '-val'} style={{ padding: '0 10px', textAlign: 'right', borderLeft: bi === 0 ? '2px solid var(--border)' : '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                          <input
                            style={{ ...cellInputStyle, textAlign: 'right' }}
                            defaultValue={val ? fmt(val) : ''}
                            placeholder="—"
                            onFocus={(e) => { if (e.target.value) e.target.value = String(val || ''); }}
                            onBlur={(e) => {
                              setVal(b.id, String(row.id), e.target.value);
                              const v = parseDollar(e.target.value);
                              e.target.value = v ? fmt(v) : '';
                            }}
                          />
                        </td>
                        <td key={b.id + '-pct'} style={{ padding: '0 10px', textAlign: 'right', borderLeft: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 12, color: 'var(--text3)', display: 'block', textAlign: 'right' }}>{pct(val, total)}</span>
                        </td>
                      </>
                    );
                  })}
                  <td style={{ width: 28, padding: '0 6px', textAlign: 'center' }}>
                    {rows.length > 1 && (
                      <span
                        onClick={() => removeRow(row.id)}
                        style={{ fontSize: 14, color: 'var(--text3)', cursor: 'pointer', lineHeight: 1, userSelect: 'none' }}
                      >
                        ×
                      </span>
                    )}
                  </td>
                </tr>
              ))}

              {/* Add row */}
              <tr>
                <td colSpan={2 + budgets.length * 2 + 1} style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
                  <button
                    onClick={addRow}
                    style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: 0 }}
                  >
                    + Add row
                  </button>
                </td>
              </tr>

              {/* Agency fee */}
              <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                <td style={{ padding: '0 4px 0 14px', minWidth: 140, background: 'var(--bg2)' }}>
                  <span style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', display: 'block', padding: '9px 0' }}>Agency fee</span>
                </td>
                <td style={{ padding: '0 10px', minWidth: 160, background: 'var(--bg2)' }}>
                  <input style={{ ...cellInputStyle, background: 'transparent' }} placeholder="Optional notes…" />
                </td>
                {budgets.map((b, bi) => {
                  const total = totalFor(b, rows);
                  const val = b.values['fee'] || 0;
                  return (
                    <>
                      <td key={b.id + '-fee-val'} style={{ padding: '0 10px', textAlign: 'right', borderLeft: bi === 0 ? '2px solid var(--border)' : '1px solid var(--border)', background: 'var(--bg2)', whiteSpace: 'nowrap' }}>
                        <input
                          style={{ ...cellInputStyle, textAlign: 'right', background: 'transparent' }}
                          defaultValue={val ? fmt(val) : ''}
                          placeholder="—"
                          onFocus={(e) => { if (e.target.value) e.target.value = String(val || ''); }}
                          onBlur={(e) => {
                            setVal(b.id, 'fee', e.target.value);
                            const v = parseDollar(e.target.value);
                            e.target.value = v ? fmt(v) : '';
                          }}
                        />
                      </td>
                      <td key={b.id + '-fee-pct'} style={{ padding: '0 10px', textAlign: 'right', borderLeft: '1px solid var(--border)', background: 'var(--bg2)', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 12, color: 'var(--text3)', display: 'block', textAlign: 'right' }}>{pct(val, total)}</span>
                      </td>
                    </>
                  );
                })}
                <td style={{ background: 'var(--bg2)' }} />
              </tr>

              {/* Totals */}
              <tr>
                <td colSpan={2} style={{ background: 'var(--bg2)', borderTop: '1.5px solid var(--border)', padding: '8px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total USD
                </td>
                {budgets.map((b, bi) => (
                  <>
                    <td key={b.id + '-tot'} style={{ background: 'var(--bg2)', borderTop: '1.5px solid var(--border)', borderLeft: bi === 0 ? '2px solid var(--border)' : '1px solid var(--border)', padding: '8px 10px', fontSize: 12, fontWeight: 700, color: 'var(--text)', textAlign: 'right' }}>
                      {fmt(totalFor(b, rows))}
                    </td>
                    <td key={b.id + '-100'} style={{ background: 'var(--bg2)', borderTop: '1.5px solid var(--border)', borderLeft: '1px solid var(--border)', padding: '8px 10px', fontSize: 12, fontWeight: 700, color: 'var(--text)', textAlign: 'right' }}>
                      100%
                    </td>
                  </>
                ))}
                <td style={{ background: 'var(--bg2)', borderTop: '1.5px solid var(--border)' }} />
              </tr>

              {/* CAD */}
              <tr>
                <td colSpan={2} style={{ background: 'var(--bg)', padding: '6px 14px', fontSize: 11, color: 'var(--text3)' }}>
                  Total CAD
                </td>
                {budgets.map((b, bi) => (
                  <>
                    <td key={b.id + '-cad'} style={{ background: 'var(--bg)', borderLeft: bi === 0 ? '2px solid var(--border)' : '1px solid var(--border)', padding: '6px 10px', fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>
                      {fmt(Math.round(totalFor(b, rows) * cadRate))}
                    </td>
                    <td key={b.id + '-cad-empty'} style={{ background: 'var(--bg)', borderLeft: '1px solid var(--border)' }} />
                  </>
                ))}
                <td style={{ background: 'var(--bg)' }} />
              </tr>
            </tbody>
          </table>
        </div>

        {/* CAD rate note */}
        <div style={{ fontSize: 11, color: 'var(--text3)', padding: '10px 16px', borderTop: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
          CAD conversion rate:&nbsp;
          <input
            type="number"
            step="0.01"
            value={cadRate}
            onChange={(e) => setCadRate(parseFloat(e.target.value) || 1.38)}
            style={{ border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: 'var(--text2)', width: 60, textAlign: 'center', background: 'var(--card)', outline: 'none' }}
          />
          &nbsp;·&nbsp; Editable
        </div>
      </div>

      {/* Saved scenarios */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
            Saved scenarios
            <span style={{ background: 'var(--accent-light)', color: 'var(--accent)', fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 99 }}>
              {scenarios.length}
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Load replaces the current planner. Clone copies it as a new starting point.</span>
        </div>

        {scenarios.length === 0 ? (
          <div style={{ padding: '24px 16px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
            No saved scenarios yet. Fill in the planner above and hit Save scenario.
          </div>
        ) : (
          <div>
            {scenarios.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '0.5px solid var(--border)', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: '#' + s.client_color }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                    {s.client_name}&nbsp;·&nbsp;{(s.budgets as BudgetCol[]).length} budget{(s.budgets as BudgetCol[]).length !== 1 ? 's' : ''}&nbsp;·&nbsp;
                    {new Date(s.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={() => loadScenario(s)} style={btnXsLoad}>Load</button>
                  <button onClick={() => cloneScenario(s)} style={btnXsClone}>Clone</button>
                  <button
                    onClick={() => { if (confirm(`Delete "${s.name}"?`)) deleteMutation.mutate(s.id); }}
                    style={btnXs}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 11, color: 'var(--text3)', padding: '10px 16px', borderTop: '0.5px solid var(--border)', background: 'var(--bg2)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text2)' }}>Load</strong> — opens the saved scenario so you can continue editing it. Your current unsaved work is replaced.<br />
          <strong style={{ color: 'var(--text2)' }}>Clone</strong> — copies the saved scenario's rows and values into a new unsaved scenario. The original remains untouched.
        </div>
      </div>
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const btnStyle: React.CSSProperties = {
  height: 32, padding: '0 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
  border: '1.5px solid var(--border)', background: 'var(--card)', color: 'var(--text)',
  whiteSpace: 'nowrap',
};

const btnXs: React.CSSProperties = {
  height: 26, padding: '0 10px', borderRadius: 5, fontSize: 11, fontWeight: 500,
  border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)',
  cursor: 'pointer', whiteSpace: 'nowrap',
};

const btnXsLoad: React.CSSProperties = {
  ...btnXs, background: 'var(--accent-light)', borderColor: 'var(--accent)', color: 'var(--accent)',
};

const btnXsClone: React.CSSProperties = {
  ...btnXs, background: '#E6F4EE', borderColor: '#a3d9bc', color: '#1A6E47',
};

function thShared(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    padding: '10px 14px', textAlign: 'left', background: 'var(--bg2)',
    fontSize: 12, fontWeight: 600, color: 'var(--text2)', borderBottom: '1px solid var(--border)',
    ...extra,
  };
}

function subTh(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase',
    letterSpacing: '0.04em', padding: '5px 10px 6px', background: 'var(--bg2)',
    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
    ...extra,
  };
}
