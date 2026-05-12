# Goal Prompt: TypeScript Migration

```text
/goal Migrate Bluepy to TypeScript on the `typescript` branch.

Ensure you're on `typescript`; if absent, run `git fetch fork && git switch --track fork/typescript`. Before each batch, run `git fetch fork && git rebase fork/typescript` to stay current with the TypeScript migration branch. Do not rebase this work onto `fork/bluesky` unless explicitly instructed.

Follow AGENTS.md exactly. Work in reviewable leaves-first batches, usually 2-5 tiny independent files or one cohesive boundary, aiming for under 300 changed lines and splitting at 500. Prefer extensionless import-safe `.js -> .ts` / `.jsx -> .tsx` conversions first, because they avoid import churn. For each batch: inspect callers, convert only the cohesive boundary or independent leaf utilities, run verification, use one `claude -p --model opus --effort xhigh` review for the whole batch, fix actionable findings, then send the revised diff back to Claude. Repeat the fix/re-review loop until Claude reports no actionable findings before committing and pushing to `fork/typescript`.

Do not disable lint/typecheck/build/test rules. If a rule blocks progress, use the AGENTS.md rule-change protocol. Avoid typing broken behavior as if it is correct; either fix behavior first or record follow-up debt.

Maintain a candidate queue: inspect a set of small JS/JSX leaf modules once, then convert the next safe batch from that queue without rediscovering from scratch. Before each commit, run `git status -sb` and `git diff --name-status`. Keep unrelated generated files, images, catalog updates, package-manager changes, and drive-bys out of migration commits. The logged-in dev-server walk is required only for batches that affect user-visible app flows. For pure leaf utilities, prefer direct module probes or targeted runtime checks when useful; otherwise types, targeted lint, and Claude review are sufficient. Run `bun run build` only when the batch can affect bundling, routing, imports, generated assets, or runtime packaging.

Win condition: every `.js`/`.jsx` under `src/` has been converted to `.ts`/`.tsx` AND `bunx oxlint` reports zero errors (aspirational — use the rule-change protocol if compliant code can't reach zero). Stop and surface the blocker if any verification or review step fails three times in a row on the same batch.
```
