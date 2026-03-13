import type { JobPosting, JobTrend } from '../config/competitors.js';
import { getAllEntitiesWithCustom, addJobPostings, saveJobTrends, getJobPostings, logCrawl } from '../services/blobStore.js';
import RssParser from 'rss-parser';

const parser = new RssParser();

function makeId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function classifySeniority(title: string): JobPosting['seniority'] {
  const t = title.toLowerCase();
  if (/\b(chief|ceo|cfo|cio|coo|cto|president|chairman|managing\s*director|partner|head\s*of)\b/.test(t)) return 'executive';
  if (/\b(senior|sr\.?|principal|lead|director|vp|vice\s*president)\b/.test(t)) return 'senior';
  if (/\b(junior|jr\.?|entry|intern|associate|assistant|analyst\b(?!.*senior))\b/.test(t)) return 'entry';
  return 'mid';
}

function classifyDepartment(title: string): string {
  const t = title.toLowerCase();
  if (/investment|portfolio|research|analyst|allocation|fund/i.test(t)) return 'Investments';
  if (/compliance|regulatory|legal|risk/i.test(t)) return 'Compliance/Legal';
  if (/client|relationship|business\s*develop|sales|consult/i.test(t)) return 'Client Services';
  if (/technolog|engineer|software|data\s*scien|IT\b|developer/i.test(t)) return 'Technology';
  if (/oper|admin|office|support/i.test(t)) return 'Operations';
  if (/market|commun|brand|content/i.test(t)) return 'Marketing';
  if (/human\s*resource|recruit|talent|people/i.test(t)) return 'HR';
  if (/finance|account|audit|tax/i.test(t)) return 'Finance';
  return 'Other';
}

export async function crawlJobs(): Promise<number> {
  const allEntities = await getAllEntitiesWithCustom();
  // Focus on the most important competitors
  const targets = allEntities.filter(e => e.tier === 'self' || e.tier === 1 || e.tier === 2);
  const postings: JobPosting[] = [];

  for (let i = 0; i < targets.length; i++) {
    const entity = targets[i];
    const query = `"${entity.name}" hiring OR careers OR "join our team" OR job`;
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;

    try {
      const feed = await parser.parseURL(rssUrl);
      for (const item of (feed.items || []).slice(0, 8)) {
        const title = item.title || '';
        const lower = title.toLowerCase();

        // Only keep items that look like job-related news
        if (!/\b(hiring|hires|recruit|job|career|position|role|talent|team|staff|workforce|layoff|cut)\b/i.test(lower)) continue;

        postings.push({
          id: makeId(),
          entity_id: entity.id,
          entity_name: entity.name,
          title: title.substring(0, 200),
          location: '', // Not available from RSS
          department: classifyDepartment(title),
          seniority: classifySeniority(title),
          url: item.link || '',
          posted_date: item.pubDate
            ? new Date(item.pubDate).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
          source: 'Google News',
          created_at: new Date().toISOString(),
        });
      }
    } catch {
      // Skip errors
    }

    if (i + 1 < targets.length) await new Promise(r => setTimeout(r, 200));
  }

  const added = await addJobPostings(postings);

  // Generate trend summaries
  const trends: JobTrend[] = [];
  for (const entity of targets) {
    const entityPostings = await getJobPostings(entity.id);
    if (entityPostings.length === 0) continue;

    const byDept: Record<string, number> = {};
    const bySeniority: Record<string, number> = {};
    for (const p of entityPostings) {
      byDept[p.department] = (byDept[p.department] || 0) + 1;
      bySeniority[p.seniority] = (bySeniority[p.seniority] || 0) + 1;
    }

    trends.push({
      entity_id: entity.id,
      entity_name: entity.name,
      total_postings: entityPostings.length,
      by_department: byDept,
      by_seniority: bySeniority,
      snapshot_date: new Date().toISOString().split('T')[0],
    });
  }
  await saveJobTrends(trends);

  await logCrawl({
    crawl_type: 'job_postings',
    entity_id: null,
    articles_found: added,
    status: 'success',
    error_message: null,
    finished_at: new Date().toISOString(),
  });

  return added;
}
