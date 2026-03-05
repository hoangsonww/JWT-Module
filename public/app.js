'use strict';

const BASE = 'http://localhost:5001';
let accessToken = null;
let refreshToken = null;

// ── theme ─────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const moon = document.getElementById('icon-moon');
  const sun  = document.getElementById('icon-sun');
  if (theme === 'light') {
    moon.style.display = 'none';
    sun.style.display  = 'block';
  } else {
    moon.style.display = 'block';
    sun.style.display  = 'none';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('jwt-tester-theme', next);
  applyTheme(next);
}

// ── resize handle ─────────────────────────────────────────────────────────────
function initResize() {
  const handle = document.getElementById('resize-handle');
  const panel  = document.getElementById('panel');
  const main   = document.getElementById('main');
  let dragging = false;
  let startX   = 0;
  let startW   = 0;

  handle.addEventListener('mousedown', (e) => {
    dragging = true;
    startX   = e.clientX;
    startW   = panel.getBoundingClientRect().width;
    handle.classList.add('dragging');
    document.body.style.cursor    = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const delta    = e.clientX - startX;
    const mainW    = main.getBoundingClientRect().width;
    const minW     = 220;
    const maxW     = mainW - 220 - 5; // 5px for handle
    const newW     = Math.min(maxW, Math.max(minW, startW + delta));
    panel.style.width = newW + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.body.style.cursor     = '';
    document.body.style.userSelect = '';
  });
}

// ── section collapse ──────────────────────────────────────────────────────────
function toggle(header) {
  const body  = header.nextElementSibling;
  const arrow = header.querySelector('span');
  body.classList.toggle('collapsed');
  arrow.textContent = body.classList.contains('collapsed') ? '▸' : '▾';
}

// ── token state ───────────────────────────────────────────────────────────────
function setTokens(tokens) {
  if (tokens.accessToken) {
    accessToken = tokens.accessToken;
    const el = document.getElementById('access-display');
    el.textContent = '…' + accessToken.slice(-20);
    el.classList.remove('empty');
  }
  if (tokens.refreshToken) {
    refreshToken = tokens.refreshToken;
    const el = document.getElementById('refresh-display');
    el.textContent = '…' + refreshToken.slice(-20);
    el.classList.remove('empty');
  }
}

function clearTokens() {
  accessToken  = null;
  refreshToken = null;
  const ad = document.getElementById('access-display');
  const rd = document.getElementById('refresh-display');
  ad.textContent = 'none'; ad.classList.add('empty');
  rd.textContent = 'none'; rd.classList.add('empty');
  document.getElementById('me-info').classList.remove('visible');
}

function copyToken(type) {
  const t = type === 'access' ? accessToken : refreshToken;
  if (t) navigator.clipboard.writeText(t);
}

// ── log ───────────────────────────────────────────────────────────────────────
function clearLog() {
  const log = document.getElementById('log');
  log.textContent = '';
  const empty = document.createElement('div');
  empty.id = 'empty-log';
  empty.textContent = 'Make a request to see the response here.';
  log.appendChild(empty);
}

function logRequest(method, path, status, body) {
  const emptyEl = document.getElementById('empty-log');
  if (emptyEl) emptyEl.remove();

  const log   = document.getElementById('log');
  const entry = document.createElement('div');
  entry.className = 'log-entry';

  const headerRow = document.createElement('div');
  headerRow.className = 'log-entry-header';

  const methodBadge = document.createElement('span');
  methodBadge.className = 'method-badge';
  methodBadge.textContent = method;
  methodBadge.style.background = method === 'GET' ? '#0369a1' : '#6c63ff';

  const pathSpan = document.createElement('span');
  pathSpan.className = 'log-path';
  pathSpan.textContent = path;

  const statusBadge = document.createElement('span');
  statusBadge.className = 'status-badge';
  statusBadge.textContent = String(status);
  const isOk  = status >= 200 && status < 300;
  const isErr = status >= 400;
  statusBadge.style.cssText = isOk
    ? 'background:#14532d;color:#22c55e'
    : isErr
    ? 'background:#450a0a;color:#ef4444'
    : 'background:#451a03;color:#f59e0b';

  const timeSpan = document.createElement('span');
  timeSpan.className = 'log-time';
  timeSpan.textContent = new Date().toLocaleTimeString();

  headerRow.append(methodBadge, pathSpan, statusBadge, timeSpan);

  const bodyEl = document.createElement('pre');
  bodyEl.className = 'log-body';
  bodyEl.textContent = JSON.stringify(body, null, 2);

  entry.append(headerRow, bodyEl);
  log.prepend(entry);
}

// ── fetch wrapper ─────────────────────────────────────────────────────────────
async function req(method, path, body, auth) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch(BASE + path, opts);
  const json = await res.json().catch(() => ({}));
  logRequest(method, path, res.status, json);
  return { status: res.status, json };
}

// ── actions ───────────────────────────────────────────────────────────────────
async function doRegister() {
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-pass').value;
  const { status, json } = await req('POST', '/auth/register', { email, password });
  if (status === 201 && json.tokens) setTokens(json.tokens);
}

async function doLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-pass').value;
  const { status, json } = await req('POST', '/auth/login', { email, password });
  if (status === 200 && json.tokens) setTokens(json.tokens);
}

async function doMe() {
  const { status, json } = await req('GET', '/auth/me', null, true);
  const mi = document.getElementById('me-info');
  if (status === 200) {
    mi.textContent = '';
    const emailEl = document.createElement('strong');
    emailEl.textContent = json.email;
    const idEl = document.createElement('div');
    idEl.textContent = 'ID: ' + json.id;
    idEl.style.cssText = 'color:var(--muted);margin-top:4px;font-size:11px';
    const createdEl = document.createElement('div');
    createdEl.textContent = 'Created: ' + new Date(json.createdAt).toLocaleString();
    createdEl.style.cssText = 'color:var(--muted);margin-top:2px;font-size:11px';
    mi.append(emailEl, idEl, createdEl);
    mi.classList.add('visible');
  } else {
    mi.classList.remove('visible');
  }
}

async function doRefresh() {
  if (!refreshToken) { alert('No refresh token — log in first.'); return; }
  const { status, json } = await req('POST', '/auth/refresh', { refreshToken });
  if (status === 200 && json.tokens) setTokens(json.tokens);
}

async function doLogout() {
  if (!refreshToken) { alert('No refresh token — log in first.'); return; }
  const rt = refreshToken;
  const { status } = await req('POST', '/auth/logout', { refreshToken: rt });
  if (status === 200) clearTokens();
}

async function doChangePassword() {
  const currentPassword = document.getElementById('cp-current').value;
  const newPassword     = document.getElementById('cp-new').value;
  await req('POST', '/auth/change-password', { currentPassword, newPassword }, true);
}

async function doHealth() {
  await req('GET', '/health');
}

// ── health poll ───────────────────────────────────────────────────────────────
async function checkHealth() {
  const dot = document.getElementById('health-dot');
  const txt = document.getElementById('health-text');
  try {
    const res = await fetch(BASE + '/health');
    if (res.ok) { dot.className = 'ok'; txt.textContent = 'online'; }
    else         { dot.className = 'err'; txt.textContent = 'error'; }
  } catch {
    dot.className = 'err'; txt.textContent = 'offline';
  }
}

// ── init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // restore saved theme
  const saved = localStorage.getItem('jwt-tester-theme') || 'dark';
  applyTheme(saved);

  // resize
  initResize();

  // theme toggle
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // section toggles
  document.querySelectorAll('.section-header').forEach(h => {
    h.addEventListener('click', () => toggle(h));
  });

  // action buttons
  document.getElementById('btn-register').addEventListener('click', doRegister);
  document.getElementById('btn-login').addEventListener('click', doLogin);
  document.getElementById('btn-me').addEventListener('click', doMe);
  document.getElementById('btn-refresh').addEventListener('click', doRefresh);
  document.getElementById('btn-logout').addEventListener('click', doLogout);
  document.getElementById('btn-change-password').addEventListener('click', doChangePassword);
  document.getElementById('btn-health').addEventListener('click', doHealth);
  document.getElementById('btn-copy-access').addEventListener('click', () => copyToken('access'));
  document.getElementById('btn-copy-refresh').addEventListener('click', () => copyToken('refresh'));
  document.getElementById('btn-clear-log').addEventListener('click', clearLog);

  // enter key submits the section's primary button
  document.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const btn = inp.closest('.section-body').querySelector('button:last-child');
        if (btn) btn.click();
      }
    });
  });

  checkHealth();
  setInterval(checkHealth, 10000);
});
