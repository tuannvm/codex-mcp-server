// ── Auth ─────────────────────────────────────────────────
function getAuthToken() { return localStorage.getItem('auth_token'); }

async function apiFetch(url, opts = {}) {
  const token = getAuthToken();
  if (token) {
    opts.headers = { ...opts.headers, 'Authorization': 'Bearer ' + token };
  }
  const res = await fetch(url, opts);
  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    window.location.href = '/login.html';
    throw new Error('Unauthorized');
  }
  return res;
}

function logout() {
  localStorage.removeItem('auth_token');
  window.location.href = '/login.html';
}

// ── State ────────────────────────────────────────────────
let entities = { self: null, competitors: [], all: [] };
let articleOffset = 0;
const ARTICLE_LIMIT = 50;
let searchTimer = null;

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Auth check — redirect to login if no token
  if (!getAuthToken()) { window.location.href = '/login.html'; return; }
  await loadEntities();
  loadBrief(); // Daily Brief is now the default tab

  // Default calendar date range: today - 7 days to today + 90 days
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  const end = new Date(now);
  end.setDate(end.getDate() + 90);
  document.getElementById('filterStartDate').value = isoDate(start);
  document.getElementById('filterEndDate').value = isoDate(end);

  // Populate AUM and SEC entity selects
  populateAumEntitySelect();
  populateSecEntitySelect();
});

// ── Entities ─────────────────────────────────────────────
async function loadEntities() {
  try {
    const res = await apiFetch('/api/entities');
    entities = await res.json();
    populateEntityFilters();
  } catch (err) {
    console.error('Failed to load entities:', err);
  }
}

function populateEntityFilters() {
  const tier1 = document.getElementById('tier1Options');
  const tier2 = document.getElementById('tier2Options');
  tier1.innerHTML = '';
  tier2.innerHTML = '';

  for (const c of entities.competitors) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    if (c.tier === 1) tier1.appendChild(opt);
    else tier2.appendChild(opt);
  }
}

// ── Articles ─────────────────────────────────────────────
async function loadArticles(append = false) {
  if (!append) articleOffset = 0;

  const entity = document.getElementById('filterEntity').value;
  const sentiment = document.getElementById('filterSentiment').value;
  const search = document.getElementById('filterSearch').value;

  const params = new URLSearchParams({
    entity, sentiment, search,
    limit: ARTICLE_LIMIT,
    offset: articleOffset,
  });

  try {
    const res = await apiFetch(`/api/articles?${params}`);
    const articles = await res.json();

    const container = document.getElementById('articlesList');
    if (!append) container.innerHTML = '';

    if (articles.length === 0 && !append) {
      container.innerHTML = '<div class="empty">No articles found. Run a crawl to get started.</div>';
      document.getElementById('btnLoadMore').style.display = 'none';
      return;
    }

    for (const a of articles) {
      container.appendChild(renderArticle(a));
    }

    document.getElementById('btnLoadMore').style.display =
      articles.length === ARTICLE_LIMIT ? 'inline-block' : 'none';
  } catch (err) {
    console.error('Failed to load articles:', err);
  }
}

function loadMore() {
  articleOffset += ARTICLE_LIMIT;
  loadArticles(true);
}

function renderArticle(a) {
  const div = document.createElement('div');
  div.className = `article-card${a.entity_id === 'dobbs-group' ? ' self' : ''}${a.priority ? ' priority' : ''}`;

  const isSelf = a.entity_id === 'dobbs-group';
  const pubDate = a.pub_date ? new Date(a.pub_date) : null;
  const dateStr = pubDate ? formatDateTime(pubDate) : '';
  const timeAgo = pubDate ? getTimeAgo(pubDate) : '';

  div.innerHTML = `
    <div class="article-header">
      <a href="${escHtml(a.link)}" target="_blank" rel="noopener" class="article-title">${escHtml(a.title)}</a>
      <div class="article-badges">
        ${a.priority ? '<span class="priority-badge">RATE</span>' : ''}
        <span class="sentiment-badge sentiment-${a.sentiment_label}">${a.sentiment_label}</span>
      </div>
    </div>
    <div class="article-meta">
      <span class="entity-tag${isSelf ? ' self-tag' : ''}">${escHtml(a.entity_name)}</span>
      ${a.source ? `<span class="article-source">${escHtml(a.source)}</span>` : ''}
      <span class="article-date" title="${dateStr}">${timeAgo || dateStr}</span>
    </div>
    ${a.snippet ? `<div class="article-snippet">${escHtml(a.snippet).substring(0, 300)}${a.snippet.length > 300 ? '...' : ''}</div>` : ''}
    <div class="article-footer">
      <a href="${escHtml(a.link)}" target="_blank" rel="noopener" class="read-more">Read full article &#8594;</a>
    </div>
  `;
  return div;
}

function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return '';
}

function formatDateTime(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function debounceSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadArticles(), 400);
}

// ── Stats ────────────────────────────────────────────────
async function loadStats() {
  try {
    const res = await apiFetch('/api/stats');
    const stats = await res.json();
    renderStats(stats);
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

function renderStats(stats) {
  const container = document.getElementById('statsGrid');
  container.innerHTML = '';

  if (stats.length === 0) {
    container.innerHTML = '<div class="empty">No data yet. Run a crawl to get started.</div>';
    return;
  }

  // Self card first
  const selfStat = stats.find(s => s.entity_id === 'dobbs-group');
  if (selfStat) {
    container.appendChild(renderStatCard(selfStat, true));
  }

  // Competitors
  for (const s of stats) {
    if (s.entity_id === 'dobbs-group') continue;
    container.appendChild(renderStatCard(s, false));
  }
}

function renderStatCard(s, isSelf) {
  const entity = entities.all.find(e => e.id === s.entity_id);
  const tier = entity ? (entity.tier === 'self' ? 'Self' : `Tier ${entity.tier}`) : '';

  const total = s.total || 1;
  const posPct = Math.round((s.positive / total) * 100);
  const neuPct = Math.round((s.neutral / total) * 100);
  const negPct = 100 - posPct - neuPct;

  const div = document.createElement('div');
  div.className = `stat-card${isSelf ? ' self-card' : ''}`;
  div.style.cursor = 'pointer';
  div.onclick = () => navigateToEntity(s.entity_id);
  div.innerHTML = `
    <div class="stat-card-header">
      <h3>
        ${escHtml(s.entity_name)}
        <span class="tier-badge">${tier}</span>
      </h3>
      <span class="stat-arrow">View Articles &#8594;</span>
    </div>
    <div class="stat-numbers">
      <div class="stat-num total"><div class="num">${s.total}</div><div class="lbl">Total</div></div>
      <div class="stat-num pos"><div class="num">${s.positive}</div><div class="lbl">Positive</div></div>
      <div class="stat-num neu"><div class="num">${s.neutral}</div><div class="lbl">Neutral</div></div>
      <div class="stat-num neg"><div class="num">${s.negative}</div><div class="lbl">Negative</div></div>
    </div>
    <div class="stat-bar">
      <div class="stat-bar-pos" style="width:${posPct}%" title="${posPct}% Positive"></div>
      <div class="stat-bar-neu" style="width:${neuPct}%" title="${neuPct}% Neutral"></div>
      <div class="stat-bar-neg" style="width:${negPct}%" title="${negPct}% Negative"></div>
    </div>
    <div class="stat-latest">Latest: ${s.latest_article ? formatDateTime(s.latest_article) : 'N/A'}</div>
  `;
  return div;
}

function navigateToEntity(entityId) {
  document.getElementById('filterEntity').value = entityId;
  document.getElementById('filterSentiment').value = 'all';
  document.getElementById('filterSearch').value = '';
  switchTab('news');
  loadArticles();
}

// ── Calendar ─────────────────────────────────────────────
async function loadEvents() {
  const category = document.getElementById('filterEventCat').value;
  const start = document.getElementById('filterStartDate').value;
  const end = document.getElementById('filterEndDate').value;

  const params = new URLSearchParams();
  if (category !== 'all') params.set('category', category);
  if (start) params.set('start', start);
  if (end) params.set('end', end);

  try {
    const res = await apiFetch(`/api/events?${params}`);
    const events = await res.json();
    renderCalendar(events);
  } catch (err) {
    console.error('Failed to load events:', err);
  }
}

function renderCalendar(events) {
  const container = document.getElementById('calendarView');
  container.innerHTML = '';

  if (events.length === 0) {
    container.innerHTML = '<div class="empty">No events found. Try updating the calendar or adjusting your filters.</div>';
    return;
  }

  // Group by date
  const grouped = {};
  for (const e of events) {
    const d = e.event_date;
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(e);
  }

  const today = isoDate(new Date());

  for (const [date, dayEvents] of Object.entries(grouped)) {
    const group = document.createElement('div');
    group.className = 'cal-date-group';

    const dateObj = new Date(date + 'T12:00:00');
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const isToday = date === today;

    group.innerHTML = `
      <div class="cal-date-header${isToday ? ' today' : ''}">
        ${dateStr} <span class="day-name">${dayName}${isToday ? ' (Today)' : ''}</span>
      </div>
    `;

    for (const evt of dayEvents) {
      const catClass = getCatClass(evt.category);
      const eventEl = document.createElement('div');
      eventEl.className = 'cal-event';
      eventEl.innerHTML = `
        <span class="event-cat ${catClass}">${escHtml(evt.category)}</span>
        <div class="event-info">
          <h4>${escHtml(evt.title)}${evt.event_time ? ` <small style="color:var(--text-muted)">${escHtml(evt.event_time)}</small>` : ''}</h4>
          ${evt.description ? `<p>${escHtml(evt.description).substring(0, 200)}</p>` : ''}
          ${evt.link ? `<a href="${escHtml(evt.link)}" target="_blank" rel="noopener">View details</a>` : ''}
        </div>
      `;
      group.appendChild(eventEl);
    }
    container.appendChild(group);
  }
}

function getCatClass(category) {
  if (!category) return '';
  const c = category.toLowerCase();
  if (c.includes('fomc') || c.includes('monetary')) return 'fomc';
  if (c.includes('federal reserve')) return 'fed';
  if (c.includes('sec')) return 'sec';
  if (c.includes('treasury')) return 'treasury';
  if (c.includes('labor')) return 'labor';
  if (c.includes('bls') || c.includes('economic')) return 'bls';
  return '';
}

// ── Crawl Log ────────────────────────────────────────────
async function loadCrawlLog() {
  try {
    const res = await apiFetch('/api/crawl-log');
    const logs = await res.json();
    renderCrawlLog(logs);
  } catch (err) {
    console.error('Failed to load crawl log:', err);
  }
}

function renderCrawlLog(logs) {
  const container = document.getElementById('crawlLogList');
  if (logs.length === 0) {
    container.innerHTML = '<div class="empty">No crawl history yet.</div>';
    return;
  }
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>Type</th>
          <th>Entity</th>
          <th>Found</th>
          <th>Status</th>
          <th>Error</th>
        </tr>
      </thead>
      <tbody>
        ${logs.map(l => `
          <tr>
            <td>${l.started_at ? new Date(l.started_at).toLocaleString() : ''}</td>
            <td>${escHtml(l.crawl_type)}</td>
            <td>${escHtml(l.entity_id || '-')}</td>
            <td>${l.articles_found}</td>
            <td class="status-${l.status}">${l.status}</td>
            <td style="color:var(--negative); font-size:12px;">${escHtml(l.error_message || '')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ── Tab Switching ────────────────────────────────────────
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');

  // Lazy load tab data
  if (tabName === 'brief') loadBrief();
  if (tabName === 'news') { loadArticles(); loadPriorityArticles(); }
  if (tabName === 'fin-news') loadFinArticles();
  if (tabName === 'stats') { loadStats(); loadCustomEntities(); }
  if (tabName === 'aum') loadAum();
  if (tabName === 'market') loadMarketIndicators();
  if (tabName === 'holdings') loadHoldingsEntities();
  if (tabName === 'sec') { loadSecFilings(); loadFinraAlerts(); }
  if (tabName === 'predictions') loadPredictions();
  if (tabName === 'calendar') loadEvents();
  if (tabName === 'log') loadCrawlLog();
}

// ── Actions ──────────────────────────────────────────────
async function triggerCrawl() {
  const btn = document.getElementById('btnCrawlAll');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Crawling...';

  try {
    const res = await apiFetch('/api/crawl', { method: 'POST' });
    const data = await res.json();
    btn.textContent = `Done! (${data.newArticles} new)`;
    setTimeout(() => { btn.textContent = 'Crawl Now'; btn.disabled = false; }, 3000);
    loadArticles();
    loadStats();
  } catch (err) {
    btn.textContent = 'Error';
    setTimeout(() => { btn.textContent = 'Crawl Now'; btn.disabled = false; }, 3000);
  }
}

async function triggerGovCrawl() {
  const btn = document.getElementById('btnCrawlGov');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Updating...';

  try {
    const res = await apiFetch('/api/crawl/gov', { method: 'POST' });
    const data = await res.json();
    btn.textContent = `Done! (${data.newEvents} new)`;
    setTimeout(() => { btn.textContent = 'Update Calendar'; btn.disabled = false; }, 3000);
    if (document.getElementById('tab-calendar').classList.contains('active')) {
      loadEvents();
    }
  } catch (err) {
    btn.textContent = 'Error';
    setTimeout(() => { btn.textContent = 'Update Calendar'; btn.disabled = false; }, 3000);
  }
}

// ── Priority Articles ────────────────────────────────────
async function loadPriorityArticles() {
  try {
    const res = await apiFetch('/api/articles?priority=true&limit=10');
    const articles = await res.json();

    const section = document.getElementById('prioritySection');
    const container = document.getElementById('priorityArticles');

    if (articles.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    container.innerHTML = '';
    for (const a of articles) {
      const div = document.createElement('div');
      div.className = 'priority-card';
      const pubDate = a.pub_date ? new Date(a.pub_date) : null;
      const timeAgo = pubDate ? getTimeAgo(pubDate) : '';
      div.innerHTML = `
        <a href="${escHtml(a.link)}" target="_blank" rel="noopener" class="priority-title">${escHtml(a.title)}</a>
        <div class="priority-meta">
          <span class="entity-tag">${escHtml(a.entity_name)}</span>
          <span>${escHtml(a.source)}</span>
          <span>${timeAgo}</span>
          <span class="sentiment-badge sentiment-${a.sentiment_label}">${a.sentiment_label}</span>
        </div>
      `;
      container.appendChild(div);
    }
  } catch (err) {
    console.error('Failed to load priority articles:', err);
  }
}

// ── AUM ─────────────────────────────────────────────────
function populateAumEntitySelect() {
  const select = document.getElementById('aumEntity');
  if (!select) return;
  select.innerHTML = '<option value="">Select company...</option>';
  for (const e of entities.all || []) {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = e.name;
    select.appendChild(opt);
  }
}

async function loadAum() {
  try {
    const res = await apiFetch('/api/aum');
    const data = await res.json();
    renderAumChart(data);
  } catch (err) {
    console.error('Failed to load AUM:', err);
  }
}

function renderAumChart(entries) {
  const container = document.getElementById('aumChart');
  if (!entries || entries.length === 0) {
    container.innerHTML = '<div class="empty">No AUM data yet.</div>';
    return;
  }

  const sorted = [...entries].sort((a, b) => b.aum_billions - a.aum_billions);
  const maxAum = sorted[0].aum_billions;
  container.innerHTML = '';

  for (const e of sorted) {
    const pct = Math.max((e.aum_billions / maxAum) * 100, 2);
    const isSelf = e.entity_id === 'dobbs-group';
    const hasBreakdown = e.discretionary_billions != null || (e.asset_classes && e.asset_classes.length > 0);
    const row = document.createElement('div');
    row.className = `aum-row${isSelf ? ' aum-self' : ''}${hasBreakdown ? ' aum-expandable' : ''}`;

    // Discretionary / Non-Discretionary bar
    let breakdownHtml = '';
    if (hasBreakdown) {
      const disc = e.discretionary_billions || 0;
      const nonDisc = e.non_discretionary_billions || 0;
      const total = disc + nonDisc || e.aum_billions;
      const discPct = ((disc / total) * 100).toFixed(1);
      const nonDiscPct = ((nonDisc / total) * 100).toFixed(1);

      breakdownHtml += `<div class="aum-breakdown">
        <div class="aum-breakdown-section">
          <div class="aum-breakdown-title">Discretionary vs Non-Discretionary</div>
          <div class="aum-split-bar">
            <div class="aum-split-disc" style="width:${discPct}%" title="Discretionary: $${formatBillions(disc)} (${discPct}%)"></div>
            <div class="aum-split-nondisc" style="width:${nonDiscPct}%" title="Non-Discretionary: $${formatBillions(nonDisc)} (${nonDiscPct}%)"></div>
          </div>
          <div class="aum-split-legend">
            <span class="aum-legend-disc">Discretionary: $${formatBillions(disc)} (${discPct}%)</span>
            <span class="aum-legend-nondisc">Non-Disc: $${formatBillions(nonDisc)} (${nonDiscPct}%)</span>
          </div>
        </div>`;

      // Asset class bars
      if (e.asset_classes && e.asset_classes.length > 0) {
        const maxAc = Math.max(...e.asset_classes.map(ac => ac.amount_billions));
        const acColors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
        breakdownHtml += `<div class="aum-breakdown-section">
          <div class="aum-breakdown-title">Asset Class Breakdown</div>
          <div class="aum-ac-bars">`;
        e.asset_classes.forEach((ac, i) => {
          const acPct = Math.max((ac.amount_billions / maxAc) * 100, 3);
          const color = acColors[i % acColors.length];
          const totalPct = ((ac.amount_billions / e.aum_billions) * 100).toFixed(1);
          breakdownHtml += `<div class="aum-ac-row">
              <span class="aum-ac-name">${escHtml(ac.name)}</span>
              <div class="aum-ac-bar-track">
                <div class="aum-ac-bar-fill" style="width:${acPct}%;background:${color}"></div>
              </div>
              <span class="aum-ac-value">$${formatBillions(ac.amount_billions)} <small>(${totalPct}%)</small></span>
            </div>`;
        });
        breakdownHtml += `</div></div>`;
      }
      breakdownHtml += `</div>`;
    }

    row.innerHTML = `
      <div class="aum-label">
        <span class="aum-name">${hasBreakdown ? '<span class="aum-expand-icon">&#9654;</span> ' : ''}${escHtml(e.entity_name)}</span>
        <span class="aum-value">$${formatBillions(e.aum_billions)}</span>
      </div>
      <div class="aum-bar-track">
        <div class="aum-bar-fill${isSelf ? ' self-fill' : ''}" style="width:${pct}%"></div>
      </div>
      <div class="aum-meta">
        <span>As of ${e.as_of_date || 'N/A'}</span>
        ${e.source ? `<span class="aum-source">${escHtml(e.source)}</span>` : ''}
      </div>
      ${breakdownHtml}
    `;

    if (hasBreakdown) {
      row.querySelector('.aum-label').style.cursor = 'pointer';
      row.querySelector('.aum-label').addEventListener('click', () => {
        row.classList.toggle('aum-expanded');
        const icon = row.querySelector('.aum-expand-icon');
        if (icon) icon.innerHTML = row.classList.contains('aum-expanded') ? '&#9660;' : '&#9654;';
      });
    }

    container.appendChild(row);
  }
}

function formatBillions(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'T';
  if (n >= 1) return n.toFixed(1).replace(/\.0$/, '') + 'B';
  return (n * 1000).toFixed(0) + 'M';
}

async function updateAum() {
  const entityId = document.getElementById('aumEntity').value;
  const value = parseFloat(document.getElementById('aumValue').value);
  const source = document.getElementById('aumSource').value;

  if (!entityId || isNaN(value)) {
    alert('Please select a company and enter an AUM value.');
    return;
  }

  const disc = parseFloat(document.getElementById('aumDiscretionary').value) || undefined;
  const nonDisc = parseFloat(document.getElementById('aumNonDiscretionary').value) || undefined;

  // Gather asset class inputs
  const acRows = document.querySelectorAll('#aumAssetClassInputs .form-row');
  const asset_classes = [];
  acRows.forEach(row => {
    const sel = row.querySelector('.aum-ac-select');
    const amt = row.querySelector('.aum-ac-amount');
    if (sel && amt && sel.value && parseFloat(amt.value)) {
      asset_classes.push({ name: sel.value, amount_billions: parseFloat(amt.value) });
    }
  });

  const entity = entities.all.find(e => e.id === entityId);
  try {
    await apiFetch('/api/aum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_id: entityId,
        entity_name: entity ? entity.name : entityId,
        aum_billions: value,
        source: source || 'Manual entry',
        notes: '',
        discretionary_billions: disc,
        non_discretionary_billions: nonDisc,
        asset_classes: asset_classes.length > 0 ? asset_classes : undefined,
      }),
    });
    document.getElementById('aumValue').value = '';
    document.getElementById('aumSource').value = '';
    document.getElementById('aumDiscretionary').value = '';
    document.getElementById('aumNonDiscretionary').value = '';
    // Reset asset class rows to just one
    const acContainer = document.getElementById('aumAssetClassInputs');
    const rows = acContainer.querySelectorAll('.form-row');
    rows.forEach((r, i) => { if (i > 0) r.remove(); });
    const firstSel = acContainer.querySelector('.aum-ac-select');
    const firstAmt = acContainer.querySelector('.aum-ac-amount');
    if (firstSel) firstSel.value = '';
    if (firstAmt) firstAmt.value = '';
    loadAum();
  } catch (err) {
    console.error('Failed to update AUM:', err);
  }
}

function addAumAssetClassRow() {
  const container = document.getElementById('aumAssetClassInputs');
  const row = document.createElement('div');
  row.className = 'form-row';
  row.style.marginTop = '8px';
  row.innerHTML = `
    <select class="aum-ac-select">
      <option value="">Asset Class...</option>
      <option value="Equities">Equities</option>
      <option value="Fixed Income">Fixed Income</option>
      <option value="Alternatives">Alternatives</option>
      <option value="Real Assets">Real Assets</option>
      <option value="Cash & Other">Cash & Other</option>
    </select>
    <input type="number" class="aum-ac-amount" placeholder="Amount (billions)" step="0.1">
    <button class="btn btn-secondary" onclick="this.parentElement.remove()">Remove</button>
  `;
  container.appendChild(row);
}

// ── SEC Filings ─────────────────────────────────────────
function populateSecEntitySelect() {
  const select = document.getElementById('filterSecEntity');
  if (!select) return;
  for (const e of (entities.competitors || [])) {
    const opt = document.createElement('option');
    opt.value = e.name;
    opt.textContent = e.name;
    select.appendChild(opt);
  }
}

async function loadSecFilings() {
  const entity = document.getElementById('filterSecEntity').value;
  const type = document.getElementById('filterSecType').value;
  const params = new URLSearchParams();
  if (entity) params.set('entity', entity);
  if (type) params.set('type', type);
  params.set('limit', '50');

  try {
    const res = await apiFetch(`/api/sec?${params}`);
    const filings = await res.json();
    renderSecFilings(filings);
  } catch (err) {
    console.error('Failed to load SEC filings:', err);
  }
}

// Filing type reference data (mirrors server-side FILING_TYPE_INFO)
const FILING_TYPE_INFO = {
  'ADV': { label: 'Adviser Registration', desc: 'AUM, fees, conflicts, disciplinary history' },
  'ADV-W': { label: 'Adviser Withdrawal', desc: 'Investment adviser deregistration' },
  '10-K': { label: 'Annual Report', desc: 'Annual financial report with audited statements' },
  '10-Q': { label: 'Quarterly Report', desc: 'Quarterly financial update' },
  '8-K': { label: 'Current Report', desc: 'Leadership changes, M&A, material agreements' },
  '13F': { label: 'Holdings Report', desc: 'Quarterly institutional holdings ($100M+)' },
  'S-1': { label: 'IPO Registration', desc: 'Initial public offering registration' },
  'DEF 14A': { label: 'Proxy Statement', desc: 'Exec compensation, board info, proposals' },
  'N-CSR': { label: 'Fund Annual Report', desc: 'Shareholder report for investment companies' },
  '4': { label: 'Insider Trade', desc: 'Changes in beneficial ownership by insiders' },
  'SC 13D': { label: 'Beneficial Ownership', desc: 'Ownership above 5% with activist intent' },
  'SC 13G': { label: 'Passive Ownership', desc: 'Passive ownership above 5%' },
};

const SIC_DESCRIPTIONS = {
  '6020': 'Commercial Banking', '6021': 'National Commercial Banks',
  '6022': 'State Commercial Banks', '6035': 'Savings Institutions',
  '6099': 'Financial Services', '6141': 'Personal Credit',
  '6153': 'Short-Term Business Credit', '6159': 'Federal Loan Agencies',
  '6162': 'Mortgage Bankers', '6199': 'Finance Services',
  '6200': 'Security & Commodity Brokers', '6211': 'Security Brokers & Dealers',
  '6282': 'Investment Advice', '6311': 'Fire, Marine & Casualty Insurance',
  '6321': 'Health Insurance', '6399': 'Insurance', '6500': 'Real Estate',
  '6726': 'Investment Offices', '6770': 'Blank Checks',
};

// Keyword severity categories (mirrors server-side SEC_KEYWORD_CATEGORIES)
const KEYWORD_SEVERITY = {};
['enforcement','fraud','penalty','sanction','cease and desist','disgorgement',
 'insider trading','violation','criminal','whistleblower','revocation','barred','suspension'
].forEach(k => KEYWORD_SEVERITY[k] = 'critical');
['investigation','material weakness','deficiency','settlement','arbitration',
 'conflict of interest','breach','restatement','adverse','litigation','class action',
 'subpoena','regulatory action','consent order'
].forEach(k => KEYWORD_SEVERITY[k] = 'warning');
['risk','fiduciary','compliance','audit','custody','best execution','advisory fee',
 'proxy','material change','governance','disclosure','amendment','corrective action',
 'remediation','oversight'
].forEach(k => KEYWORD_SEVERITY[k] = 'monitor');

function renderSecFilings(filings) {
  const container = document.getElementById('secFilingsList');
  if (!filings || filings.length === 0) {
    container.innerHTML = '<div class="empty">No filings found. Click "Scan SEC EDGAR" to search.</div>';
    return;
  }

  container.innerHTML = '';
  for (const f of filings) {
    const card = document.createElement('div');
    const riskClass = f.risk_level || 'info';
    card.className = `sec-card sec-risk-${riskClass}`;

    // Group keywords by severity
    const kwEntries = Object.entries(f.keyword_hits || {}).filter(([, c]) => c > 0);
    const grouped = { critical: [], warning: [], monitor: [] };
    for (const [word, count] of kwEntries) {
      const sev = KEYWORD_SEVERITY[word.toLowerCase()] || 'monitor';
      grouped[sev].push({ word, count });
    }
    // Sort each group by count desc
    for (const g of Object.values(grouped)) g.sort((a, b) => b.count - a.count);

    const keywordHtml = ['critical', 'warning', 'monitor']
      .filter(sev => grouped[sev].length > 0)
      .map(sev => {
        const pills = grouped[sev]
          .map(({ word, count }) => `<span class="keyword-pill kw-${sev}">${escHtml(word)} <strong>${count}</strong></span>`)
          .join('');
        return `<div class="kw-group"><span class="kw-group-label kw-label-${sev}">${sev.toUpperCase()}</span>${pills}</div>`;
      })
      .join('');

    // Filing type info
    const typeInfo = FILING_TYPE_INFO[f.filing_type] || null;
    const typeLabel = typeInfo ? typeInfo.label : f.filing_type;
    const typeDesc = typeInfo ? typeInfo.desc : '';

    // SIC industry
    const sicDesc = f.sic_code ? (SIC_DESCRIPTIONS[f.sic_code] || `SIC ${f.sic_code}`) : '';

    // Detail items
    const details = [];
    if (f.period_ending) details.push(`<span class="sec-detail"><strong>Period:</strong> ${formatDateTime(f.period_ending)}</span>`);
    if (f.cik) details.push(`<span class="sec-detail"><strong>CIK:</strong> ${escHtml(f.cik)}</span>`);
    if (sicDesc) details.push(`<span class="sec-detail"><strong>Industry:</strong> ${escHtml(sicDesc)}</span>`);
    if (f.file_number) details.push(`<span class="sec-detail"><strong>File #:</strong> ${escHtml(f.file_number)}</span>`);

    // Risk badge
    const riskLabels = { critical: 'CRITICAL', warning: 'WARNING', monitor: 'MONITOR', info: 'INFO' };
    const riskBadge = `<span class="risk-badge risk-${riskClass}">${riskLabels[riskClass] || 'INFO'}${f.risk_score ? ` (${f.risk_score})` : ''}</span>`;

    card.innerHTML = `
      <div class="sec-card-header">
        <div class="sec-header-left">
          <span class="sec-type-badge">${escHtml(f.filing_type)}</span>
          ${typeDesc ? `<span class="sec-type-desc">${escHtml(typeLabel)} &mdash; ${escHtml(typeDesc)}</span>` : ''}
        </div>
        <div class="sec-header-right">
          ${riskBadge}
          <span class="sec-date">${f.filed_date ? formatDateTime(f.filed_date) : ''}</span>
        </div>
      </div>
      <div class="sec-company">${escHtml(f.company_name)}</div>
      ${details.length > 0 ? `<div class="sec-details-row">${details.join('')}</div>` : ''}
      ${f.description ? `<div class="sec-desc">${escHtml(f.description).substring(0, 300)}</div>` : ''}
      ${f.top_words && f.top_words.length > 0 ? `
        <div class="sec-top-words">
          <span class="sec-top-words-label">TOP KEYWORDS</span>
          ${f.top_words.map(w => `<span class="top-word-pill">${escHtml(w)}</span>`).join('')}
        </div>
      ` : ''}
      ${keywordHtml ? `<div class="sec-keywords-section">${keywordHtml}</div>` : ''}
      <div class="sec-footer">
        <a href="${escHtml(f.document_url)}" target="_blank" rel="noopener" class="read-more">View on SEC EDGAR &#8594;</a>
        ${f.entity_names && f.entity_names.length > 0 ? `<span class="sec-entities">${f.entity_names.map(n => escHtml(n)).join(', ')}</span>` : ''}
      </div>
    `;
    container.appendChild(card);
  }
}

function getKeywordClass(word) {
  return `kw-${KEYWORD_SEVERITY[word.toLowerCase()] || 'monitor'}`;
}

async function triggerSecScan() {
  const btn = document.getElementById('btnSecScan');
  const queryInput = document.getElementById('secQuery');
  const query = queryInput.value.trim();

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Scanning...';

  try {
    const body = query ? { query } : {};
    const res = await apiFetch('/api/sec/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    btn.textContent = `Done! (${data.newFilings} new)`;
    setTimeout(() => { btn.textContent = 'Scan SEC EDGAR'; btn.disabled = false; }, 3000);
    loadSecFilings();
  } catch (err) {
    btn.textContent = 'Error';
    setTimeout(() => { btn.textContent = 'Scan SEC EDGAR'; btn.disabled = false; }, 3000);
  }
}

async function enrichSecKeywords() {
  const btn = document.getElementById('btnSecEnrich');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Enriching...';

  try {
    const res = await apiFetch('/api/sec/enrich', { method: 'POST' });
    const data = await res.json();
    btn.textContent = `Done! (${data.enriched} enriched)`;
    setTimeout(() => { btn.textContent = 'Enrich Keywords'; btn.disabled = false; }, 3000);
    loadSecFilings();
  } catch (err) {
    btn.textContent = 'Error';
    setTimeout(() => { btn.textContent = 'Enrich Keywords'; btn.disabled = false; }, 3000);
  }
}

// ── Financial News ──────────────────────────────────────
let finArticleOffset = 0;
const FIN_ARTICLE_LIMIT = 50;
let finSearchTimer = null;

async function loadFinArticles(append) {
  if (!append) finArticleOffset = 0;
  const source = document.getElementById('filterFinSource').value;
  const sentiment = document.getElementById('filterFinSentiment').value;
  const search = document.getElementById('filterFinSearch').value;

  const params = new URLSearchParams();
  if (source !== 'all') params.set('source', source);
  if (sentiment !== 'all') params.set('sentiment', sentiment);
  if (search) params.set('search', search);
  params.set('limit', FIN_ARTICLE_LIMIT);
  params.set('offset', finArticleOffset);

  try {
    const res = await apiFetch(`/api/fin-articles?${params}`);
    const articles = await res.json();
    const container = document.getElementById('finArticlesList');
    if (!append) container.innerHTML = '';

    if (articles.length === 0 && !append) {
      container.innerHTML = '<div class="empty">No financial news found. Click "Crawl Financial News" to get started.</div>';
      document.getElementById('btnFinLoadMore').style.display = 'none';
      return;
    }

    for (const a of articles) {
      container.appendChild(renderFinArticle(a));
    }

    document.getElementById('btnFinLoadMore').style.display =
      articles.length === FIN_ARTICLE_LIMIT ? 'inline-block' : 'none';
  } catch (err) {
    console.error('Failed to load financial news:', err);
  }
}

function renderFinArticle(a) {
  const div = document.createElement('div');
  div.className = 'article-card';
  const pubDate = a.pub_date ? new Date(a.pub_date) : null;
  const dateStr = pubDate ? formatDateTime(pubDate) : '';
  const timeAgo = pubDate ? getTimeAgo(pubDate) : '';

  div.innerHTML = `
    <div class="article-header">
      <a href="${escHtml(a.link)}" target="_blank" rel="noopener" class="article-title">${escHtml(a.title)}</a>
      <div class="article-badges">
        <span class="sentiment-badge sentiment-${a.sentiment_label}">${a.sentiment_label.toUpperCase()}</span>
      </div>
    </div>
    <div class="article-meta">
      <span class="entity-tag">${escHtml(a.source_name)}</span>
      <span class="article-date" title="${dateStr}">${timeAgo || dateStr}</span>
    </div>
    ${a.snippet ? `<div class="article-snippet">${escHtml(a.snippet).substring(0, 300)}${a.snippet.length > 300 ? '...' : ''}</div>` : ''}
    <div class="article-footer">
      <a href="${escHtml(a.link)}" target="_blank" rel="noopener" class="read-more">Read full article &#8594;</a>
    </div>
  `;
  return div;
}

function loadFinMore() {
  finArticleOffset += FIN_ARTICLE_LIMIT;
  loadFinArticles(true);
}

function debounceFinSearch() {
  clearTimeout(finSearchTimer);
  finSearchTimer = setTimeout(() => loadFinArticles(), 400);
}

async function triggerFinNewsCrawl() {
  const btn = document.getElementById('btnCrawlFinNews');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Crawling...';
  try {
    const res = await apiFetch('/api/fin-crawl', { method: 'POST' });
    const data = await res.json();
    btn.textContent = `Done! (${data.newArticles} new)`;
    setTimeout(() => { btn.textContent = 'Crawl Financial News'; btn.disabled = false; }, 3000);
    loadFinArticles();
  } catch (err) {
    btn.textContent = 'Error';
    setTimeout(() => { btn.textContent = 'Crawl Financial News'; btn.disabled = false; }, 3000);
  }
}

// ── Predictions ─────────────────────────────────────────
async function loadPredictions() {
  const category = document.getElementById('filterPredCat').value;
  const params = new URLSearchParams();
  if (category !== 'all') params.set('category', category);

  try {
    const res = await apiFetch(`/api/predictions?${params}`);
    const markets = await res.json();
    renderPredictions(markets);
  } catch (err) {
    console.error('Failed to load predictions:', err);
  }
}

function renderPredictions(markets) {
  const container = document.getElementById('predictionsList');
  if (!markets || markets.length === 0) {
    container.innerHTML = '<div class="empty">No predictions found. Click "Refresh Predictions" to load from Polymarket.</div>';
    return;
  }

  container.innerHTML = '';
  for (const m of markets) {
    const card = document.createElement('div');
    card.className = 'prediction-card';

    const probPct = Math.round(m.probability);
    const probColor = probPct >= 70 ? 'var(--positive)' : probPct >= 40 ? 'var(--gold)' : 'var(--negative)';
    const endDate = m.end_date ? new Date(m.end_date).toLocaleDateString() : '';

    card.innerHTML = `
      <div class="pred-header">
        <span class="pred-category">${escHtml(m.category)}</span>
        <span class="pred-prob" style="color:${probColor}">${probPct}%</span>
      </div>
      <div class="pred-question">${escHtml(m.question)}</div>
      <div class="pred-bar-track">
        <div class="pred-bar-fill" style="width:${probPct}%; background:${probColor}"></div>
      </div>
      <div class="pred-meta">
        <span>Volume: $${formatVolume(m.volume)}</span>
        ${endDate ? `<span>Ends: ${endDate}</span>` : ''}
        <a href="${escHtml(m.url)}" target="_blank" rel="noopener">Polymarket &#8594;</a>
      </div>
    `;
    container.appendChild(card);
  }
}

function formatVolume(v) {
  if (!v) return '0';
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
  return Math.round(v).toLocaleString();
}

async function triggerPredictionsCrawl() {
  const btn = document.getElementById('btnPredCrawl');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Loading...';

  try {
    const res = await apiFetch('/api/predictions/crawl', { method: 'POST' });
    const data = await res.json();
    btn.textContent = `Done! (${data.newMarkets} new)`;
    setTimeout(() => { btn.textContent = 'Refresh Predictions'; btn.disabled = false; }, 3000);
    loadPredictions();
  } catch (err) {
    btn.textContent = 'Error';
    setTimeout(() => { btn.textContent = 'Refresh Predictions'; btn.disabled = false; }, 3000);
  }
}

// ── AUM Crawl ───────────────────────────────────────────
async function triggerAumCrawl() {
  const btn = document.getElementById('btnAumCrawl');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Crawling EDGAR...';

  try {
    const res = await apiFetch('/api/aum/crawl', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      btn.textContent = `Done! (${data.updatedCount} updated)`;
      setTimeout(() => { btn.textContent = 'Crawl AUM (EDGAR)'; btn.disabled = false; }, 3000);
      loadAum();
    } else {
      btn.textContent = 'Error: ' + (data.error || 'Unknown');
      setTimeout(() => { btn.textContent = 'Crawl AUM (EDGAR)'; btn.disabled = false; }, 3000);
    }
  } catch (err) {
    btn.textContent = 'Error';
    setTimeout(() => { btn.textContent = 'Crawl AUM (EDGAR)'; btn.disabled = false; }, 3000);
  }
}

// ── Custom Entities ─────────────────────────────────────
async function addCustomEntity() {
  const nameInput = document.getElementById('customEntityName');
  const websiteInput = document.getElementById('customEntityWebsite');
  const name = nameInput.value.trim();
  const website = websiteInput.value.trim();

  if (!name) {
    alert('Please enter a company name.');
    return;
  }

  try {
    const res = await apiFetch('/api/entities/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, website }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Failed to add entity');
      return;
    }
    nameInput.value = '';
    websiteInput.value = '';
    await loadEntities();
    loadCustomEntities();
    populateAumEntitySelect();
    populateSecEntitySelect();
  } catch (err) {
    console.error('Failed to add custom entity:', err);
  }
}

async function removeCustomEntity(entityId) {
  if (!confirm('Remove this competitor from tracking?')) return;
  try {
    await apiFetch(`/api/entities/custom?id=${encodeURIComponent(entityId)}`, { method: 'DELETE' });
    await loadEntities();
    loadCustomEntities();
    populateAumEntitySelect();
    populateSecEntitySelect();
  } catch (err) {
    console.error('Failed to remove custom entity:', err);
  }
}

async function loadCustomEntities() {
  const container = document.getElementById('customEntitiesList');
  if (!container) return;
  const custom = (entities.custom || []);
  if (custom.length === 0) {
    container.innerHTML = '<div class="custom-empty">No custom competitors added yet.</div>';
    return;
  }
  container.innerHTML = custom.map(e => `
    <div class="custom-entity-item">
      <div class="custom-entity-info">
        <span class="custom-entity-name">${escHtml(e.name)}</span>
        ${e.website ? `<a href="${escHtml(e.website)}" target="_blank" rel="noopener" class="custom-entity-link">${escHtml(e.website)}</a>` : ''}
        <span class="custom-entity-date">Added ${new Date(e.added_at).toLocaleDateString()}</span>
      </div>
      <button class="btn-remove" onclick="removeCustomEntity('${escHtml(e.id)}')" title="Remove">&times;</button>
    </div>
  `).join('');
}

// ── Daily Brief ─────────────────────────────────────────
async function loadBrief() {
  try {
    const res = await apiFetch('/api/brief');
    if (res.status === 404) {
      document.getElementById('briefContent').innerHTML =
        '<div class="empty">No brief generated yet. Click "Generate Brief" to create one.</div>';
      return;
    }
    const brief = await res.json();
    renderBrief(brief);
  } catch (err) {
    console.error('Failed to load brief:', err);
  }
}

async function refreshBrief() {
  const btn = document.getElementById('btnRefreshBrief');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Generating...';
  document.getElementById('briefContent').innerHTML =
    '<div class="loading">Analyzing data across all sources...</div>';

  try {
    const res = await apiFetch('/api/brief', { method: 'POST' });
    const brief = await res.json();
    btn.textContent = 'Generate Brief';
    btn.disabled = false;
    renderBrief(brief);
  } catch (err) {
    console.error('Brief generation error:', err);
    btn.textContent = 'Error';
    document.getElementById('briefContent').innerHTML =
      '<div class="empty">Failed to generate brief. Try again later.</div>';
    setTimeout(() => { btn.textContent = 'Generate Brief'; btn.disabled = false; }, 3000);
  }
}

function renderBrief(brief) {
  const container = document.getElementById('briefContent');
  const ts = document.getElementById('briefTimestamp');

  if (brief.generated_at) {
    ts.textContent = `Generated: ${new Date(brief.generated_at).toLocaleString()}`;
  }

  const s = brief.market_sentiment;
  const trendIcon = s.trend === 'improving' ? '&#9650;' : s.trend === 'declining' ? '&#9660;' : '&#9644;';
  const trendClass = s.trend === 'improving' ? 'trend-up' : s.trend === 'declining' ? 'trend-down' : 'trend-flat';

  let html = '';

  // 1. Market Sentiment — SVG arc gauge
  // Score range: -1 (bearish) to +1 (bullish), default to 0 for no data
  const gaugeScore = s.avg_score;
  const normalized = Math.max(0, Math.min(1, (gaugeScore + 1) / 2)); // map -1..+1 to 0..1
  const arcRadius = 60;
  const arcLen = Math.PI * arcRadius; // semicircle circumference
  const dashOffset = arcLen * (1 - normalized);
  // Color: red(-1) -> yellow(0) -> green(+1)
  const gaugeHue = Math.round(normalized * 120); // 0=red, 60=yellow, 120=green
  const gaugeColor = `hsl(${gaugeHue}, 70%, 50%)`;
  const periodLabel = s.total_articles > 0 ? '24h' : 'all time';

  html += `
    <div class="brief-section">
      <h3 class="brief-section-title">Market Sentiment</h3>
      <div class="sentiment-dashboard">
        <div class="sentiment-gauge-box">
          <svg class="gauge-svg" width="170" height="100" viewBox="0 0 170 100">
            <path class="gauge-bg" d="M 15 90 A ${arcRadius} ${arcRadius} 0 0 1 155 90" />
            <path class="gauge-fill" id="gaugeFill"
              d="M 15 90 A ${arcRadius} ${arcRadius} 0 0 1 155 90"
              stroke="${gaugeColor}"
              stroke-dasharray="${arcLen}"
              stroke-dashoffset="${arcLen}" />
            <text class="gauge-score-text" x="85" y="75" text-anchor="middle">${gaugeScore.toFixed(2)}</text>
            <text class="gauge-label-text" x="85" y="92" text-anchor="middle">${s.total_articles} articles (${periodLabel})</text>
          </svg>
          <div class="gauge-range"><span>Bearish</span><span>Bullish</span></div>
          <div class="sentiment-trend ${trendClass}">${trendIcon} ${escHtml(s.trend)}</div>
        </div>
        <div class="sentiment-bars">
          <div class="sent-bar-row">
            <span class="sent-label pos-label">Positive</span>
            <div class="sent-bar-track"><div class="sent-bar-fill pos-fill" style="width:0%"></div></div>
            <span class="sent-pct">${s.positive_pct}%</span>
          </div>
          <div class="sent-bar-row">
            <span class="sent-label neu-label">Neutral</span>
            <div class="sent-bar-track"><div class="sent-bar-fill neu-fill" style="width:0%"></div></div>
            <span class="sent-pct">${s.neutral_pct}%</span>
          </div>
          <div class="sent-bar-row">
            <span class="sent-label neg-label">Negative</span>
            <div class="sent-bar-track"><div class="sent-bar-fill neg-fill" style="width:0%"></div></div>
            <span class="sent-pct">${s.negative_pct}%</span>
          </div>
        </div>
      </div>
    </div>
  `;

  // Animate gauge and bars after render
  setTimeout(() => {
    const fill = document.getElementById('gaugeFill');
    if (fill) fill.setAttribute('stroke-dashoffset', String(dashOffset));
    document.querySelectorAll('.sent-bar-fill.pos-fill').forEach(el => el.style.width = s.positive_pct + '%');
    document.querySelectorAll('.sent-bar-fill.neu-fill').forEach(el => el.style.width = s.neutral_pct + '%');
    document.querySelectorAll('.sent-bar-fill.neg-fill').forEach(el => el.style.width = s.negative_pct + '%');
  }, 50);

  // 2. Top Stories
  if (brief.top_stories.length > 0) {
    html += `
      <div class="brief-section">
        <h3 class="brief-section-title">Top Stories</h3>
        <div class="brief-stories">
          ${brief.top_stories.map(st => `
            <div class="brief-story">
              <div class="brief-story-header">
                <span class="brief-reason brief-reason-${st.reason.toLowerCase().replace(/\s+/g, '-')}">${escHtml(st.reason)}</span>
                <span class="sentiment-badge sentiment-${st.sentiment_label}">${st.sentiment_label}</span>
              </div>
              <a href="${escHtml(st.link)}" target="_blank" rel="noopener" class="brief-story-title">${escHtml(st.title)}</a>
              <div class="brief-story-meta">
                <span class="entity-tag">${escHtml(st.entity_name)}</span>
                <span>${formatDateTime(st.pub_date)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 3. Risk Alerts
  if (brief.risk_alerts.length > 0) {
    html += `
      <div class="brief-section">
        <h3 class="brief-section-title">Risk Alerts</h3>
        <div class="brief-risks">
          ${brief.risk_alerts.map(r => `
            <div class="brief-risk brief-risk-${r.risk_level}">
              <div class="brief-risk-header">
                <span class="risk-badge risk-${r.risk_level}">${r.risk_level.toUpperCase()} (${r.risk_score})</span>
                <span class="sec-type-badge">${escHtml(r.filing_type)}</span>
              </div>
              <div class="brief-risk-company">${escHtml(r.company_name)}</div>
              <div class="brief-risk-desc">${escHtml(r.description)}</div>
              <a href="${escHtml(r.document_url)}" target="_blank" rel="noopener" class="read-more">View Filing &#8594;</a>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 4. Prediction Movers
  if (brief.prediction_movers.length > 0) {
    html += `
      <div class="brief-section">
        <h3 class="brief-section-title">Prediction Markets</h3>
        <div class="brief-predictions">
          ${brief.prediction_movers.map(p => {
            const pct = Math.round(p.probability);
            const color = pct >= 70 ? 'var(--positive)' : pct >= 40 ? 'var(--gold)' : 'var(--negative)';
            return `
              <div class="brief-pred">
                <div class="brief-pred-info">
                  <span class="pred-category">${escHtml(p.category)}</span>
                  <span class="brief-pred-q">${escHtml(p.question)}</span>
                </div>
                <div class="brief-pred-bar">
                  <div class="pred-bar-track"><div class="pred-bar-fill" style="width:${pct}%;background:${color}"></div></div>
                  <span class="pred-prob" style="color:${color}">${pct}%</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // 5. Upcoming Events
  if (brief.upcoming_events.length > 0) {
    html += `
      <div class="brief-section">
        <h3 class="brief-section-title">Upcoming Events (7 days)</h3>
        <div class="brief-events">
          ${brief.upcoming_events.map(e => `
            <div class="brief-event">
              <span class="brief-event-date">${new Date(e.event_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              <span class="event-cat ${getCatClass(e.category)}">${escHtml(e.category)}</span>
              <span class="brief-event-title">${escHtml(e.title)}</span>
              ${e.link ? `<a href="${escHtml(e.link)}" target="_blank" rel="noopener" class="brief-event-link">&#8594;</a>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 6. Competitor Activity
  if (brief.competitor_activity.length > 0) {
    const maxCount = Math.max(...brief.competitor_activity.map(c => c.article_count));
    html += `
      <div class="brief-section">
        <h3 class="brief-section-title">Competitor Activity (24h)</h3>
        <div class="brief-activity">
          ${brief.competitor_activity.map(c => {
            const pct = Math.max((c.article_count / maxCount) * 100, 5);
            const isSelf = c.entity_id === 'dobbs-group';
            return `
              <div class="activity-row${isSelf ? ' activity-self' : ''}">
                <div class="activity-label">
                  <span class="activity-name">${escHtml(c.entity_name)}</span>
                  <span class="activity-count">${c.article_count}</span>
                </div>
                <div class="activity-bar-track">
                  <div class="activity-bar-fill${isSelf ? ' self-fill' : ''}" style="width:${pct}%"></div>
                </div>
                <a href="${escHtml(c.top_link)}" target="_blank" rel="noopener" class="activity-headline">${escHtml(c.top_headline.substring(0, 80))}${c.top_headline.length > 80 ? '...' : ''}</a>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // 7. Key Themes
  if (brief.key_themes.length > 0) {
    html += `
      <div class="brief-section">
        <h3 class="brief-section-title">Key Themes</h3>
        <div class="brief-themes">
          ${brief.key_themes.map(t => `
            <span class="theme-pill" style="opacity:${Math.min(0.4 + (t.count / brief.key_themes[0].count) * 0.6, 1)}">${escHtml(t.theme)} <strong>${t.count}</strong></span>
          `).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

// ── Competitor Discovery ────────────────────────────────
async function discoverCompetitors() {
  const btn = document.getElementById('btnDiscover');
  const container = document.getElementById('discoverySuggestions');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Scanning...';
  container.innerHTML = '<div class="loading">Searching SEC EDGAR for investment advisory firms...</div>';

  try {
    const res = await apiFetch('/api/entities/discover', { method: 'POST' });
    const data = await res.json();
    btn.textContent = `Found ${data.count} suggestions`;
    setTimeout(() => { btn.textContent = 'Scan EDGAR'; btn.disabled = false; }, 3000);
    renderDiscoverySuggestions(data.suggestions || []);
  } catch (err) {
    console.error('Discovery error:', err);
    btn.textContent = 'Error';
    container.innerHTML = '<div class="empty">Failed to scan EDGAR. Try again later.</div>';
    setTimeout(() => { btn.textContent = 'Scan EDGAR'; btn.disabled = false; }, 3000);
  }
}

function renderDiscoverySuggestions(suggestions) {
  const container = document.getElementById('discoverySuggestions');
  if (!suggestions || suggestions.length === 0) {
    container.innerHTML = '<div class="empty">No new competitors found. All known firms are already tracked.</div>';
    return;
  }

  container.innerHTML = '';
  for (const s of suggestions) {
    const card = document.createElement('div');
    card.className = 'discovery-card';
    card.innerHTML = `
      <div class="discovery-card-main">
        <div class="discovery-card-info">
          <span class="discovery-name">${escHtml(s.name)}</span>
          <span class="discovery-sic">${escHtml(s.sic_description)} (SIC ${escHtml(s.sic_code)})</span>
        </div>
        <div class="discovery-card-stats">
          <span class="discovery-filings">${s.filing_count} filing${s.filing_count !== 1 ? 's' : ''}</span>
          ${s.recent_filing_types.length > 0 ? `<span class="discovery-types">${s.recent_filing_types.map(t => escHtml(t)).join(', ')}</span>` : ''}
          ${s.latest_filing_date ? `<span class="discovery-date">Latest: ${formatDateTime(s.latest_filing_date)}</span>` : ''}
        </div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="addDiscoveredEntity('${escHtml(s.name)}', '${escHtml(s.cik)}')">Add</button>
    `;
    container.appendChild(card);
  }
}

async function addDiscoveredEntity(name, cik) {
  try {
    const res = await apiFetch('/api/entities/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, website: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}` }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Failed to add entity');
      return;
    }
    await loadEntities();
    loadCustomEntities();
    populateAumEntitySelect();
    populateSecEntitySelect();
    // Re-run discovery to update suggestions (remove added entity)
    discoverCompetitors();
  } catch (err) {
    console.error('Failed to add discovered entity:', err);
  }
}

// ── Helpers ──────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function isoDate(d) {
  return d.toISOString().split('T')[0];
}

// ── Market Indicators ────────────────────────────────────

async function loadMarketIndicators() {
  try {
    const [mktRes, sentRes] = await Promise.all([
      apiFetch('/api/market-indicators'),
      apiFetch('/api/sentiment'),
    ]);
    const mkt = await mktRes.json();
    const sent = await sentRes.json();
    renderMarketIndicators(mkt, sent);
  } catch (err) {
    console.error('Failed to load market indicators:', err);
  }
}

function renderMarketIndicators(mkt, sent) {
  // Fear & Greed gauge
  const fgEl = document.getElementById('fearGreedSection');
  if (mkt.fear_greed) {
    const fg = mkt.fear_greed;
    const color = fg.score <= 25 ? '#ef4444' : fg.score <= 45 ? '#f97316' : fg.score <= 55 ? '#eab308' : fg.score <= 75 ? '#22c55e' : '#16a34a';
    fgEl.innerHTML = `
      <div class="fg-card">
        <div class="fg-gauge">
          <svg viewBox="0 0 200 120" width="200" height="120">
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="var(--border)" stroke-width="12" stroke-linecap="round"/>
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"
              stroke-dasharray="${(fg.score / 100) * 251.2} 251.2"/>
            <text x="100" y="85" text-anchor="middle" fill="${color}" font-size="28" font-weight="700">${fg.score}</text>
            <text x="100" y="105" text-anchor="middle" fill="var(--muted)" font-size="11">${fg.rating}</text>
          </svg>
        </div>
        <div class="fg-meta">
          <h3>Fear &amp; Greed Index</h3>
          <div class="fg-comparisons">
            <span>Prev Close: <strong>${fg.previous_close}</strong></span>
            <span>1 Week: <strong>${fg.one_week_ago}</strong></span>
            <span>1 Month: <strong>${fg.one_month_ago}</strong></span>
            <span>1 Year: <strong>${fg.one_year_ago}</strong></span>
          </div>
        </div>
      </div>
      ${mkt.yield_spread !== null ? `<div class="yield-spread-card"><span class="yield-label">Yield Curve Spread (10Y-2Y)</span><span class="yield-value ${mkt.yield_spread < 0 ? 'inverted' : ''}">${mkt.yield_spread > 0 ? '+' : ''}${mkt.yield_spread}%</span></div>` : ''}
    `;
  } else {
    fgEl.innerHTML = '<div class="empty">No Fear &amp; Greed data yet. Click "Refresh Data" to fetch.</div>';
  }

  // FRED series cards
  const fredEl = document.getElementById('fredCardsGrid');
  if (mkt.fred_series && mkt.fred_series.length > 0) {
    fredEl.innerHTML = mkt.fred_series.map(s => {
      const pts = s.data_points || [];
      const sparkline = renderSparklineSvg(pts.map(p => p.value));
      return `<div class="fred-card">
        <div class="fred-header"><span class="fred-label">${escHtml(s.label)}</span><span class="fred-value">${s.latest_value.toFixed(2)}${s.unit === '%' ? '%' : ''}</span></div>
        <div class="fred-sparkline">${sparkline}</div>
        <div class="fred-date">${s.latest_date}</div>
      </div>`;
    }).join('');
  } else {
    fredEl.innerHTML = '<div class="empty">No FRED data. Set FRED_API_KEY and click "Refresh Data".</div>';
  }

  // Sentiment section
  const sentEl = document.getElementById('sentimentSection');
  if (sent && sent.topics && sent.topics.length > 0) {
    const sentColor = sent.composite_score < -0.15 ? '#ef4444' : sent.composite_score > 0.15 ? '#22c55e' : '#eab308';
    sentEl.innerHTML = `
      <h3 style="margin-top:24px;">Alpha Vantage Sentiment</h3>
      <div class="sent-composite">
        <span class="sent-score" style="color:${sentColor}">${sent.composite_label}</span>
        <span class="sent-value">(${sent.composite_score.toFixed(3)})</span>
      </div>
      <div class="sent-topics">${sent.topics.map(t => `
        <div class="sent-topic-card">
          <div class="sent-topic-name">${escHtml(t.topic.replace(/_/g, ' '))}</div>
          <div class="sent-topic-score">${t.label} (${t.score.toFixed(3)})</div>
          <div class="sent-topic-count">${t.article_count} articles</div>
        </div>
      `).join('')}</div>
    `;
  } else {
    sentEl.innerHTML = '';
  }

  // Timestamp
  const ts = document.getElementById('marketTimestamp');
  if (mkt.updated_at) ts.textContent = `Updated ${formatDateTime(mkt.updated_at)}`;
}

function renderSparklineSvg(values) {
  if (!values || values.length < 2) return '';
  const w = 120, h = 32, pad = 2;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
    const y = pad + (1 - (v - min) / range) * (h - 2 * pad);
    return `${x},${y}`;
  }).join(' ');
  const color = values[values.length - 1] >= values[0] ? '#22c55e' : '#ef4444';
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`;
}

async function triggerMarketCrawl() {
  try {
    await apiFetch('/api/market-indicators/crawl', { method: 'POST' });
    await apiFetch('/api/sentiment/crawl', { method: 'POST' });
    loadMarketIndicators();
  } catch (err) {
    console.error('Market crawl failed:', err);
  }
}

// ── 13F Holdings ─────────────────────────────────────────

async function loadHoldingsEntities() {
  try {
    const res = await apiFetch('/api/13f');
    const data = await res.json();
    const sel = document.getElementById('holdingsEntity');
    sel.innerHTML = '<option value="">Select Entity...</option>';
    for (const e of data.entities || []) {
      const opt = document.createElement('option');
      opt.value = e.cik;
      opt.textContent = e.name;
      sel.appendChild(opt);
    }
    // Populate periods if available
    if (data.periods) {
      window._holdingsPeriods = data.periods;
    }
  } catch (err) {
    console.error('Failed to load 13F entities:', err);
  }
}

async function loadHoldings() {
  const cik = document.getElementById('holdingsEntity').value;
  if (!cik) return;

  // Populate period dropdown
  const periodSel = document.getElementById('holdingsPeriod');
  const periods = (window._holdingsPeriods || {})[cik] || [];
  if (periods.length > 0 && periodSel.options.length <= 1) {
    periodSel.innerHTML = periods.map((p, i) => `<option value="${p}" ${i === 0 ? 'selected' : ''}>${p}</option>`).join('');
  }

  const period = periodSel.value || undefined;
  try {
    const res = await apiFetch(`/api/13f?cik=${encodeURIComponent(cik)}${period ? '&period=' + period : ''}`);
    const data = await res.json();
    renderHoldings(data);
  } catch (err) {
    console.error('Failed to load holdings:', err);
  }
}

function renderHoldings(data) {
  const summaryEl = document.getElementById('holdingsSummary');
  const tableEl = document.getElementById('holdingsTable');

  if (!data.filing || !data.filing.holdings || data.filing.holdings.length === 0) {
    summaryEl.innerHTML = '';
    tableEl.innerHTML = '<div class="empty">No holdings data for this entity/period. Run "Crawl 13F Filings" first.</div>';
    return;
  }

  const f = data.filing;
  const totalVal = f.total_value_thousands / 1000; // Convert to millions
  summaryEl.innerHTML = `
    <div class="holdings-stats">
      <div class="holdings-stat"><span class="stat-label">Total Value</span><span class="stat-value">$${totalVal >= 1000 ? (totalVal / 1000).toFixed(1) + 'B' : totalVal.toFixed(0) + 'M'}</span></div>
      <div class="holdings-stat"><span class="stat-label">Holdings</span><span class="stat-value">${f.holdings.length}</span></div>
      <div class="holdings-stat"><span class="stat-label">Period</span><span class="stat-value">${f.period}</span></div>
      <div class="holdings-stat"><span class="stat-label">Filed</span><span class="stat-value">${f.filed_date}</span></div>
    </div>
  `;

  // Top 50 holdings table
  const top = f.holdings.slice(0, 50);
  tableEl.innerHTML = `
    <table class="data-table">
      <thead><tr><th>#</th><th>Issuer</th><th>CUSIP</th><th>Value ($K)</th><th>Shares</th><th>% of Portfolio</th></tr></thead>
      <tbody>${top.map((h, i) => {
        const pct = ((h.value_thousands / f.total_value_thousands) * 100).toFixed(2);
        return `<tr>
          <td>${i + 1}</td>
          <td>${escHtml(h.issuer)}</td>
          <td class="mono">${h.cusip}</td>
          <td class="num">${h.value_thousands.toLocaleString()}</td>
          <td class="num">${h.shares.toLocaleString()}</td>
          <td class="num">${pct}%</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
    ${f.holdings.length > 50 ? `<p class="table-note">Showing top 50 of ${f.holdings.length} holdings</p>` : ''}
  `;
}

async function trigger13FCrawl() {
  const btn = event.target;
  btn.disabled = true;

  try {
    // Get batch info first
    const infoRes = await apiFetch('/api/13f/crawl', { method: 'POST' });
    const info = await infoRes.json();
    const totalBatches = info.totalBatches || 1;
    let totalFilings = 0;

    for (let batch = 0; batch < totalBatches; batch++) {
      btn.textContent = `Crawling batch ${batch + 1}/${totalBatches}...`;
      try {
        const res = await apiFetch(`/api/13f/crawl?batch=${batch}`, { method: 'POST' });
        const data = await res.json();
        totalFilings += data.filings || 0;
      } catch (batchErr) {
        console.warn(`[13F] Batch ${batch} failed, continuing...`, batchErr);
      }
    }

    btn.textContent = `Done! ${totalFilings} filings saved. Reloading...`;
    await loadHoldingsEntities();
    loadHoldings();
  } catch (err) {
    console.error('13F crawl failed:', err);
    btn.textContent = 'Crawl failed — try again';
  }

  btn.disabled = false;
  setTimeout(() => { btn.textContent = 'Crawl 13F Filings'; }, 3000);
}

// ── FINRA Alerts ─────────────────────────────────────────

async function loadFinraAlerts() {
  try {
    const res = await apiFetch('/api/finra');
    const alerts = await res.json();
    renderFinraAlerts(alerts);
  } catch (err) {
    console.error('Failed to load FINRA alerts:', err);
  }
}

function renderFinraAlerts(alerts) {
  const el = document.getElementById('finraAlertsList');
  if (!alerts || alerts.length === 0) {
    el.innerHTML = '<div class="empty">No FINRA alerts found. Click "Scan FINRA" to check.</div>';
    return;
  }

  el.innerHTML = alerts.slice(0, 50).map(a => `
    <div class="finra-alert finra-${a.severity}">
      <div class="finra-alert-header">
        <span class="finra-badge badge-${a.severity}">${a.severity.toUpperCase()}</span>
        <span class="finra-firm">${escHtml(a.firm_name)}</span>
        <span class="finra-date">${a.date}</span>
      </div>
      <div class="finra-type">${escHtml(a.action_type)}</div>
      <div class="finra-summary">${escHtml(a.summary).substring(0, 200)}${a.summary.length > 200 ? '...' : ''}</div>
      <a href="${a.source_url}" target="_blank" class="finra-link">View on BrokerCheck</a>
    </div>
  `).join('');
}

async function triggerFinraCrawl() {
  try {
    await apiFetch('/api/finra/crawl', { method: 'POST' });
    loadFinraAlerts();
  } catch (err) {
    console.error('FINRA crawl failed:', err);
  }
}
