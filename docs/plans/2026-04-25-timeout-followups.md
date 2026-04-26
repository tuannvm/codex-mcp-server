# Timeout Follow-Ups Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Status:** Completed on 2026-04-25

**Outcome:**
- Added validated `timeoutMs` to the `codex` tool schema.
- Added per-call timeout override behavior on top of `CODEX_TOOL_TIMEOUT_MS`.
- Exposed `timeoutMs` in the MCP tool definition and public docs.
- Verified repo-wide with lint, format, build, full Jest suite, and a Claude stub probe.

**Goal:** Add safer timeout controls for long Codex tasks without regressing the fixed queue and child-abort behavior.

**Architecture:** Keep the existing queue and abort model intact. Add the smallest possible caller-controlled timeout override on the `codex` tool, validate it in the schema layer, and cover it with focused lifecycle tests plus one docs sweep for drifted defaults.

**Tech Stack:** TypeScript, Jest, ts-jest, MCP SDK, Node child processes

---

### Task 1: Add a validated per-call timeout argument

**Files:**
- Modify: `src/types.ts`
- Modify: `src/tools/handlers.ts`
- Test: `src/__tests__/runtime-config.test.ts`

**Step 1: Write the failing test**

Add a schema-level test that accepts a positive `timeoutMs` and rejects `0`,
negative values, and non-integers.

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --runInBand src/__tests__/runtime-config.test.ts --runTestsByPath
```

Expected: FAIL because `timeoutMs` is not part of the codex schema yet.

**Step 3: Write minimal implementation**

- add optional `timeoutMs` to `CodexToolSchema`
- thread it into the server/tool execution path without changing current
  defaults

**Step 4: Run test to verify it passes**

Run the same focused test command and confirm PASS.

### Task 2: Prove override behavior in lifecycle tests

**Files:**
- Modify: `src/__tests__/mcp-lifecycle.test.ts`
- Modify: `src/server.ts`

**Step 1: Write the failing test**

Add a focused lifecycle test where the default timeout is high, but a single
`tools/call` request passes a low `timeoutMs` override and must time out without
blocking the next request.

**Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --runInBand src/__tests__/mcp-lifecycle.test.ts -t "uses per-call timeout override" --runTestsByPath
```

Expected: FAIL because the override is ignored.

**Step 3: Write minimal implementation**

- prefer request `timeoutMs` over `CODEX_TOOL_TIMEOUT_MS`
- keep the existing abort-and-wait queue semantics unchanged

**Step 4: Run test to verify it passes**

Run the same focused test command and confirm PASS.

### Task 3: Sweep docs for timeout and default-model drift

**Files:**
- Modify: `README.md`
- Modify: `docs/codex-cli-integration.md`
- Modify: `docs/session-management.md`

**Step 1: Write the failing check**

Search for stale default model or timeout documentation:

```bash
rg -n "gpt-5\\.2-codex|120000|timeoutMs" README.md docs
```

**Step 2: Verify drift exists**

Expected: at least one stale `gpt-5.2-codex` reference and no mention of
per-call timeout override.

**Step 3: Write minimal documentation updates**

- align docs with the current default model
- document `CODEX_TOOL_TIMEOUT_MS`
- document the per-call timeout override once implemented

**Step 4: Verify docs**

Run the same `rg` command and confirm stale references are gone or explicitly
intentional.

### Task 4: Final verification

**Files:**
- Test: `src/__tests__/runtime-config.test.ts`
- Test: `src/__tests__/mcp-lifecycle.test.ts`
- Verify: repo-wide

**Step 1: Run focused tests**

```bash
npm test -- --runInBand src/__tests__/runtime-config.test.ts src/__tests__/mcp-lifecycle.test.ts --runTestsByPath
```

**Step 2: Run build**

```bash
npm run build
```

**Step 3: Run full suite**

```bash
npm test -- --runInBand
```

**Step 4: Commit**

Commit only after all verification is green.
