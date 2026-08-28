export const SEED_QUEUE = [
  { id: 's1', title: 'Redis cluster failover — us-east-1', status: 'firing', time: '14:02', owner: 'K. Patel' },
  { id: 's2', title: 'Deploy queue backed up (47 pending)', status: 'warning', time: '14:08', owner: 'CI bot' },
  { id: 's3', title: 'PagerDuty escalation — checkout-svc', status: 'firing', time: '13:55', owner: 'R. Chen' },
  { id: 's4', title: 'Certificate renewal due in 3 days', status: 'pending', time: '12:40', owner: 'platform' },
  { id: 's5', title: 'Memory pressure on worker-pool-7', status: 'acked', time: '13:30', owner: 'L. Okafor' },
  { id: 's6', title: 'Postgres replication lag 4.2s', status: 'warning', time: '14:11', owner: 'DBA team' },
  { id: 's7', title: 'Canary deploy — payments-v2.18.0', status: 'in-progress', time: '14:15', owner: 'S. Novak' },
  { id: 's8', title: 'Rate limiter tripped — partner API', status: 'acked', time: '13:47', owner: 'M. Torres' },
];

export const parseCookies = (v = '') =>
  Object.fromEntries(
    String(v || '').split(';').map(x => x.trim()).filter(Boolean).map(x => {
      const i = x.indexOf('=');
      return [x.slice(0, i), decodeURIComponent(x.slice(i + 1))];
    })
  );

export const sessionToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, '0')).join('');

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

async function initDB(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT, name TEXT, email TEXT)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS items(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, title TEXT, status TEXT DEFAULT 'open', created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
}

async function verify(token, env) {
  try {
    const [header, payload, sig] = token.split('.');
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(env.ANYSHIP_AUTH_SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const decode = x => Uint8Array.from(atob(x.replace(/-/g, '+').replace(/_/g, '/')), z => z.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, decode(sig), new TextEncoder().encode(header + '.' + payload));
    if (!valid) return null;
    const data = JSON.parse(new TextDecoder().decode(decode(payload)));
    return data.exp > Date.now() / 1000 ? data : null;
  } catch { return null; }
}

function statusBadge(status) {
  const colors = {
    'firing': '#ef4444', 'warning': '#f59e0b', 'pending': '#6b7280',
    'acked': '#22c55e', 'in-progress': '#3b82f6', 'open': '#6b7280', 'resolved': '#22c55e'
  };
  const color = colors[status] || '#6b7280';
  return `<span class="badge" style="--badge-color:${color}">${esc(status)}</span>`;
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderQueue(items) {
  return items.map(item => `<tr class="queue-row">
<td class="col-time">${esc(item.time)}</td>
<td class="col-status">${statusBadge(item.status)}</td>
<td class="col-title">${esc(item.title)}</td>
<td class="col-owner">${esc(item.owner || '')}</td>
</tr>`).join('');
}

function page(session) {
  const userItems = [];
  const userSection = session ? `
<section class="user-section">
  <div class="user-bar">
    <span class="user-name">${esc(session.name)}</span>
    <a href="/logout" class="signout-link">sign out</a>
  </div>
  <form id="add-form" class="add-form">
    <input name="title" required placeholder="Add incident or task..." maxlength="80" class="add-input" autocomplete="off">
    <select name="status" class="add-select">
      <option value="open">open</option>
      <option value="firing">firing</option>
      <option value="warning">warning</option>
      <option value="in-progress">in-progress</option>
    </select>
    <button type="submit" class="add-btn">+</button>
  </form>
  <div id="user-items"></div>
</section>` : '';

  const signinBtn = !session
    ? `<a href="/login" class="signin-btn">Sign in with Google</a>`
    : '';

  return `<!doctype html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Opsroom</title>
<style>${CSS}</style>
</head><body>
<div class="shell">
  <header class="topbar">
    <div class="topbar-left">
      <span class="logo">&#9673; opsroom</span>
      <span class="live-dot"></span>
      <span class="topbar-label">live</span>
    </div>
    <div class="topbar-right">
      ${signinBtn}
    </div>
  </header>
  <main class="queue-wrap">
    <table class="queue-table">
      <thead>
        <tr>
          <th class="col-time">time</th>
          <th class="col-status">status</th>
          <th class="col-title">item</th>
          <th class="col-owner">owner</th>
        </tr>
      </thead>
      <tbody id="queue-body">
        ${renderQueue(SEED_QUEUE)}
      </tbody>
    </table>
    ${userSection}
  </main>
</div>
${session ? `<script>${CLIENT}</script>` : ''}
</body></html>`;
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0f1117;color:#c8cdd3;font:13px/1.5 'SF Mono',SFMono-Regular,ui-monospace,'DejaVu Sans Mono',Menlo,Consolas,monospace;min-height:100vh}
.shell{max-width:960px;margin:0 auto;padding:0 16px}
.topbar{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid #1e2330}
.topbar-left{display:flex;align-items:center;gap:10px}
.logo{color:#e2e5ea;font-weight:700;font-size:15px;letter-spacing:-.02em}
.live-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.topbar-label{font-size:11px;color:#22c55e;text-transform:uppercase;letter-spacing:.05em}
.topbar-right{display:flex;align-items:center;gap:12px}
.signin-btn{color:#93979e;font-size:12px;text-decoration:none;padding:5px 10px;border:1px solid #2a2f3a;border-radius:4px;transition:border-color .15s}
.signin-btn:hover{border-color:#4a5060;color:#e2e5ea}
.queue-wrap{padding:20px 0}
.queue-table{width:100%;border-collapse:collapse;table-layout:fixed}
.queue-table th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#5c6370;padding:6px 8px;border-bottom:1px solid #1e2330;font-weight:500}
.queue-table td{padding:10px 8px;border-bottom:1px solid #1a1e28;vertical-align:top}
.queue-row:hover{background:#151820}
.col-time{width:60px;color:#5c6370;font-size:12px}
.col-status{width:100px}
.col-title{color:#e2e5ea}
.col-owner{width:100px;color:#5c6370;font-size:12px;text-align:right}
.badge{display:inline-block;font-size:11px;padding:2px 7px;border-radius:3px;background:color-mix(in srgb,var(--badge-color) 15%,transparent);color:var(--badge-color);font-weight:500;letter-spacing:.01em}
.user-section{margin-top:28px;padding-top:20px;border-top:1px solid #1e2330}
.user-bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.user-name{color:#e2e5ea;font-weight:600;font-size:12px}
.signout-link{color:#5c6370;font-size:11px;text-decoration:none}
.signout-link:hover{color:#e2e5ea}
.add-form{display:flex;gap:8px;margin-bottom:16px}
.add-input{flex:1;background:#1a1e28;border:1px solid #2a2f3a;border-radius:4px;padding:8px 10px;color:#e2e5ea;font:inherit;font-size:12px}
.add-input:focus{outline:none;border-color:#3b82f6}
.add-select{background:#1a1e28;border:1px solid #2a2f3a;border-radius:4px;padding:8px;color:#c8cdd3;font:inherit;font-size:12px}
.add-btn{background:#22c55e;color:#0f1117;border:none;border-radius:4px;padding:8px 14px;font-weight:700;cursor:pointer;font-size:14px}
.add-btn:hover{background:#16a34a}
#user-items .queue-row td{border-bottom-color:#1a1e28}
@media(max-width:640px){.col-owner{display:none}.queue-table th:last-child{display:none}.shell{padding:0 10px}.add-form{flex-wrap:wrap}.add-input{min-width:100%}}
`;

const CLIENT = `
(function(){
  const form=document.getElementById('add-form');
  const container=document.getElementById('user-items');
  if(!form)return;

  async function loadUserItems(){
    const r=await fetch('/api/me');
    if(r.status===401)return;
    const d=await r.json();
    if(!d.items||!d.items.length){container.innerHTML='<p style="color:#5c6370;font-size:12px;padding:8px 0">No items yet. Add one above.</p>';return}
    const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const colors={'firing':'#ef4444','warning':'#f59e0b','open':'#6b7280','in-progress':'#3b82f6','resolved':'#22c55e','acked':'#22c55e','pending':'#6b7280'};
    container.innerHTML='<table class="queue-table"><tbody>'+d.items.map(function(x){
      const c=colors[x.status]||'#6b7280';
      const ts=x.created_at?x.created_at.slice(11,16):'--:--';
      return '<tr class="queue-row"><td class="col-time">'+esc(ts)+'</td><td class="col-status"><span class="badge" style="--badge-color:'+c+'">'+esc(x.status)+'</span></td><td class="col-title">'+esc(x.title)+'</td><td class="col-owner"><button class="ack-btn" data-id="'+x.id+'">ack</button></td></tr>';
    }).join('')+'</tbody></table>';
    container.querySelectorAll('.ack-btn').forEach(function(btn){
      btn.addEventListener('click',async function(){
        await fetch('/api/items/'+btn.dataset.id,{method:'PATCH'});
        loadUserItems();
      });
    });
  }

  form.addEventListener('submit',async function(e){
    e.preventDefault();
    const fd=new FormData(form);
    await fetch('/api/items',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:fd.get('title'),status:fd.get('status')})});
    form.reset();
    loadUserItems();
  });

  loadUserItems();
})();
`;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === '/api/health') return json({ ok: true });

    if (url.pathname === '/login') {
      const authUrl = new URL(String(env.ANYSHIP_AUTH_URL).replace(/\/$/, '') + '/broker/authorize');
      authUrl.searchParams.set('app', env.ANYSHIP_AUTH_APP_ID);
      authUrl.searchParams.set('provider', 'google');
      authUrl.searchParams.set('redirect_uri', url.origin + '/auth/callback');
      return Response.redirect(authUrl.toString(), 302);
    }

    if (url.pathname === '/auth/callback') {
      const claims = await verify(url.searchParams.get('anyship_token') || '', env);
      if (!claims) return new Response('Sign-in failed', { status: 401 });
      await initDB(env.DB);
      const token = sessionToken();
      await env.DB.prepare('INSERT INTO sessions VALUES(?,?,?,?)')
        .bind(token, claims.sub, claims.name || 'Operator', claims.email || '').run();
      return new Response(null, {
        status: 302,
        headers: { location: '/', 'set-cookie': `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/` }
      });
    }

    if (url.pathname === '/logout') {
      return new Response(null, {
        status: 302,
        headers: { location: '/', 'set-cookie': 'session=; Max-Age=0; Path=/' }
      });
    }

    if (url.pathname === '/') {
      let session = null;
      const cookie = parseCookies(req.headers.get('cookie')).session;
      if (cookie && env.DB) {
        try {
          await initDB(env.DB);
          session = await env.DB.prepare('SELECT * FROM sessions WHERE token=?').bind(cookie).first();
        } catch { /* no DB in tests */ }
      }
      return new Response(page(session), { headers: { 'content-type': 'text/html;charset=utf-8' } });
    }

    // Protected routes below require DB + session
    if (!env.DB) return json({ error: 'not found' }, 404);
    await initDB(env.DB);
    const token = parseCookies(req.headers.get('cookie')).session;
    const session = token && await env.DB.prepare('SELECT * FROM sessions WHERE token=?').bind(token).first();
    if (!session) return json({ error: 'unauthorized' }, 401);

    if (url.pathname === '/api/me') {
      const items = (await env.DB.prepare('SELECT * FROM items WHERE user_id=? ORDER BY id DESC').bind(session.user_id).all()).results;
      return json({ user: { name: session.name, email: session.email }, items });
    }

    if (url.pathname === '/api/items' && req.method === 'POST') {
      const body = await req.json();
      const title = String(body.title || '').slice(0, 80);
      const status = String(body.status || 'open').slice(0, 20);
      if (!title) return json({ error: 'title required' }, 400);
      await env.DB.prepare('INSERT INTO items(user_id, title, status) VALUES(?,?,?)')
        .bind(session.user_id, title, status).run();
      return json({ ok: true }, 201);
    }

    if (url.pathname.startsWith('/api/items/') && req.method === 'PATCH') {
      const id = +url.pathname.split('/').pop();
      await env.DB.prepare("UPDATE items SET status='acked' WHERE id=? AND user_id=?")
        .bind(id, session.user_id).run();
      return json({ ok: true });
    }

    return json({ error: 'not found' }, 404);
  }
};
