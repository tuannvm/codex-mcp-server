// ── State ────────────────────────────────────────────────
let entities = { self: null, competitors: [], all: [] };
let articleOffset = 0;
const ARTICLE_LIMIT = 50;
let searchTimer = null;

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadEntities();
  loadArticles();
  loadPriorityArticles();
  loadStats();

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
    const res = await fetch('/api/entities');
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
    const res = await fetch(`/api/articles?${params}`);
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
  const dateStr = pubDate ? pubDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
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

function debounceSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadArticles(), 400);
}

// ── Stats ────────────────────────────────────────────────
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
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
    <div class="stat-latest">Latest: ${s.latest_article ? new Date(s.latest_article).toLocaleDateString() : 'N/A'}</div>
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
    const res = await fetch(`/api/events?${params}`);
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
    const res = await fetch('/api/crawl-log');
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
  if (tabName === 'stats') loadStats();
  if (tabName === 'aum') loadAum();
  if (tabName === 'sec') loadSecFilings();
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
    const res = await fetch('/api/crawl', { method: 'POST' });
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
    const res = await fetch('/api/crawl/gov', { method: 'POST' });
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
    const res = await fetch('/api/articles?priority=true&limit=10');
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
    const res = await fetch('/api/aum');
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
    const row = document.createElement('div');
    row.className = `aum-row${isSelf ? ' aum-self' : ''}`;
    row.innerHTML = `
      <div class="aum-label">
        <span class="aum-name">${escHtml(e.entity_name)}</span>
        <span class="aum-value">$${formatBillions(e.aum_billions)}B</span>
      </div>
      <div class="aum-bar-track">
        <div class="aum-bar-fill${isSelf ? ' self-fill' : ''}" style="width:${pct}%"></div>
      </div>
      <div class="aum-meta">
        <span>As of ${e.as_of_date || 'N/A'}</span>
        ${e.source ? `<span class="aum-source">${escHtml(e.source)}</span>` : ''}
      </div>
    `;
    container.appendChild(row);
  }
}

function formatBillions(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'T';
  if (n >= 1) return n.toFixed(1).replace(/\.0$/, '');
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

  const entity = entities.all.find(e => e.id === entityId);
  try {
    await fetch('/api/aum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_id: entityId,
        entity_name: entity ? entity.name : entityId,
        aum_billions: value,
        source: source || 'Manual entry',
        notes: '',
      }),
    });
    document.getElementById('aumValue').value = '';
    document.getElementById('aumSource').value = '';
    loadAum();
  } catch (err) {
    console.error('Failed to update AUM:', err);
  }
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
    const res = await fetch(`/api/sec?${params}`);
    const filings = await res.json();
    renderSecFilings(filings);
  } catch (err) {
    console.error('Failed to load SEC filings:', err);
  }
}

function renderSecFilings(filings) {
  const container = document.getElementById('secFilingsList');
  if (!filings || filings.length === 0) {
    container.innerHTML = '<div class="empty">No filings found. Click "Scan SEC EDGAR" to search.</div>';
    return;
  }

  container.innerHTML = '';
  for (const f of filings) {
    const card = document.createElement('div');
    card.className = 'sec-card';

    const keywordPills = Object.entries(f.keyword_hits || {})
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([word, count]) => `<span class="keyword-pill ${getKeywordClass(word)}">${escHtml(word)} <strong>${count}</strong></span>`)
      .join('');

    card.innerHTML = `
      <div class="sec-card-header">
        <span class="sec-type-badge">${escHtml(f.filing_type)}</span>
        <span class="sec-date">${f.filed_date ? new Date(f.filed_date).toLocaleDateString() : ''}</span>
      </div>
      <div class="sec-company">${escHtml(f.company_name)}</div>
      ${f.description ? `<div class="sec-desc">${escHtml(f.description).substring(0, 200)}</div>` : ''}
      ${keywordPills ? `<div class="keyword-pills">${keywordPills}</div>` : ''}
      <div class="sec-footer">
        <a href="${escHtml(f.document_url)}" target="_blank" rel="noopener" class="read-more">View on SEC EDGAR &#8594;</a>
        ${f.entity_names && f.entity_names.length > 0 ? `<span class="sec-entities">${f.entity_names.map(n => escHtml(n)).join(', ')}</span>` : ''}
      </div>
    `;
    container.appendChild(card);
  }
}

function getKeywordClass(word) {
  const w = word.toLowerCase();
  if (['enforcement', 'penalty', 'violation', 'sanction'].includes(w)) return 'kw-danger';
  if (['risk', 'deficiency', 'material weakness', 'investigation'].includes(w)) return 'kw-warning';
  if (['fiduciary', 'compliance', 'audit'].includes(w)) return 'kw-info';
  return 'kw-default';
}

async function triggerSecScan() {
  const btn = document.getElementById('btnSecScan');
  const queryInput = document.getElementById('secQuery');
  const query = queryInput.value.trim();

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Scanning...';

  try {
    const body = query ? { query } : {};
    const res = await fetch('/api/sec/scan', {
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

// ── Predictions ─────────────────────────────────────────
async function loadPredictions() {
  const category = document.getElementById('filterPredCat').value;
  const params = new URLSearchParams();
  if (category !== 'all') params.set('category', category);

  try {
    const res = await fetch(`/api/predictions?${params}`);
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
    const res = await fetch('/api/predictions/crawl', { method: 'POST' });
    const data = await res.json();
    btn.textContent = `Done! (${data.newMarkets} new)`;
    setTimeout(() => { btn.textContent = 'Refresh Predictions'; btn.disabled = false; }, 3000);
    loadPredictions();
  } catch (err) {
    btn.textContent = 'Error';
    setTimeout(() => { btn.textContent = 'Refresh Predictions'; btn.disabled = false; }, 3000);
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
