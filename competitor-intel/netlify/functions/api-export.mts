import type { Context } from '@netlify/functions';
import { verifyAuth } from '../../src/services/auth.js';
import {
  getAllArticles, getSecFilings, getAumData, getLatestBrief,
  getPersonnelChanges, getMandateEvents, getJobTrends,
  getAdvAnalyses, getArticleStats,
} from '../../src/services/blobStore.js';

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (v: string) => {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(row.map(v => escape(String(v ?? ''))).join(','));
  }
  return lines.join('\n');
}

export default async (req: Request, context: Context) => {
  const authError = verifyAuth(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const type = url.searchParams.get('type') || 'brief';
  const format = url.searchParams.get('format') || 'csv';

  try {
    if (type === 'brief') {
      const brief = await getLatestBrief();
      if (!brief) return Response.json({ error: 'No brief available' }, { status: 404 });

      if (format === 'json') {
        return new Response(JSON.stringify(brief, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': 'attachment; filename="daily-brief.json"',
          },
        });
      }

      // CSV summary
      const rows: string[][] = [];
      rows.push(['Section', 'Data']);
      rows.push(['Generated', brief.generated_at]);
      rows.push(['Sentiment Score', String(brief.market_sentiment.avg_score)]);
      rows.push(['Trend', brief.market_sentiment.trend]);
      rows.push(['Total Articles', String(brief.market_sentiment.total_articles)]);
      rows.push(['Positive %', String(brief.market_sentiment.positive_pct)]);
      rows.push(['Neutral %', String(brief.market_sentiment.neutral_pct)]);
      rows.push(['Negative %', String(brief.market_sentiment.negative_pct)]);
      rows.push(['', '']);
      rows.push(['TOP STORIES', '']);
      for (const s of brief.top_stories) {
        rows.push([s.entity_name, `${s.title} (${s.sentiment_label})`]);
      }
      rows.push(['', '']);
      rows.push(['RISK ALERTS', '']);
      for (const r of brief.risk_alerts) {
        rows.push([r.company_name, `${r.filing_type} - ${r.risk_level} (score: ${r.risk_score})`]);
      }

      return new Response(toCsv(['Section', 'Data'], rows), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="daily-brief.csv"',
        },
      });
    }

    if (type === 'articles') {
      const articles = await getAllArticles({ limit: 500 });
      const headers = ['Date', 'Entity', 'Title', 'Source', 'Sentiment', 'Score', 'Priority', 'Link'];
      const rows = articles.map(a => [
        a.pub_date, a.entity_name, a.title, a.source,
        a.sentiment_label, String(a.sentiment_score),
        a.priority ? 'Yes' : 'No', a.link,
      ]);
      return new Response(toCsv(headers, rows), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="competitor-articles.csv"',
        },
      });
    }

    if (type === 'sec') {
      const filings = await getSecFilings({ limit: 500 });
      const headers = ['Filed Date', 'Company', 'Type', 'Risk Level', 'Score', 'Top Words', 'URL'];
      const rows = filings.map(f => [
        f.filed_date, f.company_name, f.filing_type, f.risk_level,
        String(f.risk_score), (f.top_words || []).join('; '), f.document_url,
      ]);
      return new Response(toCsv(headers, rows), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="sec-filings.csv"',
        },
      });
    }

    if (type === 'aum') {
      const aumData = await getAumData();
      const headers = ['Entity', 'AUM ($B)', 'Discretionary ($B)', 'Non-Discretionary ($B)', 'As Of', 'Source'];
      const rows = aumData
        .sort((a, b) => b.aum_billions - a.aum_billions)
        .map(e => [
          e.entity_name, String(e.aum_billions),
          String(e.discretionary_billions || ''), String(e.non_discretionary_billions || ''),
          e.as_of_date, e.source,
        ]);
      return new Response(toCsv(headers, rows), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="aum-data.csv"',
        },
      });
    }

    if (type === 'personnel') {
      const changes = await getPersonnelChanges();
      const headers = ['Date', 'Entity', 'Person', 'Change Type', 'New Role', 'Source', 'Details'];
      const rows = changes.map(p => [
        p.date, p.entity_name, p.person_name, p.change_type,
        p.new_role, p.source, p.details.substring(0, 200),
      ]);
      return new Response(toCsv(headers, rows), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="personnel-changes.csv"',
        },
      });
    }

    if (type === 'mandates') {
      const events = await getMandateEvents();
      const headers = ['Date', 'Entity', 'Client', 'Type', 'Event', 'Size ($B)', 'Asset Class', 'Source'];
      const rows = events.map(m => [
        m.date, m.entity_name, m.client_name, m.client_type,
        m.event_type, String(m.mandate_size_billions || ''),
        m.asset_class || '', m.source,
      ]);
      return new Response(toCsv(headers, rows), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="mandate-events.csv"',
        },
      });
    }

    if (type === 'adv') {
      const analyses = await getAdvAnalyses();
      const headers = ['Entity', 'AUM ($B)', 'Discretionary ($B)', 'Employees', 'Advisory Employees', 'Accounts', 'Compensation', 'Disciplinary'];
      const rows = analyses.map(a => [
        a.entity_name, String(a.total_aum), String(a.discretionary_aum),
        String(a.employees), String(a.advisory_employees), String(a.total_accounts),
        a.compensation_methods.join('; '), a.disciplinary_disclosures ? 'Yes' : 'No',
      ]);
      return new Response(toCsv(headers, rows), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="form-adv-analysis.csv"',
        },
      });
    }

    return Response.json({ error: `Unknown export type: ${type}` }, { status: 400 });

  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};

export const config = { path: '/api/export' };
