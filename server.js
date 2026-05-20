import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import nodemailer from 'nodemailer';
import OpenAI from 'openai';
import twilio from 'twilio';
import WebSocket from 'ws';
import QRCode from 'qrcode';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';
const sessionCookie = 'cmi_session';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

const required = ['SESSION_SECRET'];
for (const key of required) {
  if (!process.env[key]) console.warn(`[config] Missing ${key}`);
}

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      realtime: { transport: WebSocket },
    })
  : null;

const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const boltAgentUrl = process.env.BOLT_AGENT_URL || process.env.HERMES_AGENT_URL;
const boltAgentKey = process.env.BOLT_AGENT_API_KEY || process.env.HERMES_AGENT_API_KEY;
const boltAgent = boltAgentUrl && boltAgentKey
  ? new OpenAI({
      baseURL: `${boltAgentUrl.replace(/\/$/, '')}/v1`,
      apiKey: boltAgentKey,
    })
  : null;

function staffUsers() {
  try {
    const users = JSON.parse(process.env.STAFF_USERS_JSON || '[]');
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function signSession(user) {
  return jwt.sign(
    { sub: user.email, email: user.email, name: user.name, role: user.role || 'staff' },
    process.env.SESSION_SECRET || 'dev-secret',
    { expiresIn: '12h' },
  );
}

function verifyToken(req) {
  const auth = req.get('authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const token = req.cookies[sessionCookie] || bearer;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.SESSION_SECRET || 'dev-secret');
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const user = verifyToken(req);
  if (!user) return res.status(401).json({ message: 'Authentication required' });
  req.user = user;
  next();
}

function requireStaff(req, res, next) {
  requireAuth(req, res, () => {
    const role = String(req.user.role || '').toLowerCase();
    if (role !== 'staff' && role !== 'super_admin') {
      return res.status(403).json({ message: 'Staff access required' });
    }
    next();
  });
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function resetPasswordUrl(token) {
  const configured = process.env.DASHBOARD_URL || process.env.APP_URL || process.env.PUBLIC_SITE_URL || 'https://my.constructedmatter.com';
  const base = String(configured).replace(/\/$/, '');
  const root = /\.html(?:[?#].*)?$/i.test(base) ? base.replace(/\/[^/]*$/, '') : base;
  return `${root}/reset-password.html?token=${encodeURIComponent(token)}`;
}

function requireSuperAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (String(req.user.role || '').toLowerCase() !== 'super_admin') {
      return res.status(403).json({ message: 'Super Admin access required' });
    }
    next();
  });
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d+]/g, '');
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function splitName(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || '',
    last_name: parts.slice(1).join(' '),
  };
}

function safeRole(value) {
  const role = String(value || 'staff').toLowerCase();
  return ['super_admin', 'staff', 'subcontractor', 'vendor', 'client'].includes(role) ? role : 'staff';
}

function slugify(value = '') {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'team-member';
}

function teamRowFromProfilePayload(body = {}, email) {
  const firstName = String(body.first_name || '').trim();
  const lastName = String(body.last_name || '').trim();
  const name = String(body.name || `${firstName} ${lastName}`.trim() || email || 'Team Member').trim();
  const attrs = Array.isArray(body.attributes_json) ? body.attributes_json : [];
  return {
    name,
    slug: slugify(name),
    first_name: firstName,
    last_name: lastName,
    nickname: body.nickname || '',
    role: body.role || body.job_title || '',
    bio: body.bio || '',
    email: email || body.email || '',
    phone: body.phone || '',
    linkedin_url: body.linkedin_url || '',
    profile_photo: body.profile_photo || '',
    secondary_photo: body.secondary_photo || '',
    attributes: attrs.map(a => (typeof a === 'object' ? a.title : a)).filter(Boolean),
    attributes_json: attrs,
    availability: typeof body.schedule === 'string' ? body.schedule : (body.availability || ''),
    schedule_json: Array.isArray(body.schedule_json) ? body.schedule_json : null,
    status: 'active',
    sync_status: 'pending',
    updated_at: new Date().toISOString(),
  };
}

function userRoleFromType(value) {
  const normalized = String(value || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'sub_contractor') return 'subcontractor';
  return safeRole(normalized);
}

function contactTypeForRole(role) {
  return {
    client: 'Client',
    vendor: 'Vendor',
    subcontractor: 'Sub Contractor',
  }[role] || 'Lead';
}

function roleFromContactType(type) {
  const normalized = String(type || '').toLowerCase();
  if (normalized === 'sub contractor' || normalized === 'subcontractor') return 'subcontractor';
  if (normalized === 'vendor') return 'vendor';
  if (normalized === 'client') return 'client';
  return 'client';
}

function safeUserStatus(value, fallback = 'active') {
  const status = String(value || fallback).toLowerCase();
  return ['invited', 'active', 'disabled', 'archived'].includes(status) ? status : fallback;
}

function parseCsvRows(text = '') {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some(value => String(value).trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some(value => String(value).trim())) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows.shift().map(h => String(h || '').trim().toLowerCase().replace(/[\s-]+/g, '_'));
  return rows.map(values => Object.fromEntries(headers.map((h, index) => [h, String(values[index] || '').trim()])));
}

async function sendInviteSms({ to, name, role }) {
  const phone = normalizePhone(to);
  if (!phone) return { skipped: true, reason: 'No phone number' };
  if (!twilioClient) return { skipped: true, reason: 'Twilio is not configured' };
  const body = `Constructed Matter has invited ${name || 'you'} to the CMI ${role || 'user'} portal. Visit ${portalLoginUrl()} to sign in or register.`;
  const payload = { to: phone, body };
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) payload.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  else payload.from = process.env.TWILIO_FROM_NUMBER;
  return twilioClient.messages.create(payload);
}

function portalLoginUrl() {
  const configured = process.env.DASHBOARD_URL || process.env.APP_URL || process.env.PUBLIC_SITE_URL || 'https://my.constructedmatter.com';
  const base = String(configured).replace(/\/$/, '');
  return /\.html(?:[?#].*)?$/i.test(base) ? base : `${base}/dashboard.html`;
}

async function notifyInvite({ email, phone, name, role, notify_email, notify_sms }) {
  const result = { email_status: 'not_requested', sms_status: 'not_requested' };
  if (notify_email && email) {
    try {
      await sendMail({
        to: email,
        subject: 'You have been invited to the CMI portal',
        body: [
          `Hi ${name || 'there'},`,
          '',
          `Constructed Matter has invited you to the CMI ${role || 'user'} portal.`,
          `Sign in or register here: ${portalLoginUrl()}`,
          '',
          'Constructed Matter, Inc.',
        ].join('\n'),
      });
      result.email_status = 'sent';
    } catch (err) {
      result.email_status = `error: ${err.message}`;
    }
  }
  if (notify_sms && phone) {
    try {
      const sent = await sendInviteSms({ to: phone, name, role });
      result.sms_status = sent?.skipped ? 'skipped' : 'sent';
    } catch (err) {
      result.sms_status = `error: ${err.message}`;
    }
  }
  return result;
}

function wpAuthHeader() {
  const user = process.env.WP_BASIC_USER;
  const pass = process.env.WP_BASIC_APP_PASSWORD;
  if (!user || !pass) return null;
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

async function supabaseInsert(table, payload) {
  if (!supabase) return null;
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}

async function supabaseUpsertContact(payload) {
  if (!supabase || !payload.email) return null;
  const { data, error } = await supabase
    .from('contacts')
    .upsert(payload, { onConflict: 'email' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function resolveMessageContact(body = {}) {
  if (!supabase) return null;
  if (isUuid(body.contact_id)) {
    const { data } = await supabase.from('contacts').select('*').eq('id', body.contact_id).maybeSingle();
    if (data) return data;
  }

  const source = body.contact || {};
  const email = String(source.email || body.email || '').trim().toLowerCase();
  if (email) {
    const payload = {
      first_name: source.first_name || '',
      last_name: source.last_name || '',
      email,
      phone: source.phone || body.to || null,
      company: source.company || null,
      type: source.type || 'Lead',
      status: source.status || 'active',
      source: source.source || (source._source === 'supabase' ? 'Dashboard' : 'FluentCRM'),
      last_activity: new Date().toISOString(),
    };
    const fluentId = Number(source.id);
    if (Number.isFinite(fluentId)) payload.fluent_crm_id = fluentId;
    return supabaseUpsertContact(payload);
  }

  const phone = normalizePhone(source.phone || body.to || '');
  if (phone) {
    const { data } = await supabase.from('contacts').select('*').eq('phone', phone).maybeSingle();
    if (data) return data;
  }
  return null;
}

async function forwardToFluentCRM(payload) {
  const base = process.env.WP_BASE_URL;
  const auth = wpAuthHeader();
  if (!base || !auth || !payload.email) return null;

  const res = await fetch(`${base.replace(/\/$/, '')}/fluent-crm/v2/subscribers`, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `FluentCRM HTTP ${res.status}`);
  return data;
}

async function sendNotificationEmail(payload) {
  if (!process.env.SMTP_ENDPOINT) return { skipped: true };
  const res = await fetch(process.env.SMTP_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Email endpoint HTTP ${res.status}`);
  return res.json().catch(() => ({ ok: true }));
}

async function sendMail(payload) {
  const to = payload.to || process.env.NOTIFY_EMAIL;
  if (!to) return { skipped: true, reason: 'No recipient configured' };

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || 'true') === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      bcc: payload.bcc || process.env.NOTIFY_BCC || undefined,
      subject: payload.subject || 'Constructed Matter Notification',
      text: payload.body || payload.text || '',
      html: payload.html || undefined,
    });
  }

  return sendNotificationEmail(payload);
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'cmi-web', time: new Date().toISOString() });
});

async function findDbPortalUser(email) {
  if (!supabase || !email) return null;
  const { data, error } = await supabase
    .from('staff_users')
    .select('id,email,display_name,first_name,last_name,role_slug,status,password_hash')
    .eq('email', email)
    .maybeSingle();
  if (error) {
    console.warn('[auth/staff_users]', error.message);
    return null;
  }
  return data || null;
}

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const envUser = staffUsers().find(u => String(u.email || '').toLowerCase() === email);
  const dbUser = await findDbPortalUser(email);
  if ((!envUser && !dbUser) || !password) return res.status(401).json({ message: 'Incorrect email or password.' });
  if (dbUser && ['disabled', 'archived'].includes(String(dbUser.status || '').toLowerCase())) {
    return res.status(403).json({ message: 'This account is not active.' });
  }

  let ok = false;
  if (envUser) {
    const stored = String(envUser.password_hash || envUser.password || '');
    ok = envUser.password_hash ? await bcrypt.compare(password, stored) : password === stored;
  }
  if (!ok && dbUser?.password_hash) ok = await bcrypt.compare(password, String(dbUser.password_hash));
  if (!ok) return res.status(401).json({ message: 'Incorrect email or password.' });

  const displayName = envUser?.name || dbUser?.display_name || `${dbUser?.first_name || ''} ${dbUser?.last_name || ''}`.trim() || email;
  const sessionUser = { email, name: displayName, role: envUser?.role || dbUser?.role_slug || 'staff' };
  const token = signSession(sessionUser);
  res.cookie(sessionCookie, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000,
  });
  res.json({ token, ...sessionUser });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const generic = { ok: true, message: 'If an account exists, a reset link will be sent.' };
  if (!email || !email.includes('@')) return res.json(generic);

  try {
    const envUser = staffUsers().find(u => String(u.email || '').toLowerCase() === email);
    const dbUser = await findDbPortalUser(email);
    if (!envUser && !dbUser) return res.json(generic);
    if (dbUser && ['disabled', 'archived'].includes(String(dbUser.status || '').toLowerCase())) return res.json(generic);
    if (!supabase) {
      console.warn('[auth/forgot-password] Supabase is not configured; cannot persist reset token.');
      return res.json(generic);
    }

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await supabase.from('password_reset_tokens').insert({
      email,
      token_hash: tokenHash,
      staff_user_id: dbUser?.id || null,
      expires_at: expiresAt,
      requested_ip: req.ip || null,
    });

    await sendMail({
      to: email,
      subject: 'Reset your CMI portal password',
      body: [
        `Hi ${envUser?.name || dbUser?.display_name || 'there'},`,
        '',
        'We received a request to reset your Constructed Matter portal password.',
        `Reset your password here: ${resetPasswordUrl(rawToken)}`,
        '',
        'This link expires in 1 hour. If you did not request this, you can ignore this email.',
        '',
        'Constructed Matter, Inc.',
      ].join('\n'),
    }).catch(err => console.warn('[auth/forgot-password mail]', err.message));

    res.json(generic);
  } catch (err) {
    console.warn('[auth/forgot-password]', err.message);
    res.json(generic);
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const token = String(req.body.token || '').trim();
  const password = String(req.body.password || '');
  if (!token) return res.status(400).json({ message: 'Reset token is required.' });
  if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  if (!supabase) return res.status(503).json({ message: 'Password reset is not configured.' });

  try {
    const tokenHash = hashResetToken(token);
    const { data: reset, error } = await supabase
      .from('password_reset_tokens')
      .select('id,email,staff_user_id,expires_at,used_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (error) throw error;
    if (!reset || reset.used_at) return res.status(400).json({ message: 'This reset link is invalid or has already been used.' });
    if (new Date(reset.expires_at).getTime() < Date.now()) return res.status(400).json({ message: 'This reset link has expired.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = reset.staff_user_id
      ? { id: reset.staff_user_id }
      : await findDbPortalUser(String(reset.email || '').toLowerCase());
    if (!user?.id) return res.status(400).json({ message: 'No portal account was found for this reset link.' });

    const { error: updateError } = await supabase
      .from('staff_users')
      .update({
        password_hash: passwordHash,
        password_set_at: new Date().toISOString(),
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);
    if (updateError) throw updateError;

    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', reset.id);

    res.json({ ok: true, message: 'Password updated. You can sign in now.' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Password reset failed.' });
  }
});

app.get('/api/auth/session', requireAuth, (req, res) => {
  res.json({ email: req.user.email, name: req.user.name, role: req.user.role });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(sessionCookie);
  res.json({ ok: true });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const body = req.body || {};
    const contact = await supabaseUpsertContact({
      first_name: body.first_name || '',
      last_name: body.last_name || '',
      email: String(body.email || '').trim().toLowerCase(),
      phone: body.phone || null,
      type: body.tags?.includes('Vendors') ? 'Vendor' : 'Client',
      source: 'Website Registration',
      tags: body.tags || [],
    });
    await forwardToFluentCRM(body).catch(err => console.warn('[fluentcrm/register]', err.message));
    res.json({ ok: true, contact });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Registration failed' });
  }
});

app.post('/api/wp-json/wp/v2/media', requireStaff, upload.single('file'), async (req, res) => {
  try {
    const base = process.env.WP_BASE_URL;
    const auth = wpAuthHeader();
    if (!base || !auth) return res.status(503).json({ message: 'WordPress proxy is not configured' });
    if (!req.file) return res.status(400).json({ message: 'File is required' });

    const upstream = await fetch(`${base.replace(/\/$/, '')}/wp/v2/media`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Disposition': `attachment; filename="${req.file.originalname}"`,
        'Content-Type': req.file.mimetype || 'application/octet-stream',
      },
      body: req.file.buffer,
    });
    const data = await upstream.json().catch(() => ({}));
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ message: err.message || 'WordPress media upload failed' });
  }
});

app.all('/api/wp-json/*', requireStaff, async (req, res) => {
  try {
    const base = process.env.WP_BASE_URL;
    const auth = wpAuthHeader();
    if (!base || !auth) return res.status(503).json({ message: 'WordPress proxy is not configured' });

    const suffix = req.params[0] || '';
    const target = `${base.replace(/\/$/, '')}/${suffix}${req.url.includes('?') ? '?' + req.url.split('?').slice(1).join('?') : ''}`;
    const headers = { Authorization: auth };
    if (req.get('content-type')) headers['Content-Type'] = req.get('content-type');
    if (req.get('content-disposition')) headers['Content-Disposition'] = req.get('content-disposition');

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });
    const contentType = upstream.headers.get('content-type') || '';
    res.status(upstream.status);
    if (contentType.includes('application/json')) return res.json(await upstream.json());
    res.type(contentType || 'text/plain').send(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    res.status(502).json({ message: err.message || 'WordPress proxy failed' });
  }
});

app.post('/api/leads/contact', async (req, res) => {
  try {
    const body = req.body || {};
    const contact = await supabaseUpsertContact({
      first_name: body.first_name || '',
      last_name: body.last_name || '',
      email: String(body.email || '').trim().toLowerCase(),
      phone: body.phone || null,
      type: 'Lead',
      source: body.custom_values?.source || 'Contact Form',
      tags: body.tags || ['Website Inquiry'],
      notes: body.project_description || null,
    });
    if (body.project_title || body.project_description) {
      await supabaseInsert('quotes', {
        contact_id: contact?.id || null,
        name: `${body.first_name || ''} ${body.last_name || ''}`.trim(),
        email: body.email || null,
        phone: body.phone || null,
        project_type: body.project_title || null,
        description: body.project_description || null,
        source: body.custom_values?.source || 'Contact Form',
      });
    }
    await forwardToFluentCRM(body).catch(err => console.warn('[fluentcrm/contact]', err.message));
    await sendMail({
      to: process.env.NOTIFY_EMAIL,
      bcc: process.env.NOTIFY_BCC,
      subject: `New Contact Form Submission - ${body.project_title || body.email || 'Website'}`,
      body: [
        `Name: ${body.first_name || ''} ${body.last_name || ''}`.trim(),
        `Email: ${body.email || ''}`,
        `Phone: ${body.phone || 'Not provided'}`,
        `Project: ${body.project_title || 'Not specified'}`,
        `Source: ${body.custom_values?.source || 'Not specified'}`,
        '',
        'Message:',
        body.project_description || '',
      ].join('\n'),
    }).catch(err => console.warn('[email/contact]', err.message));
    res.json({ ok: true, contact });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Contact submission failed' });
  }
});

app.post('/api/leads/quote', async (req, res) => {
  try {
    const body = req.body || {};
    const custom = body.custom_values || {};
    const contact = await supabaseUpsertContact({
      first_name: body.first_name || '',
      last_name: body.last_name || '',
      email: String(body.email || '').trim().toLowerCase(),
      phone: body.phone || null,
      type: 'Lead',
      source: 'Quote Form',
      tags: body.tags || ['Website Inquiry'],
    });
    await supabaseInsert('quotes', {
      contact_id: contact?.id || null,
      name: `${body.first_name || ''} ${body.last_name || ''}`.trim(),
      email: body.email || null,
      phone: body.phone || null,
      project_type: custom.category || null,
      location: custom.location || null,
      sq_ft: custom.square_feet ? Number(custom.square_feet) || null : null,
      timeline: custom.timeline || null,
      services: custom.services ? String(custom.services).split(',').map(s => s.trim()).filter(Boolean) : [],
      description: custom.project_description || null,
      source: 'Quote Form',
    });
    await forwardToFluentCRM(body).catch(err => console.warn('[fluentcrm/quote]', err.message));
    await sendMail({
      to: process.env.NOTIFY_EMAIL,
      bcc: process.env.NOTIFY_BCC,
      subject: `New Quote Request - ${custom.project_title || body.email || 'Website'}`,
      body: [
        `Name: ${body.first_name || ''} ${body.last_name || ''}`.trim(),
        `Email: ${body.email || ''}`,
        `Phone: ${body.phone || 'Not provided'}`,
        `Project: ${custom.project_title || 'Not specified'}`,
        `Location: ${custom.location || 'Not specified'}`,
        `Category: ${custom.category || 'Not specified'}`,
        `Services: ${custom.services || 'Not specified'}`,
        `Timeline: ${custom.timeline || 'Not specified'}`,
        `Square Feet: ${custom.square_feet || 'Not provided'}`,
        '',
        'Description:',
        custom.project_description || '',
      ].join('\n'),
    }).catch(err => console.warn('[email/quote]', err.message));
    res.json({ ok: true, contact });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Quote submission failed' });
  }
});

app.post('/api/notifications/email', requireStaff, async (req, res) => {
  try {
    const result = await sendMail(req.body);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Email failed' });
  }
});

app.get('/api/contacts', requireStaff, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    const q = String(req.query.q || '').trim();
    let query = supabase
      .from('contacts')
      .select('id,first_name,last_name,email,phone,type,company,status')
      .order('last_activity', { ascending: false, nullsFirst: false })
      .limit(200);
    if (q) {
      query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,company.ilike.%${q}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    res.json({ contacts: data || [] });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Contacts load failed' });
  }
});

app.post('/api/contacts', requireStaff, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const allowedTypes = new Set(['Client', 'Lead', 'Vendor', 'Sub Contractor']);
    const contact = await supabaseUpsertContact({
      first_name: String(body.first_name || '').trim(),
      last_name: String(body.last_name || '').trim(),
      email,
      phone: body.phone || null,
      company: body.company || null,
      type: allowedTypes.has(body.type) ? body.type : 'Lead',
      status: body.status || 'active',
      source: body.source || 'Dashboard',
      notes: body.notes || null,
      last_activity: new Date().toISOString(),
    });
    res.json({ ok: true, contact });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Contact save failed' });
  }
});

app.get('/api/project-participants', requireStaff, async (_req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    const [staffRes, contactsRes] = await Promise.all([
      supabase
        .from('staff_users')
        .select('id,email,display_name,first_name,last_name,phone,title,role_slug,status')
        .order('display_name', { ascending: true }),
      supabase
        .from('contacts')
        .select('id,first_name,last_name,email,phone,type,company,status')
        .order('last_name', { ascending: true, nullsFirst: false })
        .limit(500),
    ]);
    if (staffRes.error) throw staffRes.error;
    if (contactsRes.error) throw contactsRes.error;
    const staff = (staffRes.data || []).map(row => ({
      id: `staff:${row.id}`,
      record_id: row.id,
      source: 'staff_users',
      type: row.role_slug === 'super_admin' ? 'Super Admin' : 'Staff',
      name: row.display_name || `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email,
      email: row.email || '',
      phone: row.phone || '',
      company: 'Constructed Matter, Inc.',
      status: row.status || '',
    }));
    const contacts = (contactsRes.data || []).map(row => ({
      id: `contact:${row.id}`,
      record_id: row.id,
      source: 'contacts',
      type: row.type || 'Client',
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.company || row.email || row.phone || 'Contact',
      email: row.email || '',
      phone: row.phone || '',
      company: row.company || '',
      status: row.status || '',
    }));
    res.json({ participants: [...staff, ...contacts] });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Participant load failed' });
  }
});

app.post('/api/projects/fluent-sync', requireStaff, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    const tasks = Array.isArray(req.body?.tasks) ? req.body.tasks : [];
    const rows = tasks.map(task => {
      const fluentTaskId = Number.parseInt(task.id, 10);
      if (!Number.isFinite(fluentTaskId)) return null;
      const fluentBoardId = Number.parseInt(task.board_id || task._boardId, 10);
      const assignees = Array.isArray(task.assignees)
        ? task.assignees.map(a => a.display_name || a.full_name || a.name || a.email).filter(Boolean)
        : [];
      return {
        fluent_board_id: Number.isFinite(fluentBoardId) ? fluentBoardId : null,
        fluent_task_id: fluentTaskId,
        title: String(task.title || 'Untitled FluentBoards task').trim(),
        description: task.description || null,
        status: task.status || 'active',
        stage: task.stage_title || (task.stage_id ? String(task.stage_id) : null),
        priority: ['low', 'medium', 'high', 'urgent'].includes(String(task.priority || '').toLowerCase())
          ? String(task.priority).toLowerCase()
          : 'medium',
        due_date: task.due_at ? new Date(task.due_at).toISOString().slice(0, 10) : null,
        board_name: task.board_title || task._boardTitle || null,
        assignees,
        tags: Array.isArray(task.labels) ? task.labels.map(l => l.title || l.name).filter(Boolean) : [],
        updated_at: new Date().toISOString(),
      };
    }).filter(Boolean);
    if (!rows.length) return res.json({ ok: true, count: 0 });
    const { error } = await supabase.from('projects').upsert(rows, { onConflict: 'fluent_task_id' });
    if (error) throw error;
    res.json({ ok: true, count: rows.length });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Project sync failed' });
  }
});

app.get('/api/users', requireSuperAdmin, async (_req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    const envUsers = staffUsers().map(user => ({
      email: String(user.email || '').toLowerCase(),
      name: user.name || user.email || '',
      phone: user.phone || '',
      role: safeRole(user.role),
      status: 'active',
      source: 'env',
    })).filter(user => user.email);

    let dbStaff = [];
    const staffRes = await supabase
      .from('staff_users')
      .select('id,email,display_name,title,role_slug,status,phone,team_member_id,team_members(id,name,slug,role,email)')
      .order('display_name', { ascending: true });
    if (staffRes.error) {
      console.warn('[users/staff_users]', staffRes.error.message);
    } else {
      dbStaff = staffRes.data || [];
    }

    const byEmail = new Map();
    envUsers.forEach(user => byEmail.set(user.email, user));
    dbStaff.forEach(row => {
      const email = String(row.email || '').toLowerCase();
      if (!email) return;
      const existing = byEmail.get(email) || {};
      const linkedTeam = Array.isArray(row.team_members) ? row.team_members[0] : row.team_members;
      byEmail.set(email, {
        ...existing,
        id: row.id,
        email,
        name: existing.name || row.display_name || email,
        phone: row.phone || existing.phone || '',
        title: row.title || existing.title || '',
        role: safeRole(existing.role || row.role_slug),
        status: existing.status === 'active' ? 'active' : (row.status || 'invited'),
        source: existing.source === 'env' ? 'env+db' : 'db',
        team_member_id: row.team_member_id || null,
        team_member: linkedTeam || null,
      });
    });

    const { data, error } = await supabase
      .from('contacts')
      .select('id,first_name,last_name,email,phone,type,company,status,last_activity')
      .order('last_activity', { ascending: false, nullsFirst: false })
      .limit(500);
    if (error) throw error;
    res.json({ users: [...byEmail.values()], contacts: data || [] });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Users load failed' });
  }
});

app.post('/api/staff-users/invite', requireSuperAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const name = String(req.body.name || '').trim();
    const split = splitName(name);
    const role = safeRole(req.body.role || 'staff');
    const teamMemberId = isUuid(req.body.team_member_id) ? req.body.team_member_id : null;
    const { data: org } = await supabase.from('organizations').select('id').eq('slug', 'constructed-matter').maybeSingle();
    const payload = {
      organization_id: org?.id || null,
      email,
      first_name: req.body.first_name || split.first_name,
      last_name: req.body.last_name || split.last_name,
      display_name: name || email,
      title: req.body.title || null,
      phone: req.body.phone || null,
      role_slug: role,
      status: 'invited',
      team_member_id: teamMemberId,
      invited_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('staff_users')
      .upsert(payload, { onConflict: 'email' })
      .select('id,email,display_name,title,role_slug,status,phone,team_member_id')
      .single();
    if (error) throw error;
    res.json({ ok: true, user: data, message: 'Access record created. Add this user to STAFF_USERS_JSON or Supabase Auth to enable login.' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Staff invite failed' });
  }
});

async function createUserInviteRecord(body, invitedByEmail) {
  if (!supabase) throw new Error('Supabase is not configured');
  const role = userRoleFromType(body.role || body.type || 'client');
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || '').trim();
  const name = String(body.name || body.display_name || '').trim();
  const split = splitName(name);
  const title = String(body.title || '').trim();
  const notify_email = Boolean(body.notify_email);
  const notify_sms = Boolean(body.notify_sms);
  let staffUser = null;
  let contact = null;

  if (role === 'staff' || role === 'super_admin') {
    if (!email) throw new Error('Email is required for staff and super admin users');
    const { data: org } = await supabase.from('organizations').select('id').eq('slug', 'constructed-matter').maybeSingle();
    const payload = {
      organization_id: org?.id || null,
      email,
      phone: phone || null,
      first_name: body.first_name || split.first_name,
      last_name: body.last_name || split.last_name,
      display_name: name || email,
      title: title || null,
      role_slug: role,
      status: 'invited',
      invited_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('staff_users')
      .upsert(payload, { onConflict: 'email' })
      .select('id,email,display_name,title,role_slug,status,phone')
      .single();
    if (error) throw error;
    staffUser = data;
  } else {
    if (!email && !phone) throw new Error('Email or phone is required');
    const payload = {
      first_name: body.first_name || split.first_name,
      last_name: body.last_name || split.last_name,
      email: email || null,
      phone: phone || null,
      type: contactTypeForRole(role),
      company: body.company || null,
      status: 'Invited',
      source: 'Dashboard User Invite',
      last_activity: new Date().toISOString(),
    };
    const { data, error } = email
      ? await supabase.from('contacts').upsert(payload, { onConflict: 'email' }).select().single()
      : await supabase.from('contacts').insert(payload).select().single();
    if (error) throw error;
    contact = data;
  }

  const notify = await notifyInvite({ email, phone, name, role, notify_email, notify_sms });
  if (staffUser?.id && (notify_email || notify_sms)) {
    await supabase.from('staff_users').update({
      invite_email_sent_at: notify.email_status === 'sent' ? new Date().toISOString() : null,
      invite_sms_sent_at: notify.sms_status === 'sent' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', staffUser.id);
  }
  const { data: invite } = await supabase.from('user_invites').insert({
    email: email || null,
    phone: phone || null,
    name: name || null,
    role_slug: role,
    contact_id: contact?.id || null,
    staff_user_id: staffUser?.id || null,
    notify_email,
    notify_sms,
    email_status: notify.email_status,
    sms_status: notify.sms_status,
    invited_by_email: invitedByEmail || null,
  }).select().single();

  return { role, staff_user: staffUser, contact, invite, notifications: notify };
}

app.post('/api/users/invite', requireSuperAdmin, async (req, res) => {
  try {
    const result = await createUserInviteRecord(req.body || {}, req.user.email);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ message: err.message || 'User invite failed' });
  }
});

app.put('/api/users/:entity/:id', requireSuperAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    const entity = String(req.params.entity || '').toLowerCase();
    const id = String(req.params.id || '');
    if (!isUuid(id)) return res.status(400).json({ message: 'Valid user id is required' });
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    const name = String(body.name || body.display_name || '').trim();
    const split = splitName(name);

    if (entity === 'staff') {
      if (!email) return res.status(400).json({ message: 'Email is required' });
      const role = safeRole(body.role || 'staff');
      if (!['staff', 'super_admin'].includes(role)) return res.status(400).json({ message: 'Staff users can only be Staff or Super Admin' });
      const payload = {
        email,
        phone: phone || null,
        first_name: body.first_name || split.first_name,
        last_name: body.last_name || split.last_name,
        display_name: name || email,
        title: body.title || null,
        role_slug: role,
        status: safeUserStatus(body.status, 'active'),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('staff_users')
        .update(payload)
        .eq('id', id)
        .select('id,email,display_name,title,role_slug,status,phone,team_member_id')
        .single();
      if (error) throw error;
      return res.json({ ok: true, user: data });
    }

    if (entity === 'contact') {
      if (!email && !phone) return res.status(400).json({ message: 'Email or phone is required' });
      const role = userRoleFromType(body.role || 'client');
      if (!['client', 'vendor', 'subcontractor'].includes(role)) return res.status(400).json({ message: 'Contact users must be Client, Vendor, or Subcontractor' });
      const payload = {
        first_name: body.first_name || split.first_name,
        last_name: body.last_name || split.last_name,
        email: email || null,
        phone: phone || null,
        company: body.company || null,
        type: contactTypeForRole(role),
        status: safeUserStatus(body.status, 'active'),
        last_activity: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('contacts')
        .update(payload)
        .eq('id', id)
        .select('id,first_name,last_name,email,phone,type,company,status,last_activity')
        .single();
      if (error) throw error;
      return res.json({ ok: true, contact: data });
    }

    res.status(400).json({ message: 'Unsupported user type' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'User update failed' });
  }
});

app.delete('/api/users/:entity/:id', requireSuperAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    const entity = String(req.params.entity || '').toLowerCase();
    const id = String(req.params.id || '');
    if (!isUuid(id)) return res.status(400).json({ message: 'Valid user id is required' });
    if (entity === 'staff') {
      const { data, error } = await supabase
        .from('staff_users')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id,email,status')
        .single();
      if (error) throw error;
      return res.json({ ok: true, user: data });
    }
    if (entity === 'contact') {
      const { data, error } = await supabase
        .from('contacts')
        .update({ status: 'archived', last_activity: new Date().toISOString() })
        .eq('id', id)
        .select('id,email,status')
        .single();
      if (error) throw error;
      return res.json({ ok: true, contact: data });
    }
    res.status(400).json({ message: 'Unsupported user type' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'User delete failed' });
  }
});

app.post('/api/users/:entity/:id/invite', requireSuperAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    const entity = String(req.params.entity || '').toLowerCase();
    const id = String(req.params.id || '');
    if (!isUuid(id)) return res.status(400).json({ message: 'Valid user id is required' });
    let email = '';
    let phone = '';
    let name = '';
    let role = 'client';
    let contactId = null;
    let staffUserId = null;

    if (entity === 'staff') {
      const { data, error } = await supabase
        .from('staff_users')
        .select('id,email,phone,display_name,role_slug')
        .eq('id', id)
        .single();
      if (error) throw error;
      staffUserId = data.id;
      email = data.email || '';
      phone = data.phone || '';
      name = data.display_name || email;
      role = safeRole(data.role_slug);
    } else if (entity === 'contact') {
      const { data, error } = await supabase
        .from('contacts')
        .select('id,first_name,last_name,email,phone,type,company')
        .eq('id', id)
        .single();
      if (error) throw error;
      contactId = data.id;
      email = data.email || '';
      phone = data.phone || '';
      name = [data.first_name, data.last_name].filter(Boolean).join(' ') || data.company || email || phone;
      role = roleFromContactType(data.type);
    } else {
      return res.status(400).json({ message: 'Unsupported user type' });
    }

    const body = req.body || {};
    const notify_email = body.notify_email !== false && Boolean(email);
    const notify_sms = Boolean(body.notify_sms) && Boolean(phone);
    const notifications = await notifyInvite({ email, phone, name, role, notify_email, notify_sms });
    if (staffUserId) {
      const staffInvitePatch = { updated_at: new Date().toISOString() };
      if (notifications.email_status === 'sent') staffInvitePatch.invite_email_sent_at = new Date().toISOString();
      if (notifications.sms_status === 'sent') staffInvitePatch.invite_sms_sent_at = new Date().toISOString();
      await supabase.from('staff_users').update(staffInvitePatch).eq('id', staffUserId);
    }
    await supabase.from('user_invites').insert({
      email: email || null,
      phone: phone || null,
      name: name || null,
      role_slug: role,
      contact_id: contactId,
      staff_user_id: staffUserId,
      notify_email,
      notify_sms,
      email_status: notifications.email_status,
      sms_status: notifications.sms_status,
      invited_by_email: req.user.email || null,
    });
    res.json({ ok: true, notifications });
  } catch (err) {
    res.status(500).json({ message: err.message || 'User invite failed' });
  }
});

app.post('/api/users/import', requireSuperAdmin, async (req, res) => {
  try {
    const rows = Array.isArray(req.body.users) ? req.body.users : parseCsvRows(req.body.csv || '');
    if (!rows.length) return res.status(400).json({ message: 'No users found to import' });
    const results = [];
    for (const row of rows.slice(0, 500)) {
      try {
        results.push({ ok: true, result: await createUserInviteRecord({
          role: row.role || row.type || row.user_type,
          name: row.name || row.full_name || row.display_name,
          first_name: row.first_name,
          last_name: row.last_name,
          title: row.title,
          company: row.company,
          email: row.email,
          phone: row.phone,
          notify_email: ['true','yes','1'].includes(String(row.notify_email || '').toLowerCase()),
          notify_sms: ['true','yes','1'].includes(String(row.notify_sms || '').toLowerCase()),
        }, req.user.email) });
      } catch (err) {
        results.push({ ok: false, email: row.email || '', message: err.message });
      }
    }
    res.json({ ok: true, imported: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results });
  } catch (err) {
    res.status(500).json({ message: err.message || 'User import failed' });
  }
});

app.get('/api/site-content', requireSuperAdmin, async (_req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    const { data, error } = await supabase.from('site_content_blocks').select('*').order('type').order('key');
    if (error) throw error;
    res.json({ blocks: data || [] });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Site content load failed' });
  }
});

app.get('/api/public/site-content', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    const page = String(req.query.page || '').trim();
    const { data, error } = await supabase
      .from('site_content_blocks')
      .select('*')
      .eq('enabled', true)
      .order('type')
      .order('key');
    if (error) throw error;
    const blocks = page
      ? (data || []).filter(block => (block.pages || []).includes('*') || (block.pages || []).includes(page))
      : (data || []);
    res.json({ blocks });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Site content load failed' });
  }
});

app.put('/api/site-content/:key', requireSuperAdmin, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    const key = String(req.params.key || '').trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '-');
    if (!key) return res.status(400).json({ message: 'Content key is required' });
    const type = ['hero','notification','cta'].includes(req.body.type) ? req.body.type : 'hero';
    const pages = Array.isArray(req.body.pages)
      ? req.body.pages
      : String(req.body.pages || '').split(',').map(v => v.trim()).filter(Boolean);
    const payload = {
      key,
      type,
      title: req.body.title || null,
      subtitle: req.body.subtitle || null,
      body: req.body.body || null,
      button_label: req.body.button_label || null,
      button_url: req.body.button_url || null,
      image_url: req.body.image_url || null,
      enabled: req.body.enabled !== false,
      pages,
      metadata: req.body.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : {},
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('site_content_blocks').upsert(payload, { onConflict: 'key' }).select().single();
    if (error) throw error;
    res.json({ ok: true, block: data });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Site content save failed' });
  }
});

app.get('/api/me/team-profile', requireStaff, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    const email = String(req.user.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ message: 'Session email is required' });

    const { data: staffRow } = await supabase
      .from('staff_users')
      .select('id,email,display_name,title,role_slug,status,team_member_id,team_members(*)')
      .eq('email', email)
      .maybeSingle();

    let teamProfile = Array.isArray(staffRow?.team_members) ? staffRow.team_members[0] : staffRow?.team_members;
    if (!teamProfile) {
      const { data: byEmail } = await supabase
        .from('team_members')
        .select('*')
        .ilike('email', email)
        .maybeSingle();
      teamProfile = byEmail || null;
    }

    res.json({ staff_user: staffRow || null, team_profile: teamProfile || null });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Profile load failed' });
  }
});

app.put('/api/me/team-profile', requireStaff, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    const email = String(req.user.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ message: 'Session email is required' });

    const { data: staffRow } = await supabase
      .from('staff_users')
      .select('id,email,team_member_id')
      .eq('email', email)
      .maybeSingle();

    let existingId = staffRow?.team_member_id || null;
    if (!existingId) {
      const { data: existingByEmail } = await supabase
        .from('team_members')
        .select('id')
        .ilike('email', email)
        .maybeSingle();
      existingId = existingByEmail?.id || null;
    }

    const row = teamRowFromProfilePayload(req.body, email);
    if (!existingId) row.slug = slugify(`${row.name}-${email.split('@')[0]}`);
    const saveQuery = existingId
      ? supabase.from('team_members').update(row).eq('id', existingId).select().single()
      : supabase.from('team_members').insert(row).select().single();
    const { data, error } = await saveQuery;
    if (error) throw error;

    if (staffRow?.id && data?.id && staffRow.team_member_id !== data.id) {
      await supabase
        .from('staff_users')
        .update({ team_member_id: data.id, updated_at: new Date().toISOString() })
        .eq('id', staffRow.id);
    }

    res.json({ ok: true, team_profile: data });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Profile save failed' });
  }
});

async function findOrCreateThread({ contact_id, client_project_id, channel = 'sms', subject }) {
  if (!supabase) return null;
  let query = supabase.from('message_threads').select('*').eq('channel', channel).limit(1);
  if (contact_id) query = query.eq('contact_id', contact_id);
  if (client_project_id) query = query.eq('client_project_id', client_project_id);
  const { data } = await query.maybeSingle();
  if (data) return data;
  return supabaseInsert('message_threads', { contact_id, client_project_id, channel, subject });
}

app.get('/api/messages', requireStaff, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    const channel = ['sms', 'email'].includes(req.query.channel) ? req.query.channel : 'sms';
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const { data, error } = await supabase
      .from('messages')
      .select('*, contacts(first_name,last_name,email,phone,type)')
      .eq('channel', channel)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json({ messages: data || [] });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Messages load failed' });
  }
});

app.get('/api/message-threads', requireStaff, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    const channel = ['sms', 'email'].includes(req.query.channel) ? req.query.channel : 'sms';
    const { data, error } = await supabase
      .from('message_threads')
      .select('*, contacts(first_name,last_name,email,phone,type)')
      .eq('channel', channel)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) throw error;
    res.json({ threads: data || [] });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Threads load failed' });
  }
});

app.post('/api/messages/send', requireStaff, async (req, res) => {
  try {
    const to = normalizePhone(req.body.to);
    const body = String(req.body.body || '').trim();
    if (!to || !body) return res.status(400).json({ message: 'Recipient and body are required' });
    if (!twilioClient) return res.status(503).json({ message: 'Twilio is not configured' });

    if (supabase) {
      const { data: optOut } = await supabase.from('sms_opt_outs').select('id').eq('phone', to).maybeSingle();
      if (optOut) return res.status(409).json({ message: 'Recipient has opted out of SMS' });
    }

    const messagePayload = {
      to,
      body,
      statusCallback: `${process.env.PUBLIC_SITE_URL || ''}/api/twilio/status-callback`,
    };
    if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
      messagePayload.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    } else {
      messagePayload.from = process.env.TWILIO_FROM_NUMBER;
    }

    const sent = await twilioClient.messages.create(messagePayload);
    const contact = await resolveMessageContact(req.body);
    const thread = await findOrCreateThread({
      contact_id: contact?.id || null,
      client_project_id: req.body.client_project_id || null,
      channel: 'sms',
    });
    const row = await supabaseInsert('messages', {
      thread_id: thread?.id || null,
      contact_id: contact?.id || null,
      direction: 'outbound',
      channel: 'sms',
      from_address: sent.from || process.env.TWILIO_FROM_NUMBER || null,
      to_address: to,
      body,
      status: sent.status || 'queued',
      provider_sid: sent.sid,
      sent_by: null,
      sent_at: new Date().toISOString(),
    });
    if (thread?.id && supabase) {
      await supabase.from('message_threads').update({ last_message_at: new Date().toISOString() }).eq('id', thread.id);
    }
    res.json({ ok: true, sid: sent.sid, status: sent.status, message: row });
  } catch (err) {
    res.status(500).json({ message: err.message || 'SMS send failed' });
  }
});

app.post('/api/messages/bulk', requireStaff, async (req, res) => {
  try {
    const campaign = await supabaseInsert('bulk_campaigns', {
      name: req.body.name || `Bulk SMS ${new Date().toISOString()}`,
      channel: 'sms',
      segment_query: req.body.segment || {},
      body: req.body.body || '',
      status: req.body.scheduled_at ? 'queued' : 'draft',
      scheduled_at: req.body.scheduled_at || null,
    });
    res.json({ ok: true, campaign });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Bulk campaign failed' });
  }
});

app.post('/api/email/send', requireStaff, async (req, res) => {
  try {
    const to = String(req.body.to || '').trim();
    const subject = String(req.body.subject || '').trim() || 'Constructed Matter';
    const body = String(req.body.body || '').trim();
    if (!to || !body) return res.status(400).json({ message: 'Recipient and body are required' });

    const sent = await sendMail({ to, subject, body });
    const contact = await resolveMessageContact(req.body);
    const thread = await findOrCreateThread({
      contact_id: contact?.id || null,
      client_project_id: req.body.client_project_id || null,
      channel: 'email',
      subject,
    });
    const row = await supabaseInsert('messages', {
      thread_id: thread?.id || null,
      contact_id: contact?.id || null,
      direction: 'outbound',
      channel: 'email',
      from_address: process.env.MAIL_FROM || process.env.SMTP_USER || null,
      to_address: to,
      body,
      status: sent?.skipped ? 'skipped' : 'sent',
      provider: 'smtp',
      provider_sid: sent?.messageId || null,
      sent_by: null,
      sent_at: new Date().toISOString(),
    });
    if (thread?.id && supabase) {
      await supabase.from('message_threads').update({ last_message_at: new Date().toISOString() }).eq('id', thread.id);
    }
    res.json({ ok: true, message: row, result: sent });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Email send failed' });
  }
});

app.post('/api/twilio/inbound', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const payload = req.body || {};
    const from = normalizePhone(payload.From);
    const body = String(payload.Body || '');
    await supabaseInsert('twilio_webhook_events', {
      event_type: 'inbound_sms',
      provider_sid: payload.MessageSid || null,
      payload,
      processed_at: new Date().toISOString(),
    });

    let contact = null;
    if (supabase && from) {
      const { data } = await supabase.from('contacts').select('*').eq('phone', from).maybeSingle();
      contact = data;
    }
    if (/^(stop|stopall|unsubscribe|cancel|end|quit)$/i.test(body.trim())) {
      await supabaseInsert('sms_opt_outs', { phone: from, contact_id: contact?.id || null, reason: body.trim() }).catch(() => null);
    }
    const thread = await findOrCreateThread({ contact_id: contact?.id || null, channel: 'sms' });
    await supabaseInsert('messages', {
      thread_id: thread?.id || null,
      contact_id: contact?.id || null,
      direction: 'inbound',
      channel: 'sms',
      from_address: from,
      to_address: payload.To || null,
      body,
      status: 'received',
      provider_sid: payload.MessageSid || null,
    });
    if (thread?.id && supabase) {
      await supabase.from('message_threads').update({ last_message_at: new Date().toISOString() }).eq('id', thread.id);
    }
    res.type('text/xml').send('<Response></Response>');
  } catch (err) {
    console.error('[twilio/inbound]', err);
    res.type('text/xml').status(200).send('<Response></Response>');
  }
});

app.post('/api/twilio/status-callback', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const payload = req.body || {};
    await supabaseInsert('twilio_webhook_events', {
      event_type: 'status_callback',
      provider_sid: payload.MessageSid || null,
      payload,
      processed_at: new Date().toISOString(),
    });
    if (supabase && payload.MessageSid) {
      await supabase
        .from('messages')
        .update({
          status: payload.MessageStatus || payload.SmsStatus || 'updated',
          delivered_at: ['delivered', 'read'].includes(payload.MessageStatus) ? new Date().toISOString() : null,
          error_message: payload.ErrorMessage || null,
        })
        .eq('provider_sid', payload.MessageSid);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Callback failed' });
  }
});

app.get('/api/client-projects/:slug', requireAuth, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    const { data: project, error } = await supabase
      .from('client_projects')
      .select('*, milestones:project_milestones(*), updates:project_updates(*, media:project_update_media(*))')
      .eq('slug', req.params.slug)
      .maybeSingle();
    if (error) throw error;
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.json({ project });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Project load failed' });
  }
});

app.get('/api/share/:token', async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    const { data: link, error } = await supabase
      .from('project_share_links')
      .select('*, project:client_projects(*, milestones:project_milestones(*), updates:project_updates(*, media:project_update_media(*)))')
      .eq('token', req.params.token)
      .maybeSingle();
    if (error) throw error;
    if (!link || link.revoked_at || (link.expires_at && new Date(link.expires_at) < new Date())) {
      return res.status(404).json({ message: 'This project link is unavailable.' });
    }
    await supabase.from('project_share_links').update({ scan_count: (link.scan_count || 0) + 1 }).eq('id', link.id);
    const project = link.project;
    project.updates = (project.updates || []).filter(u => ['client', 'public', 'vendor'].includes(u.visibility) && u.status === 'published');
    res.json({ project });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Share link failed' });
  }
});

app.post('/api/client-projects/:id/share-links', requireStaff, async (req, res) => {
  try {
    const link = await supabaseInsert('project_share_links', {
      client_project_id: req.params.id,
      label: req.body.label || null,
      access_level: req.body.access_level || 'client_read',
      expires_at: req.body.expires_at || null,
    });
    const targetUrl = `${process.env.PUBLIC_SITE_URL || ''}/client-project.html?token=${link.token}`;
    const qrDataUrl = await QRCode.toDataURL(targetUrl);
    const qr = await supabaseInsert('project_qr_codes', {
      share_link_id: link.id,
      qr_image_url: qrDataUrl,
      target_url: targetUrl,
      label: req.body.label || null,
    });
    res.json({ ok: true, link, qr, target_url: targetUrl });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Share link create failed' });
  }
});

app.post('/api/client-projects/:id/updates', requireStaff, async (req, res) => {
  try {
    const update = await supabaseInsert('project_updates', {
      client_project_id: req.params.id,
      title: req.body.title,
      body: req.body.body || null,
      visibility: req.body.visibility || 'client',
      status: req.body.status || 'draft',
      author_name: req.user.name || null,
      notify_sms: Boolean(req.body.notify_sms),
      notify_email: Boolean(req.body.notify_email),
      published_at: req.body.status === 'published' ? new Date().toISOString() : null,
    });
    res.json({ ok: true, update });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Update create failed' });
  }
});

function normalizeSchedulePayload(body = {}, user = {}) {
  const title = String(body.title || '').trim();
  if (!title) throw new Error('Schedule item title is required.');

  const startDate = body.start_date || body.start;
  const endDate = body.end_date || body.end || startDate;
  if (!startDate || !endDate) throw new Error('Start and end dates are required.');

  const progress = Math.max(0, Math.min(100, Number(body.progress) || 0));
  const status = ['pending', 'in_progress', 'delayed', 'blocked', 'complete'].includes(String(body.status || ''))
    ? String(body.status)
    : 'pending';
  const type = ['project', 'phase', 'task', 'milestone'].includes(String(body.type || ''))
    ? String(body.type)
    : 'task';

  return {
    board_id: body.board_id ? String(body.board_id) : null,
    fluent_task_id: body.fluent_task_id ? String(body.fluent_task_id) : null,
    project_id: isUuid(body.project_id) ? body.project_id : null,
    client_project_id: isUuid(body.client_project_id) ? body.client_project_id : null,
    type,
    project_title: body.project_title || body.project || null,
    title,
    phase: body.phase || null,
    assignee: body.assignee || null,
    client: body.client || null,
    participants: body.participants || null,
    dependencies: body.dependencies || null,
    start_date: startDate,
    end_date: endDate,
    status,
    progress,
    notify: Boolean(body.notify),
    description: body.description || null,
    forms: body.forms || null,
    punch: body.punch || null,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
    updated_by: user.email || null,
  };
}

app.get('/api/project-schedule-items', requireStaff, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    let query = supabase.from('project_schedule_items').select('*').order('start_date', { ascending: true });
    if (req.query.board_id) query = query.eq('board_id', String(req.query.board_id));
    if (req.query.project_id && isUuid(req.query.project_id)) query = query.eq('project_id', req.query.project_id);
    if (req.query.client_project_id && isUuid(req.query.client_project_id)) query = query.eq('client_project_id', req.query.client_project_id);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ items: data || [] });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Schedule items load failed' });
  }
});

app.post('/api/project-schedule-items', requireStaff, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    const payload = normalizeSchedulePayload(req.body, req.user);
    payload.created_by = req.user.email || null;
    const { data, error } = await supabase.from('project_schedule_items').insert(payload).select().single();
    if (error) throw error;
    res.json({ ok: true, item: data });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Schedule item create failed' });
  }
});

app.put('/api/project-schedule-items/:id', requireStaff, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    if (!isUuid(req.params.id)) return res.status(400).json({ message: 'Valid schedule item id is required.' });
    const payload = normalizeSchedulePayload(req.body, req.user);
    payload.updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('project_schedule_items')
      .update(payload)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ ok: true, item: data });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Schedule item update failed' });
  }
});

app.delete('/api/project-schedule-items/:id', requireStaff, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    if (!isUuid(req.params.id)) return res.status(400).json({ message: 'Valid schedule item id is required.' });
    const { error } = await supabase.from('project_schedule_items').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Schedule item delete failed' });
  }
});

app.post(['/api/bolt/runs', '/api/hermes/runs'], requireStaff, async (req, res) => {
  try {
    const runType = req.body.run_type || 'general';
    const input = req.body.input || {};
    const messages = Array.isArray(req.body.messages) && req.body.messages.length
      ? req.body.messages
      : [
          {
            role: 'system',
            content: [
              'You are Bolt Agent for Constructed Matter, Inc. also known as CMI.',
              'Help staff draft clear construction client updates, SMS replies, project summaries, and operational next steps.',
              'Do not claim a message was sent or an update was published. Drafts require staff approval.',
            ].join(' '),
          },
          {
            role: 'user',
            content: typeof input === 'string'
              ? input
              : JSON.stringify({ run_type: runType, ...input }, null, 2),
          },
        ];

    const run = await supabaseInsert('hermes_agent_runs', {
      run_type: runType,
      status: 'running',
      contact_id: req.body.contact_id || null,
      client_project_id: req.body.client_project_id || null,
      input: { ...input, messages },
    });

    let output = { message: 'Bolt Agent endpoint is not configured.' };
    if (boltAgent) {
      const completion = await boltAgent.chat.completions.create({
        model: 'hermes-agent',
        messages,
      });
      output = {
        content: completion.choices?.[0]?.message?.content || '',
        model: completion.model || 'hermes-agent',
        usage: completion.usage || null,
        raw: completion,
      };
    }
    if (supabase && run?.id) {
      await supabase.from('hermes_agent_runs').update({ status: 'needs_approval', output }).eq('id', run.id);
      await supabaseInsert('hermes_agent_messages', {
        run_id: run.id,
        role: 'assistant',
        content: output.content || output.message || '',
        metadata: { model: output.model || 'hermes-agent', usage: output.usage || null },
      }).catch(err => console.warn('[hermes/message]', err.message));
    }
    res.json({ ok: true, run_id: run?.id, output });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Bolt run failed' });
  }
});

app.post(['/api/bolt/runs/:id/approve', '/api/hermes/runs/:id/approve'], requireStaff, async (req, res) => {
  try {
    if (!supabase) return res.status(503).json({ message: 'Supabase is not configured' });
    const { data, error } = await supabase
      .from('hermes_agent_runs')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ ok: true, run: data });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Bolt approval failed' });
  }
});

app.use(express.static(__dirname, {
  extensions: ['html'],
  etag: true,
  maxAge: isProd ? '5m' : 0,
}));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ message: 'API route not found' });
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`CMI web listening on ${port}`);
});
