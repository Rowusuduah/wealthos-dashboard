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
      const delBtn = e.target.closest('[data-nwid]');
      if (delBtn && confirm('Delete this snapshot?')) {
        const data = loadNW().filter(s => s.id !== delBtn.dataset.nwid);
        saveNW(data);
        renderNetWorth();
        return;
      }
      if (e.target.id === 'nw-export-btn') exportNWCSV();
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
  </div>
  <div style="padding:10px 4px 2px">
    <button class="vtb" id="nw-export-btn" style="font-size:11px;padding:5px 12px">↓ Export CSV</button>
  </div>`;
}

// ─── Render: Trend Chart ──────────────────────────────────────────────────────
function renderNWChart(snapshots) {
  const el = document.getElementById('nw-chart');
  if (!el) return;

  if (snapshots.length < 2) {
    el.innerHTML = '<p style="font-size:11px;color:var(--muted);padding:4px 0">Add at least 2 snapshots to see the trend line.</p>';
    return;
  }

  const W = 500, H = 130, PL = 52, PR = 16, PT = 14, PB = 22;
  const vals  = snapshots.map(s => s.total);
  const minV  = Math.min(...vals);
  const maxV  = Math.max(...vals);
  const range = maxV - minV || 1;
  const n     = snapshots.length;

  const toX = i => PL + (i / (n - 1)) * (W - PL - PR);
  const toY = v => PT + (1 - (v - minV) / range) * (H - PT - PB);

  const pts  = snapshots.map((s, i) => `${toX(i).toFixed(1)},${toY(s.total).toFixed(1)}`).join(' ');
  const area = `M ${toX(0).toFixed(1)},${(H - PB).toFixed(1)} ` +
    snapshots.map((s, i) => `L ${toX(i).toFixed(1)},${toY(s.total).toFixed(1)}`).join(' ') +
    ` L ${toX(n - 1).toFixed(1)},${(H - PB).toFixed(1)} Z`;

  const fmtK = v => v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'K' : '$' + Math.round(v);

  // Mid x-axis label (show middle date if 4+ snapshots)
  const midLabel = n >= 4
    ? `<text x="${toX(Math.floor(n/2)).toFixed(1)}" y="${H}" text-anchor="middle" fill="var(--muted)" font-size="8">${snapshots[Math.floor(n/2)].date.slice(5)}</text>`
    : '';

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;overflow:visible" role="img"
    aria-label="Net worth trend from ${snapshots[0].date} to ${snapshots[n-1].date}">
    <title>Net worth over time — ${fmtK(minV)} to ${fmtK(maxV)}</title>
    <path d="${area}" fill="var(--green)" fill-opacity="0.08"/>
    <polyline points="${pts}" fill="none" stroke="var(--green)" stroke-width="2"
      stroke-linejoin="round" stroke-linecap="round"/>
    ${snapshots.map((s, i) =>
      `<circle cx="${toX(i).toFixed(1)}" cy="${toY(s.total).toFixed(1)}" r="3" fill="var(--green)">
        <title>$${s.total.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})} on ${s.date}</title>
      </circle>`
    ).join('')}
    <text x="${(PL - 4)}" y="${(PT + 4).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="8">${fmtK(maxV)}</text>
    <text x="${(PL - 4)}" y="${(H - PB + 4).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="8">${fmtK(minV)}</text>
    <text x="${toX(0).toFixed(1)}" y="${H}" text-anchor="middle" fill="var(--muted)" font-size="8">${snapshots[0].date.slice(5)}</text>
    ${midLabel}
    <text x="${toX(n-1).toFixed(1)}" y="${H}" text-anchor="middle" fill="var(--muted)" font-size="8">${snapshots[n-1].date.slice(5)}</text>
  </svg>`;
}

// ─── Credit Score Tracker ─────────────────────────────────────────────────────
function loadCS() {
  try { const r = localStorage.getItem('wealthos_creditscore'); return r ? JSON.parse(r) : []; }
  catch(e) { return []; }
}
function saveCS(data) {
  try { localStorage.setItem('wealthos_creditscore', JSON.stringify(data)); } catch(e) {}
}

function csBand(score) {
  if (score >= 800) return {l:'Exceptional', c:'var(--green)'};
  if (score >= 740) return {l:'Very Good',   c:'var(--blue)'};
  if (score >= 670) return {l:'Good',        c:'var(--teal)'};
  if (score >= 580) return {l:'Fair',        c:'var(--orange)'};
  return               {l:'Poor',         c:'var(--red)'};
}

function renderCSSection() {
  const el = document.getElementById('cs-section');
  if (!el) return;

  const data = loadCS();
  const latest = data.length > 0 ? data[data.length - 1] : null;

  // Set up delegation once
  if (!el._csDelegated) {
    el._csDelegated = true;
    el.addEventListener('click', e => {
      const delBtn = e.target.closest('[data-csid]');
      if (delBtn && confirm('Delete this entry?')) {
        saveCS(loadCS().filter(s => s.id !== delBtn.dataset.csid));
        renderCSSection();
      }
    });
    el.addEventListener('submit', e => {
      if (e.target.id === 'cs-form') {
        e.preventDefault();
        const date  = document.getElementById('cs-date').value;
        const score = parseInt(document.getElementById('cs-score-inp').value, 10);
        const note  = document.getElementById('cs-note').value.trim().slice(0, 100);
        const errEl = document.getElementById('cs-err');
        if (!date)                           { errEl.textContent = 'Pick a date.'; return; }
        if (!score || score < 300 || score > 850) { errEl.textContent = 'Score must be 300–850.'; return; }
        errEl.textContent = '';
        const saved = loadCS();
        saved.push({ id:'cs-' + Date.now(), date, score, note });
        saved.sort((a, b) => a.date.localeCompare(b.date));
        saveCS(saved);
        document.getElementById('cs-score-inp').value = '';
        document.getElementById('cs-note').value = '';
        renderCSSection();
      }
    });
  }

  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const band  = latest ? csBand(latest.score) : null;

  const histRows = [...data].reverse().map((s, i, arr) => {
    const prev   = arr[i + 1];
    const delta  = prev ? s.score - prev.score : null;
    const dStr   = delta === null ? '—' : (delta >= 0 ? '+' : '') + delta;
    const dCol   = delta === null ? 'var(--muted)' : delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--red)' : 'var(--muted)';
    const b      = csBand(s.score);
    return `<tr style="border-bottom:1px solid rgba(255,255,255,.025)">
      <td style="padding:7px 10px;color:var(--muted);font-size:11px">${s.date}</td>
      <td style="padding:7px 10px;text-align:right;font-weight:700;color:${b.c}">${s.score}</td>
      <td style="padding:7px 10px;text-align:right;color:${dCol};font-size:11px">${dStr}</td>
      <td style="padding:7px 10px;color:var(--muted);font-size:10px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(s.note||'')}</td>
      <td style="padding:7px 4px;text-align:right">
        <button class="tlog-del" data-csid="${escapeHTML(s.id)}"
          aria-label="Delete score entry ${s.date}" style="font-size:11px;padding:4px 8px;min-width:auto;min-height:auto">✕</button>
      </td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start">
      <!-- Current score display -->
      <div>
        ${latest ? `
          <div class="cs-score-display">
            <div class="cs-score-num" style="color:${band.c}">${latest.score}</div>
            <div class="cs-score-band" style="color:${band.c}">${band.l}</div>
            <div class="cs-score-date">as of ${latest.date}</div>
          </div>
          <div style="background:linear-gradient(90deg,var(--red),var(--orange),var(--gold),var(--teal),var(--green));
            height:6px;border-radius:3px;margin:8px 0;position:relative">
            <div style="position:absolute;top:-2px;
              left:calc(${Math.min(Math.max((latest.score - 300) / 550 * 100, 0), 100).toFixed(1)}% - 5px);
              width:10px;height:10px;border-radius:50%;background:var(--text);border:2px solid var(--surf)"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--muted)">
            <span>300</span><span>580</span><span>670</span><span>740</span><span>800</span><span>850</span>
          </div>` : `
          <div class="cs-score-display">
            <div class="cs-score-num" style="color:var(--muted)">—</div>
            <div class="cs-score-band" style="color:var(--muted)">No entries yet</div>
            <div class="cs-score-date">Log your first reading below</div>
          </div>`}
      </div>
      <!-- Add form -->
      <form id="cs-form" class="txn-form" novalidate>
        <div class="txn-row">
          <label class="txn-label" for="cs-date">Date</label>
          <input id="cs-date" class="txn-inp" type="date" value="${today}" required>
        </div>
        <div class="txn-row">
          <label class="txn-label" for="cs-score-inp">Score</label>
          <input id="cs-score-inp" class="txn-inp" type="number" min="300" max="850" step="1"
            placeholder="300–850" required>
        </div>
        <div class="txn-row">
          <label class="txn-label" for="cs-note">Note</label>
          <input id="cs-note" class="txn-inp" type="text" placeholder="e.g. Discover card hit" maxlength="100">
        </div>
        <p class="txn-err" id="cs-err" role="alert" aria-live="polite"></p>
        <button class="txn-submit" type="submit" style="margin-top:2px">+ Log Score</button>
      </form>
    </div>
    ${data.length > 0 ? `
    <div style="margin-top:14px;overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead>
          <tr style="border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:7px 10px;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600">Date</th>
            <th style="text-align:right;padding:7px 10px;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600">Score</th>
            <th style="text-align:right;padding:7px 10px;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600">Change</th>
            <th style="text-align:left;padding:7px 10px;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600">Note</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${histRows}</tbody>
      </table>
    </div>` : ''}`;
}

// ─── Export CSV ───────────────────────────────────────────────────────────────
function exportNWCSV() {
  const snapshots = loadNW();
  if (snapshots.length === 0) return;

  // Header: Date, Total, per-account columns, Note
  const accountCols = NW_ACCOUNTS.map(a => `"${a.l.replace(/"/g, '""')}"`).join(',');
  let csv = `Date,Net Worth,${accountCols},Change,Note\n`;

  snapshots.forEach((s, i) => {
    const prev  = i > 0 ? snapshots[i - 1] : null;
    const delta = prev !== null ? (s.total - prev.total).toFixed(2) : '';
    const accs  = NW_ACCOUNTS.map(a => `"$${(s.accounts[a.id] || 0).toFixed(2)}"`).join(',');
    const note  = (s.note || '').replace(/"/g, '""');
    csv += `${s.date},"$${s.total.toFixed(2)}",${accs},"${delta ? (delta >= 0 ? '+' : '') + delta : ''}","${note}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'WealthOS_NetWorth.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Main Render ──────────────────────────────────────────────────────────────
function renderNetWorth() {
  const snapshots = loadNW();
  renderNWKPIs(snapshots);
  renderNWBreakdown(snapshots);
  renderNWChart(snapshots);
  renderNWHistory(snapshots);
  renderCSSection();
}

// ─── Init (called once from app.js init()) ────────────────────────────────────
function initNetWorth() {
  renderNWForm();
  renderNetWorth();
}
