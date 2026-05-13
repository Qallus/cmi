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

const hermes = process.env.HERMES_AGENT_URL && process.env.HERMES_AGENT_API_KEY
  ? new OpenAI({
      baseURL: `${process.env.HERMES_AGENT_URL.replace(/\/$/, '')}/v1`,
      apiKey: process.env.HERMES_AGENT_API_KEY,
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
    if ((req.user.role || '').toLowerCase() !== 'staff') {
      return res.status(403).json({ message: 'Staff access required' });
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

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = staffUsers().find(u => String(u.email || '').toLowerCase() === email);
  if (!user || !password) return res.status(401).json({ message: 'Incorrect email or password.' });

  const stored = String(user.password_hash || user.password || '');
  const ok = user.password_hash
    ? await bcrypt.compare(password, stored)
    : password === stored;
  if (!ok) return res.status(401).json({ message: 'Incorrect email or password.' });

  const sessionUser = { email, name: user.name || email, role: user.role || 'staff' };
  const token = signSession(sessionUser);
  res.cookie(sessionCookie, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000,
  });
  res.json({ token, ...sessionUser });
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

app.post('/api/hermes/runs', requireStaff, async (req, res) => {
  try {
    const runType = req.body.run_type || 'general';
    const input = req.body.input || {};
    const messages = Array.isArray(req.body.messages) && req.body.messages.length
      ? req.body.messages
      : [
          {
            role: 'system',
            content: [
              'You are Hermes Agent for Constructed Matter, Inc.',
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

    let output = { message: 'Hermes Agent endpoint is not configured.' };
    if (hermes) {
      const completion = await hermes.chat.completions.create({
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
    res.status(500).json({ message: err.message || 'Hermes run failed' });
  }
});

app.post('/api/hermes/runs/:id/approve', requireStaff, async (req, res) => {
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
    res.status(500).json({ message: err.message || 'Hermes approval failed' });
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
