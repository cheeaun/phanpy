# Goal Prompt: TypeScript Migration

```text
/goal Migrate Bluepy to TypeScript on the `typescript` branch.

Ensure you're on `typescript`; if absent, run `git fetch fork && git switch --track fork/typescript`. Before each slice, run `git fetch fork && git rebase fork/typescript` to stay current with the TypeScript migration branch. Do not rebase this work onto `fork/bluesky` unless explicitly instructed.

Follow AGENTS.md exactly. Work in small leaves-first slices, usually under 300 changed lines. For each slice: inspect callers, convert only the cohesive boundary, run verification, use `claude -p --model opus --effort xhigh` for review, fix actionable findings, re-review if needed, then commit and push to `fork/typescript`.

Do not disable lint/typecheck/build/test rules. If a rule blocks progress, use the AGENTS.md rule-change protocol. Avoid typing broken behavior as if it is correct; either fix behavior first or record follow-up debt.

Start with the next JS leaf/boundary module whose dependencies are already typed. Before each commit, run `git status -sb` and `git diff --name-status`. Keep unrelated generated files, images, catalog updates, package-manager changes, and drive-bys out of migration commits. The logged-in dev-server walk is required only for slices that can affect user-visible behavior; pure-type slices pass on types + tests.

Win condition: every `.js`/`.jsx` under `src/` has been converted to `.ts`/`.tsx` AND `bunx oxlint` reports zero errors (aspirational — use the rule-change protocol if compliant code can't reach zero). Stop and surface the blocker if any verification or review step fails three times in a row on the same slice.
```
