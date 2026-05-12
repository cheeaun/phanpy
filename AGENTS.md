# Bluepy Agent Runbook

## Deployment Source Of Truth

Production deploys from `fork/bluesky`, not feature branches. Use `/tmp/bluepy-bluesky-deploy` or another clean worktree for deploy-target work. Do not assume Cloudflare Pages; this project deploys on Cloudflare Workers with static assets.

## Before Committing

Always run `git status -sb` and `git diff --name-status` before staging. Never commit generated images unless explicitly requested in the current turn. Keep generated locale catalogs in separate commits.

## Lint Rules

Do not turn off lint rules without explicit permission in the current turn. If a rule blocks useful work, report the rule name, the concrete violation, and the smallest compliant change or ask for permission to change the rule.

## Package Manager

Use Bun for installs and scripts: `bun install`, `bun run ...`, and `bunx ...`. Runtime remains browser/Cloudflare Workers, not Bun.

## Long-Running Work

Make small commits by concern. Push deploy-relevant commits to `fork/bluesky`. Report any remaining dirty files explicitly.

## TypeScript Migration OODA Loop

When running a long TypeScript migration goal, work in reviewable batches. Prefer 3-8 tiny independent leaf files, one leaf utility cluster, one boundary module, or one cohesive import chain per batch. Aim for under 300 changed lines; split at 500. Prefer extensionless import-safe `.js -> .ts` and `.jsx -> .tsx` conversions first, because they avoid import churn.

For each batch:

1. Orient: inspect callers, runtime behavior, existing tests, and current JS assumptions. Keep a candidate queue by inspecting a set of small JS/JSX leaves once, then convert the next safe batch from that queue without rediscovering from scratch. Identify the smallest type boundary or independent leaf batch that removes casts from already-converted code.
2. Decide: state the batch target and success checks. Do not disable rules to make progress.
3. Act: convert the files to TypeScript and keep behavior stable. No drive-bys in the same commit — import-path tweaks, formatting, version bumps, and renames belong in their own. No pure helpers extracted solely to test trivial assertions; if it's one expression, inline it. Shimming an untyped peer with `as unknown as X` is acceptable debt — the next batch that converts the peer removes the shim.
4. Verify: `bun run typecheck` (gates), `bun run build` only when the batch may affect bundling, routing, imports, generated assets, or runtime packaging (gates when run), `bun run test` for modules with Playwright coverage (gates), and targeted `bunx oxlint <changed files>` for review delta (informational — project baseline is ~32 000 errors). Then exercise the batch in the browser only when it affects user-visible app flows: source `~/.secrets/phanpy-atproto-test.env` (`ATPROTO_TEST_IDENTIFIER`, `ATPROTO_TEST_PASSWORD`), run `bun run dev`, and walk the affected flows. For pure leaf utilities, use direct module probes or targeted runtime checks when useful; otherwise types, targeted lint, and review are sufficient.
5. Review: send the whole batch diff to Claude Opus 4.7 with xhigh effort for code review. Ask for bugs, behavioral regressions, unsafe type claims, missing tests, over-decomposition, and rule bypasses.
6. Fix: address actionable review comments with code changes, not lint disables. If a lint rule appears wrong for the project, follow the rule-change protocol below.
7. Re-review: after addressing any actionable Claude finding, rerun the relevant verification and send the revised diff back to Claude. Repeat until Claude reports no actionable findings. Commit only after that final clean review. Skip re-review only when the first review contains no actionable findings or only explicitly non-actionable residual risks.
8. Commit & push: run `git status -sb` and `git diff --name-status`, then commit the batch with a narrow message only when the batch is green and Claude reports no actionable findings. Do not batch unrelated catalog, image, domain, or package-manager changes. Push to `fork/typescript` immediately after committing — don't let commits pile up locally.
9. Loop: pick the next batch by removing the largest remaining JS boundary around already-typed code.

Pick batches leaves-first by import graph — modules whose dependencies are already typed. Out-of-order is fine; it just leaves `as unknown as X` shims that the next batch removes. Avoid creating types for known-broken behavior; mark those as follow-up bugs or fix behavior first.

### Claude Review CLI

Use the local `claude` CLI for automated review. Run non-interactively with Opus and xhigh effort:

```bash
claude -p --model opus --effort xhigh --no-session-persistence "$PROMPT"
```

For a batch review, build `PROMPT` from the current diff and the verification output. The heredoc delimiter is **unquoted** so `${VERIFY}` and `${DIFF}` expand:

```bash
CHANGED="$(git diff --name-only HEAD -- src)"
DIFF="$(git diff --no-color HEAD)"
VERIFY="$(bun run typecheck 2>&1; echo '---'; bunx oxlint $CHANGED 2>&1)"
PROMPT="$(cat <<PROMPT_EOF
You are reviewing a TypeScript migration batch in Bluepy.

Review for correctness only. Prioritize:
- behavioral regressions from the JavaScript original
- unsafe type claims, casts, or index signatures
- missing tests around changed behavior
- over-decomposition or unnecessary abstraction
- lint/typecheck rule bypasses
- package, lockfile, generated-file, or unrelated changes that do not belong in this batch

Return findings first, ordered by severity. Include file and line references. If there are no findings, say so and name residual risks.

Verification run:
${VERIFY}

Diff:
${DIFF}
PROMPT_EOF
)"
claude -p --model opus --effort xhigh --no-session-persistence "$PROMPT"
```

For smoke testing Claude availability:

```bash
claude -p --model opus --effort xhigh --no-session-persistence 'Smoke test: reply with exactly CLAUDE_OK if you can read this.'
```

Do not let Claude edit files directly during review. Treat Claude output as review input; Codex owns code changes, verification, and commits.

### Rule-Change Protocol

Default behavior is to obey every configured rule. A migration batch must not silently relax lint, typecheck, formatter, test, build, or runtime checks.

If a rule blocks useful work, first try the smallest compliant code change. If that makes the code materially worse, create a separate rule-change proposal artifact instead of editing config inline.

Use `docs/rule-change-proposals/YYYY-MM-DD-brief-name.md` with:

- rule/check name
- exact command and diagnostic
- changed files blocked by the rule
- why compliant code is worse for this codebase
- proposed config change or scoped exception
- blast radius
- rollback plan
- Claude Opus 4.7 xhigh-effort review result

Automation may commit a rule-change proposal document without human approval. Automation may apply the rule change only when all of these are true:

1. The proposal is in its own commit.
2. Claude’s review explicitly approves the rule change.
3. The change is narrower than disabling the whole rule globally.
4. The commit message starts with `Adjust lint rule:`.
5. The next migration batch confirms the adjusted rule no longer hides unrelated findings.

If those conditions are not met, leave the proposal committed and continue with a different migration batch.
