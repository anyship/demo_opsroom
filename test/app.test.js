import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import worker, {
  ensureSeedItems,
  parseCookies,
  sessionToken,
} from "../src/worker.js";

function extractInlineScript(html) {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  return match ? match[1] : "";
}

test("inline script in served HTML is syntactically valid JavaScript", async () => {
  const r = await worker.fetch(new Request("https://x/"), {});
  const html = await r.text();
  const script = extractInlineScript(html);
  assert.ok(script.length > 0, "page should contain an inline script");
  assert.doesNotThrow(
    () => new vm.Script(script, { filename: "inline-page-script.js" }),
    "inline script must be syntactically valid JavaScript (no SyntaxError)",
  );
});

test("login HTML does not use inline onclick with nested single quotes", async () => {
  const r = await worker.fetch(new Request("https://x/"), {});
  const html = await r.text();
  const script = extractInlineScript(html);
  const onclickWithSingleQuotes = /onclick=["'][^"']*'[^"']*["']/;
  assert.ok(
    !onclickWithSingleQuotes.test(script),
    "onclick attributes must not nest single quotes inside a single-quoted JS string",
  );
});

test("load HTML does not use inline onclick with nested single quotes", async () => {
  const r = await worker.fetch(new Request("https://x/"), {});
  const html = await r.text();
  const script = extractInlineScript(html);
  const brokenPattern = /innerHTML='[^']*onclick="[^"]*'[^"]*'[^"]*"[^']*'/;
  assert.ok(
    !brokenPattern.test(script),
    "innerHTML assignments must not contain onclick handlers with nested single quotes",
  );
});

test("serves a non-empty landing page immediately", async () => {
  const r = await worker.fetch(new Request("https://x/"), {});
  const html = await r.text();
  assert.match(html, /Sign in with Google/);
  assert.match(html, /LIVE OPERATIONS/);
  assert.match(html, /viewport/);
});

test("seeds starter ops items for a new user", async () => {
  const rows = [];
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes("COUNT(*)")) {
                return { count: rows.filter((x) => x.user_id === args[0]).length };
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO items(")) {
                rows.push({
                  user_id: args[0],
                  title: args[1],
                  detail: args[2],
                  votes: args[3] ?? 0,
                });
              }
              return { success: true };
            },
          };
        },
      };
    },
  };
  const seeded = await ensureSeedItems(db, "u1");
  assert.equal(seeded, true);
  assert.equal(rows.length, 3);
  assert.match(rows[0].title, /checkout failures/i);
  const seededAgain = await ensureSeedItems(db, "u1");
  assert.equal(seededAgain, false);
  assert.equal(rows.length, 3);
});

test("creates secure session tokens and parses cookies", () => {
  assert.match(sessionToken(), /^[a-f0-9]{64}$/);
  assert.equal(parseCookies("session=hello%20team").session, "hello team");
});

test("has a database-independent health endpoint", async () => {
  assert.deepEqual(
    await (await worker.fetch(new Request("https://x/api/health"), {})).json(),
    { ok: true },
  );
});
