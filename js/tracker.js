'use strict';

// ─── Tracker Constants ───────────────────────────────────────────────────────
// Anchor: Friday June 5 2026 — first payday. All 14-day periods computed from here.
const FIRST_PAYDAY = new Date('2026-06-05T00:00:00');
const PERIOD_MS    = 14 * 24 * 60 * 60 * 1000;

const INCOME_CATS = [
  {id:'paycheck',    l:'Paycheck',    e:'💵', c:'var(--green)'},
  {id:'bonus',       l:'Bonus',       e:'🎁', c:'var(--green)'},
  {id:'side-income', l:'Side Income', e:'💼', c:'var(--green)'},
  {id:'other-income',l:'Other Income',e:'📥', c:'var(--green)'},
];

// ─── State ────────────────────────────────────────────────────────────────────
let trackerOffset = 0;      // 0 = current period, -1 = previous, etc.
let TXN = [];               // all transactions
let editingTxnId = null;    // null = adding new, string id = editing existing

// ─── Persistence ─────────────────────────────────────────────────────────────
function loadTXN() {
  try {
    const raw = localStorage.getItem('wealthos_transactions');
    TXN = raw ? JSON.parse(raw) : [];
  } catch(e) { TXN = []; }
}

function saveTXN() {
  try { localStorage.setItem('wealthos_transactions', JSON.stringify(TXN)); }
  catch(e) {}
}

// ─── Period Math ──────────────────────────────────────────────────────────────
function getPeriod(offset) {
  const today  = new Date();
  const diffMs = today.getTime() - FIRST_PAYDAY.getTime();
  const curNum = Math.floor(diffMs / PERIOD_MS);   // which period index today falls in
  const num    = curNum + offset;                   // adjusted index
  const start  = new Date(FIRST_PAYDAY.getTime() + num * PERIOD_MS);
  const end    = new Date(start.getTime() + PERIOD_MS - 1);
  const dayOfP = offset === 0
    ? Math.min(Math.max(Math.floor((today - start) / 86400000) + 1, 1), 14)
    : null;
  // Period 1 = the first biweekly window starting on FIRST_PAYDAY
  const label  = num >= 0 ? `Pay Period ${num + 1}` : `Pre-start ${-num}`;
  const nextPayday = num >= 0
    ? new Date(start.getTime() + PERIOD_MS) // next payday is start of next period
    : FIRST_PAYDAY;
  const daysToNext = offset === 0
    ? Math.ceil((nextPayday - today) / 86400000)
    : null;
  return { num, label, start, end, dayOfPeriod: dayOfP, daysToNext, isCurrentPeriod: offset === 0 };
}

function fmtDate(d) {
  return d.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ─── Filter & Aggregate ───────────────────────────────────────────────────────
function txnsForPeriod(period) {
  return TXN.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    if (isNaN(d.getTime())) return false; // skip transactions with malformed dates
    return d >= period.start && d <= period.end;
  });
}

function spendByCategory(txns) {
  const map = {};
  txns.filter(t => t.type === 'expense').forEach(t => {
    map[t.category] = roundMoney((map[t.category] || 0) + t.amount);
  });
  return map;
}

// ─── Period Notes ─────────────────────────────────────────────────────────────
const _noteTimers = {};

function renderTrackerNotes(period) {
  const el = document.getElementById('tracker-notes-wrap');
  if (!el) return;
  const key   = `wealthos_notes_${period.num}`;
  const saved = (() => { try { return localStorage.getItem(key) || ''; } catch(e) { return ''; } })();

  el.innerHTML = `
    <div class="card" style="padding:12px 16px">
      <div class="card-title" style="margin-bottom:6px">Period notes — ${escapeHTML(period.label)}</div>
      <textarea id="tracker-note-area" class="txn-inp" rows="2"
        placeholder="Jot anything notable this pay period…"
        maxlength="500" style="resize:vertical;min-height:56px;line-height:1.5"
        aria-label="Notes for ${escapeHTML(period.label)}"
      >${escapeHTML(saved)}</textarea>
      <div style="font-size:10px;color:var(--muted);margin-top:4px;text-align:right" id="tracker-note-count">${saved.length}/500</div>
    </div>`;

  const ta = document.getElementById('tracker-note-area');
  ta.addEventListener('input', () => {
    document.getElementById('tracker-note-count').textContent = `${ta.value.length}/500`;
    clearTimeout(_noteTimers[key]);
    _noteTimers[key] = setTimeout(() => {
      try { localStorage.setItem(key, ta.value.slice(0, 500)); } catch(e) {}
    }, 500);
  });
}

// ─── Render: Period Header ────────────────────────────────────────────────────
function renderTrackerPeriodHeader(period) {
  const el = document.getElementById('tracker-period-header');
  const pct    = period.dayOfPeriod ? Math.round(period.dayOfPeriod / 14 * 100) : 0;
  const filled = Math.round(pct / 10);
  const bar    = '█'.repeat(filled) + '░'.repeat(10 - filled);

  const nextInfo = period.daysToNext !== null
    ? (period.daysToNext === 0
      ? '<span style="color:var(--green);font-weight:700">Payday today!</span>'
      : `Next payday in <strong style="color:var(--green)">${period.daysToNext} day${period.daysToNext !== 1 ? 's' : ''}</strong>`)
    : '';

  el.innerHTML = `
    <div class="tph">
      <button class="tpnav" id="tracker-prev" aria-label="Previous pay period">← Prev</button>
      <div class="tphc">
        <div class="tphl">${escapeHTML(period.label)}</div>
        <div class="tphd">${fmtDate(period.start)} – ${fmtDate(period.end)}</div>
        ${period.isCurrentPeriod
          ? `<div class="tphb">
               <span class="tphbar" aria-hidden="true">${bar}</span>
               <span class="tph-day"> Day ${period.dayOfPeriod}/14 · ${nextInfo}</span>
             </div>`
          : `<div class="tphb tphb-past">Completed period</div>`}
      </div>
      <button class="tpnav" id="tracker-next" aria-label="Next pay period"
        ${trackerOffset >= 0 ? 'disabled aria-disabled="true"' : ''}>Next →</button>
    </div>`;

}

// ─── Period Nav Delegation (wired once in initTracker) ────────────────────────
function initTrackerNav() {
  const headerEl = document.getElementById('tracker-period-header');
  if (!headerEl || headerEl._navDelegated) return;
  headerEl._navDelegated = true;
  headerEl.addEventListener('click', e => {
    if (e.target.id === 'tracker-prev') { trackerOffset--; renderTracker(); }
    if (e.target.id === 'tracker-next' && trackerOffset < 0) { trackerOffset++; renderTracker(); }
  });
}

// ─── Render: KPI Cards ────────────────────────────────────────────────────────
function renderTrackerKPIs(txns) {
  const el = document.getElementById('tracker-kpis');
  const spend       = spendByCategory(txns);
  const totalSpent  = roundMoney(Object.values(spend).reduce((a,b) => a+b, 0));
  const totalIncome = roundMoney(txns.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0));
  const remaining   = roundMoney(NET - totalSpent);
  const pct         = NET > 0 ? (totalSpent / NET * 100).toFixed(0) : 0;
  const spentColor  = totalSpent > NET ? 'var(--red)'
    : totalSpent / NET > 0.8 ? 'var(--orange)'
    : 'var(--green)';
  const remColor    = remaining < 0 ? 'var(--red)' : 'var(--green)';
  const fmtM = v => '$' + v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

  el.innerHTML = [
    {l:'Period Budget', v:fmtM(NET),        s:'biweekly take-home',              c:'var(--text)'},
    {l:'Spent',         v:fmtM(totalSpent),  s:`${pct}% of budget`,               c:spentColor},
    {l:'Remaining',     v:fmtM(remaining),   s:remaining<0?'over budget ⚠️':'still available', c:remColor},
    {l:'Income In',     v:fmtM(totalIncome), s:`of ${fmtM(NET)} expected`,         c:'var(--blue)'},
  ].map(k => `<div class="kpi">
    <div class="kl">${k.l}</div>
    <div class="kv" style="color:${k.c}">${k.v}</div>
    <div class="ks">${k.s}</div>
  </div>`).join('');
}

// ─── Render: Add Transaction Form (called ONCE from initTracker) ──────────────
function renderTrackerForm() {
  const el = document.getElementById('tracker-form-container');
  const expCats = S.map(s =>
    `<option value="${escapeHTML(s.id)}">${s.e} ${escapeHTML(s.l)}</option>`
  ).join('');
  const incCats = INCOME_CATS.map(c =>
    `<option value="${escapeHTML(c.id)}">${c.e} ${escapeHTML(c.l)}</option>`
  ).join('');

  el.innerHTML = `
    <form id="tracker-form" class="txn-form" novalidate>
      <div class="txn-row">
        <label class="txn-label" for="txn-type">Type</label>
        <select id="txn-type" class="txn-sel">
          <option value="expense">💸 Expense</option>
          <option value="income">💰 Income</option>
        </select>
      </div>
      <div class="txn-row">
        <label class="txn-label" for="txn-date">Date</label>
        <input id="txn-date" class="txn-inp" type="date" value="${todayISO()}" required>
      </div>
      <div class="txn-row">
        <label class="txn-label" for="txn-amount">Amount</label>
        <div style="flex:1;display:flex;align-items:center;gap:6px">
          <span style="color:var(--muted);font-size:13px">$</span>
          <input id="txn-amount" class="txn-inp" type="number" min="0.01" step="0.01"
            placeholder="0.00" required style="flex:1">
        </div>
      </div>
      <div class="txn-row" id="txn-cat-row">
        <label class="txn-label" for="txn-cat">Category</label>
        <select id="txn-cat" class="txn-sel">${expCats}</select>
      </div>
      <div class="txn-row">
        <label class="txn-label" for="txn-desc">Note</label>
        <input id="txn-desc" class="txn-inp" type="text"
          placeholder="e.g. Walmart groceries" maxlength="100">
      </div>
      <p class="txn-err" id="txn-err" role="alert" aria-live="polite"></p>
      <div style="display:flex;gap:8px">
        <button class="txn-submit" type="submit" id="txn-submit" style="flex:1">+ Log Transaction</button>
        <button class="txn-cancel" type="button" id="txn-cancel" style="display:none">Cancel</button>
      </div>
    </form>`;

  const typeEl = document.getElementById('txn-type');
  const catEl  = document.getElementById('txn-cat');

  typeEl.addEventListener('change', () => {
    catEl.innerHTML = typeEl.value === 'income' ? incCats : expCats;
  });

  // Cancel edit — reset form to "add" mode
  document.getElementById('txn-cancel').addEventListener('click', resetForm);

  function resetForm() {
    editingTxnId = null;
    const submitEl = document.getElementById('txn-submit');
    const cancelEl = document.getElementById('txn-cancel');
    submitEl.textContent = '+ Log Transaction';
    submitEl.style.background = '';
    cancelEl.style.display = 'none';
    document.getElementById('txn-amount').value = '';
    document.getElementById('txn-desc').value   = '';
    document.getElementById('txn-err').textContent = '';
  }

  document.getElementById('tracker-form').addEventListener('submit', e => {
    e.preventDefault();
    const errEl  = document.getElementById('txn-err');
    const type   = typeEl.value;
    const date   = document.getElementById('txn-date').value;
    const raw    = parseFloat(document.getElementById('txn-amount').value);
    const amount = roundMoney(Math.max(0, Math.min(raw || 0, 99999)));
    const cat    = catEl.value;
    const desc   = document.getElementById('txn-desc').value.trim().slice(0, 100);

    if (!date)       { errEl.textContent = 'Please pick a date.'; return; }
    if (amount <= 0) { errEl.textContent = 'Amount must be greater than $0.'; return; }
    errEl.textContent = '';

    if (editingTxnId) {
      // Update existing transaction
      const idx = TXN.findIndex(t => t.id === editingTxnId);
      if (idx !== -1) {
        TXN[idx] = { ...TXN[idx], date, type, amount, category: cat, description: desc };
      }
      resetForm();
    } else {
      // Add new transaction
      TXN.push({
        id:          'txn-' + Date.now() + Math.random().toString(36).slice(2, 5),
        date,
        type,
        amount,
        category:    cat,
        description: desc,
      });
      // Clear amount + note; keep date/type/category for quick repeat entry
      document.getElementById('txn-amount').value = '';
      document.getElementById('txn-desc').value   = '';
    }
    saveTXN();
    renderTracker();
  });
}

// ─── Populate Form for Editing ────────────────────────────────────────────────
function populateFormForEdit(id) {
  const t = TXN.find(x => x.id === id);
  if (!t) return;
  editingTxnId = id;

  const typeEl   = document.getElementById('txn-type');
  const catEl    = document.getElementById('txn-cat');
  const submitEl = document.getElementById('txn-submit');
  const cancelEl = document.getElementById('txn-cancel');

  typeEl.value = t.type;
  // Rebuild category options for this type
  catEl.innerHTML = t.type === 'income'
    ? INCOME_CATS.map(c => `<option value="${escapeHTML(c.id)}">${c.e} ${escapeHTML(c.l)}</option>`).join('')
    : S.map(s => `<option value="${escapeHTML(s.id)}">${s.e} ${escapeHTML(s.l)}</option>`).join('');
  catEl.value = t.category;

  document.getElementById('txn-date').value   = t.date;
  document.getElementById('txn-amount').value = t.amount;
  document.getElementById('txn-desc').value   = t.description || '';
  document.getElementById('txn-err').textContent = '';

  submitEl.textContent      = '✓ Update Transaction';
  submitEl.style.background = 'var(--blue)';
  cancelEl.style.display    = 'block';

  // Scroll to form so user sees it pre-filled
  document.getElementById('tracker-form-container').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─── Render: Planned vs Actual Chart ─────────────────────────────────────────
function renderTrackerChart(txns) {
  const el    = document.getElementById('tracker-chart');
  const spend = spendByCategory(txns);
  const maxV  = Math.max(...S.map(s => Math.max(s.sub, spend[s.id] || 0)), 1);

  el.innerHTML = S.map(s => {
    const planned = s.sub;
    const actual  = spend[s.id] || 0;
    const pct     = planned > 0 ? actual / planned * 100 : 0;
    const isOver  = actual > planned;
    const isWarn  = !isOver && pct >= 80;
    const barCol  = isOver ? 'var(--red)' : isWarn ? 'var(--orange)' : s.c;
    const status  = actual === 0 ? '' : isOver
      ? `⚠ Over by $${(actual - planned).toFixed(2)}`
      : `${pct.toFixed(0)}% used`;

    const planPct = (planned / maxV * 100).toFixed(1);
    const actPct  = (actual  / maxV * 100).toFixed(1);

    return `<div class="tcat">
      <div class="tcath">
        <span class="tcatn"><span aria-hidden="true">${s.e}</span> ${escapeHTML(s.l)}</span>
        <span class="tcats" style="color:${barCol}">${status}</span>
      </div>
      <div class="tcattrack"
        role="meter" aria-label="${escapeHTML(s.l)}: $${actual.toFixed(2)} of $${planned.toFixed(2)} planned"
        aria-valuenow="${actual.toFixed(2)}" aria-valuemin="0" aria-valuemax="${planned.toFixed(2)}"
        aria-valuetext="$${actual.toFixed(2)} of $${planned.toFixed(2)} planned (${pct.toFixed(0)}%)">
        <div class="tcatplan-bar" style="width:${planPct}%"></div>
        <div class="tcatact-bar"  style="width:${actPct}%;background:${barCol}"></div>
      </div>
      <div class="tcatfig">
        <span class="tcatfig-plan">Plan $${planned.toFixed(2)}</span>
        <span class="tcatfig-act" style="color:${barCol}">Actual $${actual.toFixed(2)}</span>
      </div>
    </div>`;
  }).join('');
}

// ─── Render: Insights ────────────────────────────────────────────────────────
function renderTrackerInsights(period, txns) {
  const el    = document.getElementById('tracker-insights');
  const spend = spendByCategory(txns);
  const totalSpent = roundMoney(Object.values(spend).reduce((a,b) => a+b, 0));
  const items = [];

  // Days remaining warning
  if (period.daysToNext !== null && period.daysToNext <= 3 && period.daysToNext > 0) {
    items.push({e:'⏰', t:`${period.daysToNext} day${period.daysToNext!==1?'s':''} until payday`, c:'var(--orange)'});
  }
  if (period.daysToNext === 0) {
    items.push({e:'🎉', t:'Payday today — log your income!', c:'var(--green)'});
  }

  // Over budget categories
  S.forEach(s => {
    const actual = spend[s.id] || 0;
    if (actual > s.sub) {
      items.push({e:'⚠️', t:`${s.l} over budget by $${(actual - s.sub).toFixed(2)}`, c:'var(--red)'});
    }
  });

  // Near-limit categories (80–99%)
  S.forEach(s => {
    const actual = spend[s.id] || 0;
    const pct = s.sub > 0 ? actual / s.sub : 0;
    if (pct >= 0.8 && pct <= 1) {
      items.push({e:'🔶', t:`${s.l} at ${(pct*100).toFixed(0)}% — $${(s.sub - actual).toFixed(2)} left`, c:'var(--orange)'});
    }
  });

  // Overall on-track message
  if (items.length === 0 && txns.length > 0) {
    items.push({e:'✅', t:`On track — $${(NET - totalSpent).toFixed(2)} remaining this period`, c:'var(--green)'});
  }
  if (txns.length === 0) {
    items.push({e:'📋', t:'No transactions yet — start logging to see insights', c:'var(--muted)'});
  }

  el.innerHTML = items.slice(0, 5).map(i =>
    `<div class="tins-item">
      <span aria-hidden="true">${i.e}</span>
      <span style="color:${i.c}">${escapeHTML(i.t)}</span>
    </div>`
  ).join('');
}

// ─── Render: Transaction Log ──────────────────────────────────────────────────
function renderTrackerLog(txns) {
  const el = document.getElementById('tracker-log');

  // Set up delegated click listener once — survives innerHTML replacement
  if (!el._delegated) {
    el._delegated = true;
    el.addEventListener('click', e => {
      const editBtn = e.target.closest('.tlog-edit');
      if (editBtn) { populateFormForEdit(editBtn.dataset.id); return; }

      const delBtn = e.target.closest('.tlog-del');
      if (delBtn) {
        const txn   = TXN.find(t => t.id === delBtn.dataset.id);
        const label = txn ? (txn.description || txn.date) : 'this transaction';
        if (confirm(`Delete "${label}"?`)) {
          if (editingTxnId === delBtn.dataset.id) {
            editingTxnId = null;
            const submitEl = document.getElementById('txn-submit');
            const cancelEl = document.getElementById('txn-cancel');
            if (submitEl) { submitEl.textContent = '+ Log Transaction'; submitEl.style.background = ''; }
            if (cancelEl) cancelEl.style.display = 'none';
          }
          TXN = TXN.filter(t => t.id !== delBtn.dataset.id);
          saveTXN();
          renderTracker();
        }
        return;
      }

      const expBtn = e.target.closest('#tracker-export-btn');
      if (expBtn) exportTransactionsCSV();
    });
  }

  if (txns.length === 0) {
    el.innerHTML = '<p class="tno-txn">No transactions logged for this period yet.</p>';
    return;
  }

  const sorted = [...txns].sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const allCats = [
    ...S.map(s => ({id:s.id, l:s.l, e:s.e, c:'var(--text)'})),
    ...INCOME_CATS,
  ];

  el.innerHTML = `
    <div class="tlog">
      <div class="tlog-head">
        <span>Date</span>
        <span>Note</span>
        <span>Category</span>
        <span class="tlog-right">Amount</span>
        <span></span>
      </div>
      ${sorted.map(t => {
        const cat  = allCats.find(c => c.id === t.category) || {l:t.category, e:'📋', c:'var(--muted)'};
        const sign = t.type === 'income' ? '+' : '−';
        const col  = t.type === 'income' ? 'var(--green)' : 'var(--text)';
        const dl   = new Date(t.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
        const amt  = t.amount.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
        return `<div class="tlog-row">
          <span class="tlog-date">${dl}</span>
          <span class="tlog-desc" title="${escapeHTML(t.description||'')}">${t.description ? escapeHTML(t.description) : '<span class="tlog-empty">—</span>'}</span>
          <span class="tlog-cat"><span aria-hidden="true">${cat.e}</span> ${escapeHTML(cat.l)}</span>
          <span class="tlog-amt tlog-right" style="color:${col}">${sign}$${amt}</span>
          <div class="tlog-actions">
            <button class="tlog-edit" data-id="${escapeHTML(t.id)}"
              aria-label="Edit: ${escapeHTML(t.description||dl)}">✏</button>
            <button class="tlog-del" data-id="${escapeHTML(t.id)}"
              aria-label="Delete: ${escapeHTML(t.description||dl)}">✕</button>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="tlog-export">
      <button class="vtb" id="tracker-export-btn" style="font-size:11px;padding:5px 12px">↓ Export CSV</button>
    </div>`;

}

// ─── Export transactions as CSV ───────────────────────────────────────────────
function exportTransactionsCSV() {
  const sorted = [...TXN].sort((a,b) => a.date.localeCompare(b.date));
  let csv = 'Date,Type,Amount,Category,Description\n';
  sorted.forEach(t => {
    // RFC 4180: escape double-quotes by doubling them; wrap fields in quotes
    const desc = (t.description || '').replace(/"/g, '""');
    const cat  = t.category.replace(/"/g, '""');
    csv += `${t.date},${t.type},"$${t.amount.toFixed(2)}","${cat}","${desc}"\n`;
  });
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'WealthOS_Transactions.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Backup & Restore ─────────────────────────────────────────────────────────
function renderTrackerBackup() {
  const el = document.getElementById('tracker-backup');
  if (!el) return;
  el.innerHTML = `
    <div class="card" style="margin-top:14px">
      <div class="card-title">Data backup &amp; restore</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px;line-height:1.5">
        Your transactions and checklist are saved in this browser only.
        Back up regularly to protect your data.
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="tact-btn primary" id="tracker-backup-btn">↓ Backup all data</button>
        <label class="tact-btn" for="tracker-restore-inp" style="cursor:pointer">↑ Restore from backup</label>
        <input type="file" id="tracker-restore-inp" accept=".json" class="sr-only">
      </div>
    </div>`;

  document.getElementById('tracker-backup-btn').addEventListener('click', backupData);
  document.getElementById('tracker-restore-inp').addEventListener('change', function() {
    if (this.files[0]) restoreData(this.files[0]);
    this.value = ''; // reset so same file can be re-selected
  });
}

function backupData() {
  // Collect all period notes keys
  const notes = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('wealthos_notes_')) notes[k] = localStorage.getItem(k);
    }
  } catch(e) {}

  const data = {
    version:         3,
    exported:        new Date().toISOString(),
    transactions:    TXN,
    checklist:       localStorage.getItem('wealthos_checklist'),
    healthInsurance: localStorage.getItem('wealthos_health_insurance'),
    networth:        localStorage.getItem('wealthos_networth'),
    creditscore:     localStorage.getItem('wealthos_creditscore'),
    periodNotes:     notes,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `WealthOS_Backup_${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function restoreData(file) {
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const data = JSON.parse(ev.target.result);
      if (!Array.isArray(data.transactions)) throw new Error('Invalid format');
      if (!confirm(`Restore ${data.transactions.length} transaction(s) from backup dated ${data.exported ? data.exported.slice(0,10) : 'unknown'}?\n\nThis will replace your current transactions.`)) return;
      TXN = data.transactions;
      saveTXN();
      if (data.checklist)       localStorage.setItem('wealthos_checklist', data.checklist);
      if (data.healthInsurance) localStorage.setItem('wealthos_health_insurance', data.healthInsurance);
      if (data.networth)        localStorage.setItem('wealthos_networth', data.networth);
      if (data.creditscore)     localStorage.setItem('wealthos_creditscore', data.creditscore);
      if (data.periodNotes)     Object.entries(data.periodNotes).forEach(([k, v]) => { try { localStorage.setItem(k, v); } catch(e) {} });
      renderTracker();
    } catch(err) {
      alert('Invalid backup file. Please use a WealthOS backup .json file.');
    }
  };
  reader.readAsText(file);
}

// ─── Render: Multi-Period Spending Comparison ─────────────────────────────────
function renderMultiPeriodChart() {
  const el = document.getElementById('tracker-multi-period');
  if (!el) return;

  // Collect last 6 periods
  const cols = [];
  for (let i = -5; i <= 0; i++) {
    const p     = getPeriod(i);
    const txns  = txnsForPeriod(p);
    const spend = spendByCategory(txns);
    const total = roundMoney(Object.values(spend).reduce((a, b) => a + b, 0));
    // Short label: month/day of period start
    const lbl = p.start.toLocaleDateString('en-US', {month:'short', day:'numeric'});
    cols.push({ total, lbl, isCurrent: i === 0, hasData: txns.length > 0 });
  }

  const anyData = cols.some(c => c.hasData);
  const maxVal  = Math.max(...cols.map(c => c.total), NET * 0.05); // at least 5% of budget for scale

  el.innerHTML = `
    <div class="card" style="margin-top:14px">
      <div class="card-title">Spending — last 6 pay periods</div>
      ${!anyData
        ? `<p style="font-size:11px;color:var(--muted);padding:8px 0">No spending data yet — will populate as you log transactions.</p>`
        : `<div class="mp-bars" style="margin-top:12px">
            ${cols.map(c => {
              const pct    = maxVal > 0 ? (c.total / maxVal * 100).toFixed(1) : '0';
              const isOver = c.total > NET;
              const col    = isOver ? 'var(--red)' : c.total / NET > 0.8 ? 'var(--orange)' : 'var(--green)';
              return `<div class="mp-bar-col">
                <div class="mp-val">${c.total > 0 ? '$' + Math.round(c.total).toLocaleString() : ''}</div>
                <div class="mp-bar-wrap">
                  <div class="mp-bar" style="height:${pct}%;background:${col};${c.isCurrent ? 'outline:1px dashed var(--brig);' : ''}"></div>
                </div>
              </div>`;
            }).join('')}
          </div>
          <div style="display:flex;gap:6px;margin-top:4px">
            ${cols.map(c => `<div class="mp-lbl" style="${c.isCurrent ? 'color:var(--text);font-weight:600' : ''}">${c.lbl}</div>`).join('')}
          </div>
          <div style="margin-top:10px;display:flex;align-items:center;gap:8px;font-size:10px;color:var(--muted)">
            <span style="width:16px;height:2px;background:var(--border);display:inline-block"></span>
            Budget: $${NET.toLocaleString('en-US',{maximumFractionDigits:0})} / period ·
            <span style="color:var(--text)">dashed = current period</span>
          </div>`}
    </div>`;
}

// ─── Main Render ─────────────────────────────────────────────────────────────
function renderTracker() {
  const period = getPeriod(trackerOffset);
  const txns   = txnsForPeriod(period);
  renderTrackerPeriodHeader(period);
  renderTrackerKPIs(txns);
  renderTrackerNotes(period);
  renderTrackerChart(txns);
  renderTrackerInsights(period, txns);
  renderTrackerLog(txns);
  renderMultiPeriodChart();
}

// ─── Init (called once from app.js init()) ────────────────────────────────────
function initTracker() {
  loadTXN();
  renderTrackerForm();   // only once — sets up persistent event listeners
  renderTrackerBackup(); // only once — backup/restore UI
  renderTracker();
  initTrackerNav();      // only once — delegates prev/next nav on permanent header container
}
