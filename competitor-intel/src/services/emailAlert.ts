import nodemailer from 'nodemailer';
import { SELF, type Article } from '../config/competitors.js';
import { getUnalertedNegativeArticles, markAlerted } from './blobStore.js';

function getSmtpConfig() {
  const host = Netlify.env.get('SMTP_HOST');
  const user = Netlify.env.get('SMTP_USER');
  const pass = Netlify.env.get('SMTP_PASS');
  if (!host || !user || !pass) return null;

  return {
    host,
    port: parseInt(Netlify.env.get('SMTP_PORT') || '587'),
    secure: false,
    auth: { user, pass },
  };
}

function buildAlertHtml(articles: Article[]): string {
  const rows = articles.map(a => `
    <tr>
      <td style="padding:8px; border-bottom:1px solid #eee;">
        <a href="${a.link}" style="color:#c0392b; font-weight:bold;">${a.title}</a>
        <br><span style="color:#888; font-size:12px;">${a.source} | ${new Date(a.pub_date).toLocaleDateString()}</span>
        <br><span style="font-size:13px; color:#333;">${a.snippet ? a.snippet.substring(0, 200) + '...' : ''}</span>
        <br><span style="color:#c0392b; font-size:11px;">Sentiment: ${a.sentiment_score} (${a.sentiment_label})</span>
      </td>
    </tr>
  `).join('');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #c0392b; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h2 style="margin:0;">Negative Article Alert</h2>
        <p style="margin:4px 0 0; opacity:0.9;">The Dobbs Group - Competitor Intelligence</p>
      </div>
      <div style="padding: 16px 24px; background: #fff; border: 1px solid #ddd;">
        <p>The following negative article(s) mentioning <strong>The Dobbs Group</strong> have been detected:</p>
        <table style="width:100%; border-collapse:collapse;">${rows}</table>
        <p style="margin-top:16px; font-size:13px; color:#666;">
          Review these articles promptly. This is an automated alert from your Competitor Intelligence system.
        </p>
      </div>
      <div style="padding:12px 24px; background:#f5f5f5; border-radius: 0 0 8px 8px; border:1px solid #ddd; border-top:none;">
        <p style="margin:0; font-size:11px; color:#999; text-align:center;">
          Competitor Intel Dashboard | The Dobbs Group | Graystone Consulting
        </p>
      </div>
    </div>
  `;
}

export async function checkAndAlertNegativeArticles(): Promise<{
  sent: boolean;
  reason?: string;
  articles?: number;
  to?: string;
}> {
  const articles = await getUnalertedNegativeArticles(SELF.id);

  if (articles.length === 0) {
    return { sent: false, reason: 'No new negative articles' };
  }

  console.log(`[ALERT] Found ${articles.length} negative article(s) about ${SELF.name}`);

  const smtp = getSmtpConfig();
  if (!smtp) {
    console.log('[ALERT] SMTP not configured - marking articles as alerted without sending');
    await markAlerted(SELF.id, articles.map(a => a.id));
    return { sent: false, reason: 'SMTP not configured', articles: articles.length };
  }

  const alertTo = Netlify.env.get('ALERT_TO') || '';
  const alertFrom = Netlify.env.get('ALERT_FROM') || smtp.auth.user;

  if (!alertTo) {
    await markAlerted(SELF.id, articles.map(a => a.id));
    return { sent: false, reason: 'ALERT_TO not set', articles: articles.length };
  }

  try {
    const transporter = nodemailer.createTransport(smtp);
    await transporter.sendMail({
      from: alertFrom,
      to: alertTo,
      subject: `ALERT: Negative Article About The Dobbs Group (${articles.length} article${articles.length > 1 ? 's' : ''})`,
      html: buildAlertHtml(articles),
    });

    await markAlerted(SELF.id, articles.map(a => a.id));
    console.log(`[ALERT] Email sent to ${alertTo} with ${articles.length} article(s)`);
    return { sent: true, to: alertTo, articles: articles.length };
  } catch (err: any) {
    console.error(`[ALERT] Failed to send email: ${err.message}`);
    return { sent: false, reason: err.message, articles: articles.length };
  }
}
