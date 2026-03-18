'use strict';

// ─── State ──────────────────────────────────────────────────────────────────
let budgetView = 'bw';
let tableView  = 'bw';

// Build checklist state from CHECKLIST_ITEMS with saved done-state from localStorage
const CL = CHECKLIST_ITEMS.map(item => ({...item, done: false}));

// ─── Utilities ───────────────────────────────────────────────────────────────

// Money format: convert biweekly amount to the selected period
function fmt(bw, mode) {
  const mul = mode === 'mo' ? 26 / 12 : mode === 'yr' ? 26 : 1;
  return '$' + (bw * mul).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
}

// Financial rounding — avoids floating-point drift (e.g. 425.50 - 12.50 + 15.75 = 428.7500000000001)
function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

// XSS guard — escape all user-derived strings before innerHTML injection
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── LocalStorage: Checklist ────────────────────────────────────────────────
function saveChecklist() {
  try {
    localStorage.setItem('wealthos_checklist', JSON.stringify(CL.map(x => x.done)));
  } catch(e) { /* storage unavailable */ }
}

function loadChecklist() {
  try {
    const saved = localStorage.getItem('wealthos_checklist');
    if (saved) {
      const states = JSON.parse(saved);
      states.forEach((done, i) => { if (CL[i]) CL[i].done = done; });
    }
  } catch(e) { /* ignore parse errors */ }
}

// ─── LocalStorage: Health Insurance ─────────────────────────────────────────
function saveHealthInsurance(value) {
  try {
    localStorage.setItem('wealthos_health_insurance', value);
  } catch(e) {}
}

function loadHealthInsurance() {
  try {
    return parseFloat(localStorage.getItem('wealthos_health_insurance')) || 0;
  } catch(e) { return 0; }
}

// ─── Tab Navigation ─────────────────────────────────────────────────────────
function switchTab(id) {
  document.querySelectorAll('.sec').forEach(s => {
    s.classList.remove('on');
    s.setAttribute('aria-hidden', 'true');
  });
  document.querySelectorAll('.ntab').forEach(t => {
    t.classList.remove('on');
    t.setAttribute('aria-selected', 'false');
  });

  const panel = document.getElementById(id);
  const btn   = document.querySelector(`.ntab[data-tab="${id}"]`);

  if (panel) {
    panel.classList.add('on');
    panel.setAttribute('aria-hidden', 'false');
    // Move focus into panel for keyboard users — rAF ensures display:block has applied
    requestAnimationFrame(() => panel.focus());
  }
  if (btn) {
    btn.classList.add('on');
    btn.setAttribute('aria-selected', 'true');
  }

  // Re-render tracker on switch — ensures current date/period is always fresh
  if (id === 'tracker' && typeof renderTracker === 'function') {
    renderTracker();
  }
  // Refresh Overview pulse when returning to Overview (picks up new transactions)
  if (id === 'overview') {
    renderOverviewTrackerPulse();
  }
}

// Arrow-key navigation within tablist
function initTabKeyboard() {
  const tabs = Array.from(document.querySelectorAll('.ntab'));
  tabs.forEach((tab, i) => {
    tab.addEventListener('keydown', e => {
      let next = -1;
      if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft')  next = (i - 1 + tabs.length) % tabs.length;
      if (e.key === 'Home')       next = 0;
      if (e.key === 'End')        next = tabs.length - 1;
      if (next >= 0) {
        e.preventDefault();
        tabs[next].focus();
        tabs[next].click();
      }
    });
  });
}

// ─── Overview: Tracker Pulse ─────────────────────────────────────────────────
// Shows real spending from the Tracker against planned budget on the Overview tab.
// Depends on tracker.js functions (getPeriod, txnsForPeriod, spendByCategory, TXN)
// — safe because all deferred scripts are loaded before DOMContentLoaded fires.
function renderOverviewTrackerPulse() {
  const el = document.getElementById('overview-tracker-pulse');
  if (!el) return;

  // Tracker not yet initialised (shouldn't happen, but guard anyway)
  if (typeof getPeriod !== 'function' || typeof TXN === 'undefined') return;

  const period = getPeriod(0);
  const txns   = txnsForPeriod(period);

  if (txns.length === 0) {
    el.innerHTML = `
      <div class="card" style="padding:14px 18px;display:flex;align-items:center;gap:12px">
        <span style="font-size:20px" aria-hidden="true">📊</span>
        <div>
          <div style="font-size:12px;font-weight:600;margin-bottom:2px">No transactions logged yet</div>
          <div style="font-size:11px;color:var(--muted)">
            Go to the <strong style="color:var(--text)">Tracker</strong> tab to log your spending and see real vs planned here.
          </div>
        </div>
      </div>`;
    return;
  }

  const spend      = spendByCategory(txns);
  const totalSpent = roundMoney(Object.values(spend).reduce((a, b) => a + b, 0));
  const remaining  = roundMoney(NET - totalSpent);
  const pct        = Math.min((totalSpent / NET * 100), 100).toFixed(0);
  const spentColor = totalSpent > NET ? 'var(--red)' : totalSpent / NET > 0.8 ? 'var(--orange)' : 'var(--green)';
  const remColor   = remaining < 0 ? 'var(--red)' : 'var(--green)';

  // Find over-budget categories (up to 3)
  const overBudget = S.filter(s => (spend[s.id] || 0) > s.sub).slice(0, 3);

  const fmtM = v => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dayInfo = period.daysToNext === 0
    ? '<span style="color:var(--green);font-weight:600">Payday today!</span>'
    : period.daysToNext !== null
      ? `Next payday in <strong style="color:var(--green)">${period.daysToNext} day${period.daysToNext !== 1 ? 's' : ''}</strong>`
      : '';

  el.innerHTML = `
    <div class="card" style="padding:14px 18px">
      <div class="card-title" style="margin-bottom:10px">
        This period — ${escapeHTML(period.label)}
        <span style="font-weight:400;color:var(--muted);text-transform:none;letter-spacing:0"> · ${dayInfo}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:${overBudget.length ? '12px' : '0'}">
        <div>
          <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px">Spent</div>
          <div style="font-size:18px;font-weight:700;color:${spentColor}">${fmtM(totalSpent)}</div>
          <div style="font-size:10px;color:var(--muted)">${pct}% of budget</div>
        </div>
        <div>
          <div style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px">Remaining</div>
          <div style="font-size:18px;font-weight:700;color:${remColor}">${fmtM(remaining)}</div>
          <div style="font-size:10px;color:var(--muted)">${remaining < 0 ? 'over budget ⚠️' : 'still available'}</div>
        </div>
      </div>
      ${overBudget.length ? `
        <div style="border-top:1px solid var(--border);padding-top:10px;display:flex;flex-wrap:wrap;gap:6px">
          ${overBudget.map(s => `
            <div style="font-size:10px;background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.2);border-radius:5px;padding:3px 8px;color:var(--red)">
              ⚠ ${escapeHTML(s.l)} over by $${(spend[s.id] - s.sub).toFixed(2)}
            </div>`).join('')}
        </div>` : ''}
    </div>`;
}

// ─── Overview: KPI Grid ──────────────────────────────────────────────────────
function renderKPIs() {
  const el = document.getElementById('kgrid');
  el.innerHTML = KPI_DATA.map(k =>
    `<div class="kpi">
      <div class="kl">${k.l}</div>
      <div class="kv" style="color:${k.c||'var(--text)'}">${k.v}</div>
      <div class="ks">${k.s}</div>
    </div>`
  ).join('');
}

// ─── Overview: Donut Chart ───────────────────────────────────────────────────
function renderDonut() {
  const svg = document.getElementById('donutSvg');
  if (!svg) return;
  const cx = 55, cy = 55, r = 38, sw = 12, ci = 2 * Math.PI * r;
  let off = 0;

  // Accessible title
  const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  titleEl.id = 'donut-title';
  titleEl.textContent = 'Budget allocation by category — biweekly view';
  svg.appendChild(titleEl);
  svg.setAttribute('aria-labelledby', 'donut-title');
  svg.setAttribute('role', 'img');

  S.forEach(s => {
    const pct  = s.sub / NET;
    const dash = pct * ci;
    const gap  = ci - dash;
    const c    = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', cx);
    c.setAttribute('cy', cy);
    c.setAttribute('r', r);
    c.setAttribute('fill', 'none');
    c.setAttribute('stroke', s.c);
    c.setAttribute('stroke-width', sw);
    c.setAttribute('stroke-dasharray', `${dash} ${gap}`);
    c.setAttribute('stroke-dashoffset', String(-off * ci));
    c.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
    svg.appendChild(c);
    off += pct;
  });

  ['$2,806', 'per paycheck'].forEach((txt, i) => {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', cx);
    t.setAttribute('y', i ? cy + 7 : cy - 4);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', i ? '#8a8aa6' : '#ededf5');
    t.setAttribute('font-size', i ? '7px' : '10px'); // explicit px units — avoids ambiguity in SVG contexts
    t.setAttribute('font-weight', i ? '400' : '700');
    t.setAttribute('aria-hidden', 'true');
    t.textContent = txt;
    svg.appendChild(t);
  });

  // Build legend with array + join (avoids innerHTML += quadratic re-parse anti-pattern)
  const leg = document.getElementById('dleg');
  leg.innerHTML = [...S].sort((a, b) => b.sub - a.sub).slice(0, 7).map(s =>
    `<div class="dli">
      <div class="dlid" style="background:${s.c}" aria-hidden="true"></div>
      <span class="dlin">${escapeHTML(s.l)}</span>
      <span class="dliv">$${s.sub.toFixed(0)}</span>
      <span class="dlip">${(s.sub / NET * 100).toFixed(1)}%</span>
    </div>`
  ).join('');
}

// ─── Overview: Spending Bars ─────────────────────────────────────────────────
function renderBars() {
  const el = document.getElementById('blist');
  const mx = Math.max(...S.map(s => s.sub));
  el.innerHTML = S.map(s => `<div class="bitem">
    <div class="bh">
      <span class="bname"><span aria-hidden="true">${s.e}</span> ${escapeHTML(s.l)}</span>
      <span class="bamnt">$${s.sub.toFixed(2)}</span>
    </div>
    <div class="btrack" role="progressbar" aria-valuenow="${s.sub.toFixed(0)}" aria-valuemin="0" aria-valuemax="${mx.toFixed(0)}" aria-label="${escapeHTML(s.l)}: $${s.sub.toFixed(2)} per paycheck">
      <div class="bfill" style="width:${(s.sub/mx*100).toFixed(0)}%;background:${s.c};opacity:.8"></div>
    </div>
  </div>`).join('');
}

// ─── Budget Grid ─────────────────────────────────────────────────────────────
function renderBudgetGrid() {
  const el = document.getElementById('bgrid');
  const m  = budgetView === 'mo' ? 26/12 : budgetView === 'yr' ? 26 : 1;
  el.innerHTML = S.map(s => {
    const tot = (s.sub * m).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
    const pct = (s.sub / NET * 100).toFixed(1);
    const items = s.items.map(it => {
      const v = (it.bw * m).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
      const amtClass = it.bw === 0 ? ' z' : '';
      const amtVal = it.bw === 0
        ? `<span class="bima hi-edit${amtClass}" data-bw="0" role="button" tabindex="0" aria-label="Edit health insurance amount" title="Click to update after HR Day 1">$0.00 ⚠</span>`
        : `<div class="bima">$${v}</div>`;
      return `<div class="bitem2">
        <div class="biml">
          <div class="bimd${it.b ? ' b' : ''}" aria-hidden="true"></div>
          <div>
            <div class="bimn">${it.n}</div>
            <div class="bimno">${it.nt}</div>
          </div>
        </div>
        ${amtVal}
      </div>`;
    }).join('');
    return `<div class="bcard" data-sec="${s.id}">
      <div class="bch">
        <div class="bchl">
          <span aria-hidden="true" style="font-size:15px">${s.e}</span>
          <span class="bcname" style="color:${s.c}">${s.l}</span>
          <span class="bcpct">${pct}%</span>
        </div>
        <span class="bctot">$${tot}</span>
      </div>
      <div class="bcbar" style="background:linear-gradient(90deg,${s.c}44,transparent)" aria-hidden="true"></div>
      ${items}
    </div>`;
  }).join('');
  // Re-attach health insurance edit handlers
  initHIEditors();
}

function setBudgetView(v, btn) {
  budgetView = v;
  document.querySelectorAll('#budgetVtog .vtb').forEach(b => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
  btn.classList.add('on');
  btn.setAttribute('aria-pressed', 'true');
  renderBudgetGrid();
}

function filterBudget() {
  const q = document.getElementById('sinp').value.toLowerCase();
  document.querySelectorAll('.bcard').forEach(c => {
    c.style.display = c.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

// ─── Health Insurance Inline Edit ────────────────────────────────────────────
function initHIEditors() {
  document.querySelectorAll('.hi-edit').forEach(el => {
    el.addEventListener('click', openHIEdit);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openHIEdit.call(el); }});
  });
}

function openHIEdit() {
  const el = this; // always set by addEventListener or .call(el)
  const savedVal = loadHealthInsurance();
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.min  = '0';
  inp.max  = String(NET); // can't exceed full paycheck
  inp.step = '0.01';
  inp.value = savedVal || '';
  inp.placeholder = 'Enter $ per paycheck';
  inp.className = 'hi-inp';
  inp.setAttribute('aria-label', 'Health insurance cost per paycheck');
  el.replaceWith(inp);
  inp.focus();

  function commit() {
    // Clamp: must be 0–NET, non-negative, non-infinite
    const raw = parseFloat(inp.value) || 0;
    const val = Math.max(0, Math.min(raw, NET));
    saveHealthInsurance(val);
    // Update the daily living sub-total in S using financial rounding
    const living = S.find(s => s.id === 'living');
    if (living) {
      const hiItem = living.items.find(i => i.n === 'Health Insurance');
      if (hiItem) {
        living.sub = roundMoney(living.sub - hiItem.bw + val);
        hiItem.bw = val;
      }
    }
    renderBudgetGrid();
  }
  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') inp.blur();
    if (e.key === 'Escape') { inp.value = savedVal; inp.blur(); }
  });
}

// ─── Full Table ───────────────────────────────────────────────────────────────
function renderTable() {
  const el  = document.getElementById('ftable');
  const m   = tableView === 'mo' ? 26/12 : tableView === 'yr' ? 26 : 1;
  const lbl = tableView === 'mo' ? 'Monthly' : tableView === 'yr' ? 'Annual' : 'Biweekly';

  let h = `<thead><tr>
    <th scope="col">Item</th>
    <th scope="col">${lbl} ($)</th>
    <th scope="col">% Net</th>
    <th scope="col">Notes</th>
  </tr></thead><tbody>`;

  h += `<tr class="sr"><th scope="rowgroup" colspan="4">💰 INCOME</th></tr>`;

  [
    ['Gross Per Paycheck', 3346.15, '', '26 pay periods'],
    ['Federal Tax', -540.38, '16.1%', 'No FICA on OPT'],
    ['✅ NET TAKE-HOME', 2805.77, '100%', 'Your real paycheck'],
  ].forEach(([n, v, p, nt]) => {
    const isNet = n.includes('NET');
    h += `<tr>
      <td${isNet ? ' style="font-weight:700"' : ''}>${n}</td>
      <td class="${isNet ? 'tg' : ''}">${v < 0 ? '-' : ''}$${Math.abs(v * m).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
      <td class="tm">${p}</td>
      <td class="tm">${nt}</td>
    </tr>`;
  });

  S.forEach(s => {
    h += `<tr class="sr">
      <th scope="rowgroup"><span aria-hidden="true">${s.e}</span> ${s.l.toUpperCase()}</th>
      <td>$${(s.sub * m).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
      <td class="tm">${(s.sub / NET * 100).toFixed(1)}%</td>
      <td></td>
    </tr>`;
    s.items.forEach(it => {
      h += `<tr>
        <td style="padding-left:20px">${it.n}</td>
        <td${it.bw === 0 ? ' style="color:var(--red)"' : ''}>$${(it.bw * m).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        <td class="tm">${(it.bw / NET * 100).toFixed(1)}%</td>
        <td class="tm">${it.nt}</td>
      </tr>`;
    });
  });

  el.innerHTML = h + '</tbody>';
}

function setTableView(v, btn) {
  tableView = v;
  document.querySelectorAll('#tableVtog .vtb').forEach(b => { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
  btn.classList.add('on');
  btn.setAttribute('aria-pressed', 'true');
  renderTable();
}

// ─── Export CSV ───────────────────────────────────────────────────────────────
function exportCSV() {
  const m   = tableView === 'mo' ? 26/12 : tableView === 'yr' ? 26 : 1;
  const lbl = tableView === 'mo' ? 'Monthly' : tableView === 'yr' ? 'Annual' : 'Biweekly';
  let csv    = `Item,${lbl} ($),% Net,Notes\n`;
  csv += `INCOME,,,\n`;
  csv += `Gross Per Paycheck,$${(GROSS_BW * m).toFixed(2)},,26 pay periods\n`;
  csv += `Federal Tax,-$${(TAX_BW * m).toFixed(2)},${(TAX_BW / GROSS_BW * 100).toFixed(1)}%,No FICA on OPT\n`;
  csv += `NET TAKE-HOME,$${(NET * m).toFixed(2)},100%,Your real paycheck\n`;
  S.forEach(s => {
    csv += `\n${s.l.toUpperCase()},$${(s.sub * m).toFixed(2)},${(s.sub / NET * 100).toFixed(1)}%,\n`;
    s.items.forEach(it => {
      const note = it.nt.replace(/,/g, ';'); // escape commas
      csv += `  ${it.n},$${(it.bw * m).toFixed(2)},${(it.bw / NET * 100).toFixed(1)}%,${note}\n`;
    });
  });

  const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `WealthOS_Budget_${lbl}_2026.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Wealth Tab ───────────────────────────────────────────────────────────────
function renderWealth() {
  const pg = document.getElementById('pgrid');
  pg.innerHTML = WEALTH_GOALS.map(it => {
    const yr1 = it.bw * 26;
    const pct = Math.min(yr1 / it.tgt * 100, 100).toFixed(0);
    return `<div class="pc">
      <div class="pcl">${it.l}</div>
      <div class="pca" style="color:${it.c}">$${Math.round(yr1).toLocaleString()}<span style="font-size:12px;color:var(--muted)">/yr</span></div>
      <div class="pcs">${it.nt}</div>
      <div class="pbar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${it.l}: ${pct}% of Year 1 target">
        <div class="pfill" style="width:${pct}%;background:${it.c}"></div>
      </div>
      <div class="pcpct">${pct}% of Year 1 target</div>
    </div>`;
  }).join('');

  const tl = document.getElementById('tl');
  tl.innerHTML = ML.map(m =>
    `<div class="tli">
      <div class="tla">Age ${m.age} · Year ${m.yr}</div>
      <div class="tlp">${m.p}</div>
      <div class="tls">${m.s}</div>
    </div>`
  ).join('');
}

// ─── Dating/Relationship Tab ──────────────────────────────────────────────────
function renderDating() {
  const makeCard = (tag, tit, bud, note, isFree) =>
    `<div class="dc">
      ${isFree ? '<span class="ftag">FREE</span>' : `<div class="dtag">${tag}</div>`}
      <div class="dtit">${tit}</div>
      ${(!isFree || bud !== '$0') ? `<div class="dbud">${bud}</div>` : ''}
      <div class="dnote">${note}</div>
    </div>`;

  document.getElementById('dbudg').innerHTML = DATING_BUDGET.map(d => makeCard(d.tag, d.tit, d.bud, d.note, false)).join('');
  document.getElementById('docc').innerHTML  = DATING_OCCASIONS.map(d => makeCard(d.tag, d.tit, d.bud, d.note, false)).join('');
  document.getElementById('dmarr').innerHTML = DATING_MARRIAGE.map(d => makeCard(d.tag, d.tit, d.bud, d.note, false)).join('');

  const freeEl = document.getElementById('dfree');
  freeEl.innerHTML = DATING_FREE.map(([t, cost, note]) =>
    makeCard('', t, cost, note, cost === '$0')
  ).join('');
}

// ─── Ghana Tab ────────────────────────────────────────────────────────────────
function renderGhana() {
  const ghanaData = S.find(x => x.id === 'ghana');
  const el = document.getElementById('ggrid');
  el.innerHTML = ghanaData.items.map(it =>
    `<div class="bcard">
      <div class="bch">
        <div class="bchl">
          <span aria-hidden="true" style="font-size:15px">🌍</span>
          <span class="bcname" style="color:#f87171">${it.n}</span>
        </div>
        <span class="bctot">$${it.bw}/BW</span>
      </div>
      <div style="padding:10px 14px">
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px">${it.nt}</div>
        <div style="font-size:12px;font-weight:600">$${Math.round(it.bw * 26).toLocaleString()}/yr</div>
      </div>
    </div>`
  ).join('');

  const gp = document.getElementById('gplan');
  gp.innerHTML = GHANA_PLAN.map(p =>
    `<div style="display:flex;gap:10px;align-items:flex-start">
      <div style="width:30px;height:30px;border-radius:8px;background:rgba(248,113,113,.12);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0" aria-hidden="true">${p.e}</div>
      <div>
        <div style="font-size:12px;font-weight:600;margin-bottom:2px">${p.t}</div>
        <div style="font-size:10px;color:var(--muted);line-height:1.4">${p.d}</div>
      </div>
    </div>`
  ).join('');
}

// ─── Roadmap Tab ──────────────────────────────────────────────────────────────
function renderRoadmap() {
  const el = document.getElementById('rgrid');
  el.innerHTML = ROADMAP_PHASES.map(p => {
    const items = p.items.map(i => `<div class="rit"><div class="rd ${p.d}" aria-hidden="true"></div><span>${i}</span></div>`).join('');
    return `<div class="rc"><div class="rph" style="color:${p.c}">${p.ph}</div>${items}</div>`;
  }).join('');
}

// ─── Checklist Tab ────────────────────────────────────────────────────────────
const TAG_LABELS = {tu:'Week 1', t1:'Year 1', t2:'Year 2', t3:'Year 3+'};

function renderChecklist() {
  const el = document.getElementById('clist');
  el.innerHTML = '';
  CL.forEach((item, i) => {
    const descId = `cl-desc-${i}`;
    const div = document.createElement('div');
    div.className = 'ci' + (item.done ? ' done' : '');
    div.setAttribute('role', 'checkbox');
    div.setAttribute('aria-checked', item.done ? 'true' : 'false');
    div.setAttribute('tabindex', '0');
    div.setAttribute('aria-label', escapeHTML(item.t));
    div.setAttribute('aria-describedby', descId); // links to the description text below
    div.innerHTML = `
      <div class="cbox" aria-hidden="true"><span class="ctick">✓</span></div>
      <div class="cc">
        <div class="ctit">${escapeHTML(item.t)}</div>
        <div class="cdesc" id="${descId}">${escapeHTML(item.d)}</div>
      </div>
      <span class="ctag ${item.tg}">${TAG_LABELS[item.tg]}</span>`;

    function toggle() {
      CL[i].done = !CL[i].done;
      div.classList.toggle('done');
      div.setAttribute('aria-checked', CL[i].done ? 'true' : 'false');
      updateChecklistProgress();
      saveChecklist();
    }

    div.addEventListener('click', toggle);
    div.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
    el.appendChild(div);
  });
  updateChecklistProgress();
}

function updateChecklistProgress() {
  const done = CL.filter(x => x.done).length;
  const tot  = CL.length;
  const pct  = Math.round(done / tot * 100);
  document.getElementById('cpfill').style.width = pct + '%';
  document.getElementById('ccount').textContent = `${done} of ${tot} completed (${pct}%)`;
  // Update progress bar aria
  const bar = document.getElementById('cpfill').parentElement;
  bar.setAttribute('aria-valuenow', pct);
  bar.setAttribute('aria-label', `Checklist progress: ${done} of ${tot} completed`);
}

// ─── Service Worker Registration ──────────────────────────────────────────────
function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failed — not critical, app still works online
      });
    });
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  // Restore persisted state
  loadChecklist();

  // Apply saved health insurance value
  const hiVal = loadHealthInsurance();
  if (hiVal > 0) {
    const living = S.find(s => s.id === 'living');
    if (living) {
      const hiItem = living.items.find(i => i.n === 'Health Insurance');
      if (hiItem) { living.sub = living.sub + hiVal; hiItem.bw = hiVal; }
    }
  }

  // Init tracker (loads transactions, wires form, renders tracker)
  if (typeof initTracker === 'function') initTracker();

  // Render all sections
  renderKPIs();
  renderOverviewTrackerPulse();
  renderDonut();
  renderBars();
  renderBudgetGrid();
  renderTable();
  renderWealth();
  renderDating();
  renderGhana();
  renderRoadmap();
  renderChecklist();

  // ── Wire up all event listeners (no inline onclick in HTML) ──

  // Tab navigation
  document.querySelectorAll('.ntab[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Budget period toggle
  const budgetVtog = document.getElementById('budgetVtog');
  if (budgetVtog) {
    budgetVtog.querySelectorAll('.vtb[data-view]').forEach(btn => {
      btn.addEventListener('click', () => setBudgetView(btn.dataset.view, btn));
    });
  }

  // Table period toggle
  const tableVtog = document.getElementById('tableVtog');
  if (tableVtog) {
    tableVtog.querySelectorAll('.vtb[data-view]').forEach(btn => {
      btn.addEventListener('click', () => setTableView(btn.dataset.view, btn));
    });
  }

  // Export CSV + Print
  const csvBtn = document.getElementById('btnExportCSV');
  if (csvBtn) csvBtn.addEventListener('click', exportCSV);

  const printBtn = document.getElementById('btnPrint');
  if (printBtn) printBtn.addEventListener('click', () => window.print());

  // Search input
  const sinp = document.getElementById('sinp');
  if (sinp) sinp.addEventListener('input', filterBudget);

  // Set up tab keyboard navigation
  initTabKeyboard();

  // Register service worker
  registerSW();
}

document.addEventListener('DOMContentLoaded', init);
