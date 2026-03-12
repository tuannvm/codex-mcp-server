// ── State ────────────────────────────────────────────────
let entities = { self: null, competitors: [], all: [] };
let articleOffset = 0;
const ARTICLE_LIMIT = 50;
let searchTimer = null;

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await loadEntities();
  loadArticles();
  loadStats();

  // Default calendar date range: today - 30 days to today + 90 days
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  const end = new Date(now);
  end.setDate(end.getDate() + 90);
  document.getElementById('filterStartDate').value = isoDate(start);
  document.getElementById('filterEndDate').value = isoDate(end);
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
  div.className = `article-card${a.entity_id === 'dobbs-group' ? ' self' : ''}`;

  const isSelf = a.entity_id === 'dobbs-group';
  const date = a.pub_date ? new Date(a.pub_date).toLocaleDateString() : '';

  div.innerHTML = `
    <div class="article-header">
      <a href="${escHtml(a.link)}" target="_blank" rel="noopener" class="article-title">${escHtml(a.title)}</a>
      <span class="sentiment-badge sentiment-${a.sentiment_label}">${a.sentiment_label}</span>
    </div>
    <div class="article-meta">
      <span class="entity-tag${isSelf ? ' self-tag' : ''}">${escHtml(a.entity_name)}</span>
      <span>${escHtml(a.source || '')}</span>
      <span>${date}</span>
    </div>
    ${a.snippet ? `<div class="article-snippet">${escHtml(a.snippet).substring(0, 250)}${a.snippet.length > 250 ? '...' : ''}</div>` : ''}
  `;
  return div;
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

  const div = document.createElement('div');
  div.className = `stat-card${isSelf ? ' self-card' : ''}`;
  div.innerHTML = `
    <h3>
      ${escHtml(s.entity_name)}
      <span class="tier-badge">${tier}</span>
    </h3>
    <div class="stat-numbers">
      <div class="stat-num total"><div class="num">${s.total}</div><div class="lbl">Total</div></div>
      <div class="stat-num pos"><div class="num">${s.positive}</div><div class="lbl">Positive</div></div>
      <div class="stat-num neu"><div class="num">${s.neutral}</div><div class="lbl">Neutral</div></div>
      <div class="stat-num neg"><div class="num">${s.negative}</div><div class="lbl">Negative</div></div>
    </div>
    <div class="stat-latest">Latest: ${s.latest_article ? new Date(s.latest_article).toLocaleDateString() : 'N/A'}</div>
  `;
  return div;
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
