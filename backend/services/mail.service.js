import { createRequire } from 'module';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const require = createRequire(import.meta.url);
const LOG = 'MailService';

// Mailer abstraction.
// - If SMTP/Mailer env config present, attempts delivery via nodemailer (optional dep).
// - Otherwise logs the message (dev mode) so the reset link is usable locally
//   and on platforms without SMTP configured.
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.MAILER_HOST;
  const port = parseInt(process.env.MAILER_PORT || '587', 10);
  const user = process.env.MAILER_USER;
  const pass = process.env.MAILER_PASS;
  if (!host || !user || !pass) return null;
  try {
    // dynamic require so the app runs without the optional dependency
    transporter = require('nodemailer').createTransport({
      host, port,
      secure: parseInt(process.env.MAILER_PORT || '587', 10) === 465,
      auth: { user, pass },
    });
    return transporter;
  } catch {
    logger.warn(LOG, 'nodemailer not installed; falling back to console mail');
    return null;
  }
}

function getFromEmail() {
  return process.env.MAILER_FROM || config.auth.mailerFrom || 'no-reply@sovereign.local';
}

// Send an email. Returns { delivery: 'smtp' | 'console', preview }.
export async function sendEmail({ to, subject, html, text }) {
  const t = getTransporter();
  try {
    if (t) {
      await t.sendMail({ from: getFromEmail(), to, subject, html: html || text, text: text || '' });
      logger.info(LOG, 'Email sent via SMTP', { to, subject });
      return { delivery: 'smtp', preview: null };
    }
  } catch (err) {
    logger.error(LOG, 'SMTP send failed, falling back to console', { error: err.message });
  }

  // Console/logger delivery (dev). Log the full body so the reset link is visible.
  const preview = `To: ${to}\nSubject: ${subject}\n\n${html || text}`;
  logger.info(LOG, `[EMAIL-DEV] ${preview}`);
  return { delivery: 'console', preview };
}

// Convenience: build a reset email and send it.
export async function sendPasswordReset({ to, resetUrl }) {
  const subject = 'Reset your Sovereign AI Workbench password';
  const text = `Hello,\n\nWe received a request to reset your Sovereign AI Workbench password.\n\nClick this link to choose a new password (valid for 15 minutes):\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.\n\n- The Sovereign AI Workbench Team`;
  return sendEmail({ to, subject, text, html: text.replace(/\n/g, '<br/>') });
}
