# Opsroom

A calm, focused command center for the numbers, queues and people that keep your business running.

## What this demo shows

Opsroom is the "single-file edge app" example for Anyship. It is intentionally compact so someone can inspect the whole application in one pass and see how little ceremony is required to deploy a useful internal tool.

## Stack

- Runtime: Cloudflare Workers
- Language: vanilla JavaScript ES modules
- UI delivery: server-rendered HTML returned directly from the Worker
- Frontend: inline CSS and inline client-side JavaScript
- Auth: Anyship managed Google sign-in
- Data: Cloudflare D1 via the `DB` binding declared in `wrangler.toml`
- Tests: Node's built-in test runner

## Why this stack is useful

This demo is the fastest path from idea to deployment:

- one Worker entrypoint
- no build step
- no framework dependencies
- one deployable directory

It is a good fit for:

- internal tools
- ops dashboards
- prototypes
- small authenticated utilities

## Project layout

- `src/worker.js`: Worker, HTML renderer, client behavior, auth callback handling, and D1 CRUD
- `test/app.test.js`: smoke tests for the landing page, cookie helpers, and health endpoint
- `wrangler.toml`: runtime entrypoint plus the D1 binding Anyship provisions at deploy time

## Anyship-specific behavior

You do not need to manually provision Google OAuth or a D1 database for this demo:

- Anyship injects `ANYSHIP_AUTH_URL`, `ANYSHIP_AUTH_APP_ID`, and `ANYSHIP_AUTH_SECRET`
- Anyship creates and wires the D1 database bound as `DB`
- the `database_id` in `wrangler.toml` is a placeholder and is replaced at deploy time

## Local notes

The demo expects platform-provided bindings at runtime. The test suite only covers paths that do not require a live auth broker or D1 instance.
