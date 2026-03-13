import type { PersonnelChange } from '../config/competitors.js';
import { getAllEntitiesWithCustom, addPersonnelChanges, getSecFilings, logCrawl } from '../services/blobStore.js';
import RssParser from 'rss-parser';

const parser = new RssParser();
const USER_AGENT = 'The Dobbs Group Competitor Intel alerts@dobbsgroup.com';

function makeId(): string {
  return `per-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

const PERSONNEL_KEYWORDS = [
  'ceo', 'cfo', 'cio', 'coo', 'cto', 'president', 'chairman', 'director',
  'appoint', 'hire', 'resign', 'depart', 'retire', 'promote', 'succeed',
  'named', 'joins', 'joined', 'leaves', 'leaving', 'stepping down',
  'new role', 'transition', 'chief', 'head of', 'managing director',
  'partner', 'executive vice president', 'senior vice president',
];

function detectChangeType(text: string): PersonnelChange['change_type'] {
  const lower = text.toLowerCase();
  if (/resign|depart|leav|stepping\s*down|retire/i.test(lower)) return 'departure';
  if (/promot|elevated|new\s*role|transition/i.test(lower)) return 'promotion';
  if (/board|director.*appoint|elected.*board/i.test(lower)) return 'board_change';
  return 'hire';
}

function extractPersonName(text: string): string {
  // Try common patterns: "John Smith appointed as..." or "... appoints John Smith"
  const patterns = [
    /([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*(?:has been|was|is)\s*(?:appointed|named|hired|promoted)/,
    /(?:appoints?|names?|hires?|promotes?)\s*([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/,
    /([A-Z][a-z]+ [A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*(?:joins?|leaves?|resigns?|retires?|departs?)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return '';
}

function extractRole(text: string): string {
  const patterns = [
    /(?:as|to)\s+((?:Chief|President|Chairman|Director|Head|Managing|Senior|Executive|Partner|Vice)[^,.;]+)/i,
    /((?:CEO|CFO|CIO|COO|CTO|CMO|CLO|CRO)\b)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return '';
}

export async function crawlPersonnel(): Promise<number> {
  const allEntities = await getAllEntitiesWithCustom();
  const changes: PersonnelChange[] = [];

  // 1. Scan news RSS for personnel changes
  for (const entity of allEntities.slice(0, 15)) { // Limit to avoid timeout
    for (const query of entity.searchQueries.slice(0, 1)) {
      const personnelQuery = `${query} (CEO OR hire OR appoint OR resign OR depart OR promote)`;
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(personnelQuery)}&hl=en-US&gl=US&ceid=US:en`;

      try {
        const feed = await parser.parseURL(rssUrl);
        for (const item of (feed.items || []).slice(0, 5)) {
          const title = item.title || '';
          const lower = title.toLowerCase();

          // Check if this is a personnel-related article
          const isPersonnel = PERSONNEL_KEYWORDS.some(kw => lower.includes(kw));
          if (!isPersonnel) continue;

          const personName = extractPersonName(title);
          if (!personName) continue;

          changes.push({
            id: makeId(),
            entity_id: entity.id,
            entity_name: entity.name,
            person_name: personName,
            old_role: '',
            new_role: extractRole(title),
            change_type: detectChangeType(title),
            source: 'Google News',
            source_url: item.link || '',
            date: item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            details: title,
            created_at: new Date().toISOString(),
          });
        }
      } catch {
        // Skip RSS errors
      }
    }
    await new Promise(r => setTimeout(r, 200));
  }

  // 2. Scan 8-K filings for leadership changes
  const recentFilings = await getSecFilings({ filingType: '8-K', limit: 50 });
  const last30Days = Date.now() - 30 * 86400000;
  for (const filing of recentFilings) {
    if (new Date(filing.filed_date).getTime() < last30Days) continue;
    const desc = (filing.description || '').toLowerCase();
    const isPersonnel = PERSONNEL_KEYWORDS.some(kw => desc.includes(kw));
    if (!isPersonnel) continue;

    const personName = extractPersonName(filing.description);
    if (!personName) continue;

    const entityMatch = allEntities.find(e =>
      filing.entity_names.some(n => n.toLowerCase().includes(e.name.toLowerCase()))
    );

    changes.push({
      id: makeId(),
      entity_id: entityMatch?.id || 'unknown',
      entity_name: entityMatch?.name || filing.company_name,
      person_name: personName,
      old_role: '',
      new_role: extractRole(filing.description),
      change_type: detectChangeType(filing.description),
      source: 'SEC 8-K',
      source_url: filing.document_url,
      date: filing.filed_date,
      details: filing.description.substring(0, 300),
      created_at: new Date().toISOString(),
    });
  }

  const added = await addPersonnelChanges(changes);

  await logCrawl({
    crawl_type: 'personnel',
    entity_id: null,
    articles_found: added,
    status: 'success',
    error_message: null,
    finished_at: new Date().toISOString(),
  });

  return added;
}
