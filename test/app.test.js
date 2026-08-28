import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import worker, { parseCookies, sessionToken, SEED_QUEUE } from '../src/worker.js';

function extractInlineScript(html) {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  return match ? match[1] : '';
}

test('unauthenticated GET / HTML contains seeded queue content', async () => {
  const r = await worker.fetch(new Request('https://x/'), {});
  const html = await r.text();

  for (const item of SEED_QUEUE) {
    assert.match(html, new RegExp(item.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `seeded item "${item.title}" must appear in first-paint HTML`);
  }
});

test('unauthenticated GET / HTML contains a sign-in affordance that is not the only content', async () => {
  const r = await worker.fetch(new Request('https://x/'), {});
  const html = await r.text();

  assert.match(html, /sign.?in|log.?in|google/i,
    'page must have a sign-in affordance');

  const textWithoutSignin = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/sign.?in|log.?in|google/gi, '')
    .trim();
  assert.ok(textWithoutSignin.length > 200,
    'page must have substantial content beyond the sign-in button');
});

test('inline script in served HTML is syntactically valid JavaScript', async () => {
  const r = await worker.fetch(new Request('https://x/'), {});
  const html = await r.text();
  const script = extractInlineScript(html);

  if (script.length > 0) {
    assert.doesNotThrow(
      () => new vm.Script(script, { filename: 'inline-page-script.js' }),
      'inline script must be syntactically valid JavaScript (no SyntaxError)'
    );
  }
});

test('/api/health returns ok without DB', async () => {
  const r = await worker.fetch(new Request('https://x/api/health'), {});
  assert.deepEqual(await r.json(), { ok: true });
});

test('/login redirects to the auth broker', async () => {
  const env = {
    ANYSHIP_AUTH_URL: 'https://auth.example.com',
    ANYSHIP_AUTH_APP_ID: 'test-app-123'
  };
  const r = await worker.fetch(new Request('https://x/login'), env);
  assert.equal(r.status, 302);
  const loc = r.headers.get('location');
  assert.match(loc, /auth\.example\.com\/broker\/authorize/);
  assert.match(loc, /provider=google/);
  assert.match(loc, /redirect_uri/);
});

test('no inline onclick with nested single quotes (login view)', async () => {
  const r = await worker.fetch(new Request('https://x/'), {});
  const html = await r.text();
  const script = extractInlineScript(html);

  const onclickWithSingleQuotes = /onclick=["'][^"']*'[^"']*["']/;
  assert.ok(
    !onclickWithSingleQuotes.test(script),
    'onclick attributes must not nest single quotes inside a single-quoted JS string'
  );
});

test('no innerHTML with nested onclick quote bugs', async () => {
  const r = await worker.fetch(new Request('https://x/'), {});
  const html = await r.text();
  const script = extractInlineScript(html);

  const brokenPattern = /innerHTML='[^']*onclick="[^"]*'[^"]*'[^"]*"[^']*'/;
  assert.ok(
    !brokenPattern.test(script),
    'innerHTML assignments must not contain onclick handlers with nested single quotes'
  );
});

test('creates secure session tokens and parses cookies', () => {
  assert.match(sessionToken(), /^[a-f0-9]{64}$/);
  assert.equal(parseCookies('session=hello%20team').session, 'hello team');
});

test('seeded queue has 6-10 items with required fields', () => {
  assert.ok(SEED_QUEUE.length >= 6, 'at least 6 seeded items');
  assert.ok(SEED_QUEUE.length <= 10, 'at most 10 seeded items');

  for (const item of SEED_QUEUE) {
    assert.ok(item.title, 'each item needs a title');
    assert.ok(item.status, 'each item needs a status');
    assert.ok(item.time, 'each item needs a timestamp');
  }
});

test('HTML includes status indicators for queue items', async () => {
  const r = await worker.fetch(new Request('https://x/'), {});
  const html = await r.text();

  const statuses = [...new Set(SEED_QUEUE.map(i => i.status))];
  let found = 0;
  for (const s of statuses) {
    if (html.includes(s)) found++;
  }
  assert.ok(found >= 2, 'at least 2 different statuses should appear in HTML');
});

test('HTML does not contain fake metrics', async () => {
  const r = await worker.fetch(new Request('https://x/'), {});
  const html = await r.text();

  assert.ok(!html.includes('94%'), 'no fake 94% metric');
  assert.ok(!html.includes('Team pulse'), 'no fake Team pulse');

  const contentOnly = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ');
  assert.ok(!/\d+%/.test(contentOnly),
    'no percentage metrics in visible content');
});

test('viewport meta tag is present', async () => {
  const r = await worker.fetch(new Request('https://x/'), {});
  const html = await r.text();
  assert.match(html, /viewport/);
});
