// Transactional e-mail. Delivery goes through Resend's HTTP API when RESEND_API_KEY is set;
// otherwise the message is only stored in the outbox (status "not_configured") — nothing is sent.
import { run } from '../db.js';
import { config } from '../config.js';

export const mailConnected = () => !!config.mail.resendApiKey;

/** @returns {{status:'sent'|'not_configured'|'failed', error?:string}} */
export async function sendMail({ userId = null, to, subject, text, html = null, kind = 'reminder' }) {
  let status = 'not_configured'; let error = null;
  if (mailConnected()) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${config.mail.resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: config.mail.from, to: [to], subject, text, ...(html ? { html } : {}) }), signal: AbortSignal.timeout(15000),
      });
      if (r.ok) status = 'sent'; else { status = 'failed'; error = `HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`; }
    } catch (e) { status = 'failed'; error = String(e.message || e).slice(0, 200); }
  }
  run('INSERT INTO outbox (user_id, to_email, subject, body_text, body_html, kind, status, error) VALUES (?,?,?,?,?,?,?,?)',
    userId, to, subject, text, html, kind, status, error);
  return { status, error };
}
