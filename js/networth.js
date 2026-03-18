'use strict';

// ─── Net Worth Tracker ────────────────────────────────────────────────────────
// Logs point-in-time account balance snapshots and shows net worth over time.
// Storage key: 'wealthos_networth' — array of snapshot objects.

// Account definitions — matches Richmond's actual financial accounts
const NW_ACCOUNTS = [
  {id:'hysa',      l:'Emergency HYSA',   hint:'Ally HYSA balance — emergency fund target $15K'},
  {id:'h1b',       l:'H1B Legal Fund',   hint:'H1B attorney fund — target $3K by Month 12'},
  {id:'brokerage', l:'Brokerage',        hint:'VOO/VTI portfolio value (Fidelity/Schwab)'},
  {id:'checking',  l:'Checking / Cash',  hint:'Checking account + cash on hand'},
  {id:'k401',      l:'401k',             hint:'Employer retirement plan (if applicable)'},
  {id:'hsa',       l:'HSA',              hint:'Health savings account (if HDHP eligible)'},
  {id:'other',     l:'Other Assets',     hint:'Car value, any other property or savings'},
];

// ─── Persistence ─────────────────────────────────────────────────────────────
function loadNW() {
  try {
    const raw = localStorage.getItem('wealthos_networth');
    return raw ? JSON.parse(raw) : [];
  } catch(e) { return []; }
}

function saveNW(data) {
  try { localStorage.setItem('wealthos_networth', JSON.stringify(data)); } catch(e) {}
}

// ─── Render: KPI Cards ────────────────────────────────────────────────────────
function renderNWKPIs(snapshots) {
  const el = document.getElementById('nw-kpis');
  if (!el) return;

  if (snapshots.length === 0) {
    el.innerHTML = `<div class="kpi" style="grid-column:1/-1">
      <div class="kl">Get started</div>
      <div class="kv" style="font-size:15px;color:var(--muted)">Add your first snapshot</div>
      <div class="ks">Log account balances to track net worth over time</div>
    </div>`;
    return;
  }

  const latest = snapshots[snapshots.length - 1];
  const prev   = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const delta  = prev !== null ? latest.total - prev.total : null;
  const fmtM   = v => '$' + Math.abs(v).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
  const daysSince = snapshots.length > 1
    ? Math.round((new Date(latest.date) - new Date(snapshots[0].date)) / 86400000)
    : null;

  el.innerHTML = [
    {l:'Net Worth',        v: fmtM(latest.total),
      s: `as of ${latest.date}`,
      c: 'var(--green)'},
    {l:'Change',           v: delta === null ? '—' : (delta >= 0 ? '+' : '−') + fmtM(delta),
      s: prev ? `vs ${prev.date}` : 'first entry',
      c: delta === null ? '' : delta >= 0 ? 'var(--green)' : 'var(--red)'},
    {l:'Snapshots',        v: String(snapshots.length),
      s: 'logged so far',
      c: ''},
    {l:'Days tracked',     v: daysSince !== null ? String(daysSince) : '—',
      s: daysSince !== null ? 'since first entry' : 'add more to track',
      c: ''},
  ].map(k => `<div class="kpi">
    <div class="kl">${k.l}</div>
    <div class="kv" style="color:${k.c||'var(--text)'}">${k.v}</div>
    <div class="ks">${k.s}</div>
  </div>`).join('');
}

// ─── Render: Add Snapshot Form ────────────────────────────────────────────────
function renderNWForm() {
  const el = document.getElementById('nw-form-container');
  if (!el) return;

  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  el.innerHTML = `
    <form id="nw-form" class="txn-form" novalidate>
      <div class="txn-row">
        <label class="txn-label" for="nw-date">Date</label>
        <input id="nw-date" class="txn-inp" type="date" value="${today}" required>
      </div>
      ${NW_ACCOUNTS.map(a => `
      <div class="txn-row">
        <label class="txn-label" for="nw-${escapeHTML(a.id)}" title="${escapeHTML(a.hint)}">${escapeHTML(a.l)}</label>
        <div style="flex:1;display:flex;align-items:center;gap:6px">
          <span style="color:var(--muted);font-size:13px">$</span>
          <input id="nw-${escapeHTML(a.id)}" class="txn-inp" type="number" min="0" step="0.01"
            placeholder="0.00" style="flex:1" aria-label="${escapeHTML(a.l)}" title="${escapeHTML(a.hint)}">
        </div>
      </div>`).join('')}
      <div class="txn-row">
        <label class="txn-label" for="nw-note">Note</label>
        <input id="nw-note" class="txn-inp" type="text"
          placeholder="e.g. First paycheck deposited" maxlength="100">
      </div>
      <p class="txn-err" id="nw-err" role="alert" aria-live="polite"></p>
      <button class="txn-submit" type="submit">+ Save Snapshot</button>
    </form>`;

  document.getElementById('nw-form').addEventListener('submit', e => {
    e.preventDefault();
    const date = document.getElementById('nw-date').value;
    if (!date) { document.getElementById('nw-err').textContent = 'Please pick a date.'; return; }

    const accounts = {};
    let total = 0;
    NW_ACCOUNTS.forEach(a => {
      const raw = parseFloat(document.getElementById(`nw-${a.id}`).value);
      const val = Math.max(0, Number.isFinite(raw) ? raw : 0);
      accounts[a.id] = roundMoney(val);
      total += val;
    });
    total = roundMoney(total);

    const note = document.getElementById('nw-note').value.trim().slice(0, 100);
    document.getElementById('nw-err').textContent = '';

    const data = loadNW();
    data.push({
      id:       'nw-' + Date.now() + Math.random().toString(36).slice(2, 5),
      date,
      accounts,
      total,
      note,
    });
    data.sort((a, b) => a.date.localeCompare(b.date));
    saveNW(data);

    // Reset account fields; keep date for quick repeat
    NW_ACCOUNTS.forEach(a => { document.getElementById(`nw-${a.id}`).value = ''; });
    document.getElementById('nw-note').value = '';

    renderNetWorth();
  });
}

// ─── Render: Latest Breakdown Bars ───────────────────────────────────────────
function renderNWBreakdown(snapshots) {
  const el = document.getElementById('nw-breakdown');
  if (!el) return;

  if (snapshots.length === 0) {
    el.innerHTML = '<p style="font-size:11px;color:var(--muted);padding:8px 0">Breakdown appears after first snapshot.</p>';
    return;
  }

  const latest = snapshots[snapshots.length - 1];
  const total  = latest.total || 1;

  const bars = NW_ACCOUNTS.filter(a => (latest.accounts[a.id] || 0) > 0).map(a => {
    const val = latest.accounts[a.id] || 0;
    const pct = (val / total * 100).toFixed(1);
    return `<div class="bitem">
      <div class="bh">
        <span class="bname">${escapeHTML(a.l)}</span>
        <span class="bamnt">$${val.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
      </div>
      <div class="btrack" role="progressbar"
        aria-valuenow="${val.toFixed(0)}" aria-valuemin="0" aria-valuemax="${total.toFixed(0)}"
        aria-label="${escapeHTML(a.l)}: ${pct}% of net worth"
        aria-valuetext="$${val.toFixed(2)}, ${pct}% of total net worth">
        <div class="bfill" style="width:${pct}%;background:var(--green);opacity:.8"></div>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = bars || '<p style="font-size:11px;color:var(--muted)">All accounts are $0 in the latest snapshot.</p>';
}

// ─── Render: Snapshot History Table ──────────────────────────────────────────
function renderNWHistory(snapshots) {
  const el = document.getElementById('nw-history');
  if (!el) return;

  // Set up delegation once
  if (!el._nwDelegated) {
    el._nwDelegated = true;
    el.addEventListener('click', e => {
      const btn = e.target.closest('[data-nwid]');
      if (btn && confirm('Delete this snapshot?')) {
        const data = loadNW().filter(s => s.id !== btn.dataset.nwid);
        saveNW(data);
        renderNetWorth();
      }
    });
  }

  if (snapshots.length === 0) {
    el.innerHTML = '<p style="font-size:12px;color:var(--muted);padding:20px 0;text-align:center">No snapshots yet — add your first one above.</p>';
    return;
  }

  const sorted = [...snapshots].reverse(); // newest first

  const rows = sorted.map((s, i) => {
    const prev   = sorted[i + 1]; // previous entry in time
    const delta  = prev !== null && prev !== undefined ? s.total - prev.total : null;
    const dStr   = delta === null ? '—'
      : (delta >= 0 ? '+' : '−') + '$' + Math.abs(delta).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    const dCol   = delta === null ? 'var(--muted)' : delta >= 0 ? 'var(--green)' : 'var(--red)';
    const totStr = '$' + s.total.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

    return `<tr style="border-bottom:1px solid rgba(255,255,255,.025)">
      <td style="padding:8px 10px;color:var(--muted);font-size:11px;white-space:nowrap">${s.date}</td>
      <td style="padding:8px 10px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;color:var(--green);white-space:nowrap">${totStr}</td>
      <td style="padding:8px 10px;text-align:right;color:${dCol};font-variant-numeric:tabular-nums;white-space:nowrap">${dStr}</td>
      <td style="padding:8px 10px;color:var(--muted);font-size:10px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(s.note||'')}</td>
      <td style="padding:8px 4px;text-align:right">
        <button class="tlog-del" data-nwid="${escapeHTML(s.id)}"
          aria-label="Delete snapshot ${s.date}" style="font-size:11px;padding:4px 8px;min-width:auto;min-height:auto">✕</button>
      </td>
    </tr>`;
  }).join('');

  el.innerHTML = `<div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead>
        <tr style="border-bottom:1px solid var(--border)">
          <th style="text-align:left;padding:7px 10px;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600">Date</th>
          <th style="text-align:right;padding:7px 10px;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600">Net Worth</th>
          <th style="text-align:right;padding:7px 10px;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600">Change</th>
          <th style="text-align:left;padding:7px 10px;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600">Note</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ─── Main Render ──────────────────────────────────────────────────────────────
function renderNetWorth() {
  const snapshots = loadNW();
  renderNWKPIs(snapshots);
  renderNWBreakdown(snapshots);
  renderNWHistory(snapshots);
}

// ─── Init (called once from app.js init()) ────────────────────────────────────
function initNetWorth() {
  renderNWForm();
  renderNetWorth();
}
