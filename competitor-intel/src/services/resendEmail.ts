import { Resend } from 'resend';
import type { DailyBrief, Article } from '../config/competitors.js';

function getResend(): Resend | null {
  const key = Netlify.env.get('RESEND_API_KEY');
  if (!key) return null;
  return new Resend(key);
}

function getEmailConfig() {
  return {
    to: Netlify.env.get('ALERT_EMAIL_TO') || '',
    from: Netlify.env.get('ALERT_EMAIL_FROM') || 'onboarding@resend.dev',
  };
}

export async function sendDailyDigest(brief: DailyBrief): Promise<{ sent: boolean; error?: string }> {
  const resend = getResend();
  const { to, from } = getEmailConfig();

  if (!resend || !to) {
    return { sent: false, error: !resend ? 'RESEND_API_KEY not set' : 'ALERT_EMAIL_TO not set' };
  }

  const sentimentEmoji = brief.market_sentiment.trend === 'improving' ? '📈' :
    brief.market_sentiment.trend === 'declining' ? '📉' : '➡️';

  const topStoriesHtml = brief.top_stories.slice(0, 5).map(s => `
    <tr>
      <td style="padding:8px; border-bottom:1px solid #eee;">
        <a href="${s.link}" style="color:#4a6cf7; font-weight:bold; text-decoration:none;">${s.title}</a>
        <br><span style="color:#888; font-size:12px;">${s.entity_name} | ${s.sentiment_label} | ${s.reason}</span>
      </td>
    </tr>
  `).join('');

  const riskAlertsHtml = brief.risk_alerts.slice(0, 5).map(r => `
    <tr>
      <td style="padding:8px; border-bottom:1px solid #eee;">
        <span style="color:${r.risk_level === 'critical' ? '#ef4444' : '#f59e0b'}; font-weight:bold;">[${r.risk_level.toUpperCase()}]</span>
        ${r.company_name} — ${r.filing_type}
        <br><span style="font-size:12px; color:#666;">${r.description}</span>
      </td>
    </tr>
  `).join('');

  const eventsHtml = brief.upcoming_events.slice(0, 5).map(e => `
    <tr>
      <td style="padding:6px 8px; border-bottom:1px solid #eee; font-size:13px;">
        <strong>${e.event_date}</strong> — ${e.title} <span style="color:#888;">(${e.category})</span>
      </td>
    </tr>
  `).join('');

  const date = new Date(brief.generated_at).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; color: #333;">
      <div style="background: linear-gradient(135deg, #1a1d27 0%, #2e3347 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin:0; font-size:22px;">Daily Intelligence Brief</h1>
        <p style="margin:6px 0 0; opacity:0.8; font-size:14px;">The Dobbs Group | Graystone Consulting</p>
        <p style="margin:4px 0 0; opacity:0.7; font-size:13px;">${date}</p>
      </div>

      <div style="padding: 20px 24px; background: #fff; border: 1px solid #e5e7eb;">
        <h2 style="color:#1a1d27; font-size:16px; margin:0 0 12px;">${sentimentEmoji} Market Sentiment: ${brief.market_sentiment.trend.toUpperCase()}</h2>
        <div style="display:flex; gap:16px; margin-bottom:16px;">
          <div style="text-align:center; flex:1;">
            <div style="font-size:24px; font-weight:bold; color:#22c55e;">${brief.market_sentiment.positive_pct}%</div>
            <div style="font-size:11px; color:#888;">Positive</div>
          </div>
          <div style="text-align:center; flex:1;">
            <div style="font-size:24px; font-weight:bold; color:#64748b;">${brief.market_sentiment.neutral_pct}%</div>
            <div style="font-size:11px; color:#888;">Neutral</div>
          </div>
          <div style="text-align:center; flex:1;">
            <div style="font-size:24px; font-weight:bold; color:#ef4444;">${brief.market_sentiment.negative_pct}%</div>
            <div style="font-size:11px; color:#888;">Negative</div>
          </div>
        </div>
        <p style="font-size:13px; color:#666;">${brief.market_sentiment.total_articles} articles analyzed</p>

        ${brief.top_stories.length > 0 ? `
          <h3 style="color:#1a1d27; font-size:15px; margin:20px 0 8px; border-top:1px solid #eee; padding-top:16px;">Top Stories</h3>
          <table style="width:100%; border-collapse:collapse;">${topStoriesHtml}</table>
        ` : ''}

        ${brief.risk_alerts.length > 0 ? `
          <h3 style="color:#ef4444; font-size:15px; margin:20px 0 8px; border-top:1px solid #eee; padding-top:16px;">Risk Alerts</h3>
          <table style="width:100%; border-collapse:collapse;">${riskAlertsHtml}</table>
        ` : ''}

        ${brief.upcoming_events.length > 0 ? `
          <h3 style="color:#1a1d27; font-size:15px; margin:20px 0 8px; border-top:1px solid #eee; padding-top:16px;">Upcoming Events (7 days)</h3>
          <table style="width:100%; border-collapse:collapse;">${eventsHtml}</table>
        ` : ''}

        ${brief.competitor_activity.length > 0 ? `
          <h3 style="color:#1a1d27; font-size:15px; margin:20px 0 8px; border-top:1px solid #eee; padding-top:16px;">Competitor Activity</h3>
          <table style="width:100%; border-collapse:collapse;">
            ${brief.competitor_activity.slice(0, 8).map(c => `
              <tr>
                <td style="padding:4px 8px; font-size:13px; border-bottom:1px solid #f0f0f0;">
                  <strong>${c.entity_name}</strong> — ${c.article_count} articles
                  <br><a href="${c.top_link}" style="color:#4a6cf7; font-size:12px; text-decoration:none;">${c.top_headline}</a>
                </td>
              </tr>
            `).join('')}
          </table>
        ` : ''}
      </div>

      <div style="padding:16px 24px; background:#f9fafb; border-radius: 0 0 12px 12px; border:1px solid #e5e7eb; border-top:none;">
        <p style="margin:0; font-size:11px; color:#9ca3af; text-align:center;">
          Competitor Intelligence Dashboard | The Dobbs Group | Graystone Consulting<br>
          <a href="https://competitor-intel-dashboard.netlify.app" style="color:#4a6cf7; text-decoration:none;">View full dashboard</a>
        </p>
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from,
      to: to.split(',').map(e => e.trim()),
      subject: `${sentimentEmoji} Daily Brief: ${brief.market_sentiment.trend} | ${brief.top_stories.length} stories | ${brief.risk_alerts.length} alerts`,
      html,
    });
    return { sent: true };
  } catch (err: any) {
    console.error(`[EMAIL] Failed: ${err.message}`);
    return { sent: false, error: err.message };
  }
}

export async function sendAlertEmail(articles: Article[]): Promise<{ sent: boolean; error?: string }> {
  const resend = getResend();
  const { to, from } = getEmailConfig();
  if (!resend || !to) return { sent: false, error: 'Email not configured' };

  const rows = articles.map(a => `
    <tr>
      <td style="padding:8px; border-bottom:1px solid #eee;">
        <a href="${a.link}" style="color:#ef4444; font-weight:bold; text-decoration:none;">${a.title}</a>
        <br><span style="color:#888; font-size:12px;">${a.entity_name} | ${a.source} | ${new Date(a.pub_date).toLocaleDateString()}</span>
        <br><span style="font-size:13px; color:#333;">${(a.snippet || '').substring(0, 200)}</span>
      </td>
    </tr>
  `).join('');

  try {
    await resend.emails.send({
      from,
      to: to.split(',').map(e => e.trim()),
      subject: `🚨 Alert: ${articles.length} negative/priority article(s) — Competitor Intel`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width:600px; margin:0 auto;">
          <div style="background:#ef4444; color:white; padding:16px 24px; border-radius:8px 8px 0 0;">
            <h2 style="margin:0;">Negative Article Alert</h2>
            <p style="margin:4px 0 0; opacity:0.9; font-size:13px;">The Dobbs Group — Competitor Intelligence</p>
          </div>
          <div style="padding:16px 24px; background:#fff; border:1px solid #e5e7eb;">
            <table style="width:100%; border-collapse:collapse;">${rows}</table>
          </div>
          <div style="padding:12px 24px; background:#f9fafb; border-radius:0 0 8px 8px; border:1px solid #e5e7eb; border-top:none;">
            <p style="margin:0; font-size:11px; color:#9ca3af; text-align:center;">
              <a href="https://competitor-intel-dashboard.netlify.app" style="color:#4a6cf7;">View Dashboard</a>
            </p>
          </div>
        </div>
      `,
    });
    return { sent: true };
  } catch (err: any) {
    return { sent: false, error: err.message };
  }
}
