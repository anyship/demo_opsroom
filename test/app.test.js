import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import worker, { parseCookies, sessionToken } from '../src/worker.js';

function extractInlineScript(html) {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  return match ? match[1] : '';
}

test('inline script in served HTML is syntactically valid JavaScript', async () => {
  const r = await worker.fetch(new Request('https://x/'), {});
  const html = await r.text();
  const script = extractInlineScript(html);
  assert.ok(script.length > 0, 'page should contain an inline script');

  // vm.compileFunction throws SyntaxError if the JS is invalid
  assert.doesNotThrow(
    () => new vm.Script(script, { filename: 'inline-page-script.js' }),
    'inline script must be syntactically valid JavaScript (no SyntaxError)'
  );
});

test('login HTML does not use inline onclick with nested single quotes', async () => {
  const r = await worker.fetch(new Request('https://x/'), {});
  const html = await r.text();
  const script = extractInlineScript(html);

  // The login() function builds innerHTML with single-quoted JS strings.
  // Inline onclick attributes must NOT contain unescaped single quotes
  // that would terminate the enclosing JS string.
  const onclickWithSingleQuotes = /onclick=["'][^"']*'[^"']*["']/;
  assert.ok(
    !onclickWithSingleQuotes.test(script),
    'onclick attributes must not nest single quotes inside a single-quoted JS string'
  );
});

test('load() HTML does not use inline onclick with nested single quotes', async () => {
  const r = await worker.fetch(new Request('https://x/'), {});
  const html = await r.text();
  const script = extractInlineScript(html);

  // Specifically check for the pattern that causes the bug:
  // a single-quoted string containing onclick="...querySelector('...')..."
  const brokenPattern = /innerHTML='[^']*onclick="[^"]*'[^"]*'[^"]*"[^']*'/;
  assert.ok(
    !brokenPattern.test(script),
    'innerHTML assignments must not contain onclick handlers with nested single quotes'
  );
});

test('serves a responsive Google-authenticated app', async () => {
  const r = await worker.fetch(new Request('https://x/'), {});
  const html = await r.text();
  assert.match(html, /Sign in with Google/);
  assert.match(html, /viewport/);
});

test('creates secure session tokens and parses cookies', () => {
  assert.match(sessionToken(), /^[a-f0-9]{64}$/);
  assert.equal(parseCookies('session=hello%20team').session, 'hello team');
});

test('has a database-independent health endpoint', async () => {
  assert.deepEqual(
    await (await worker.fetch(new Request('https://x/api/health'), {})).json(),
    { ok: true }
  );
});
