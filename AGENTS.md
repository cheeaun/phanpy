# Bluepy Agent Runbook

## Deployment Source Of Truth

Production deploys from `fork/bluesky`, not feature branches. Use `/tmp/bluepy-bluesky-deploy` or another clean worktree for deploy-target work. Do not assume Cloudflare Pages; this project deploys on Cloudflare Workers with static assets.

## Before Committing

Always run `git status -sb` and `git diff --name-status` before staging. Never commit generated images unless explicitly requested in the current turn. Keep generated locale catalogs in separate commits.

## Package Manager

Use Bun for installs and scripts: `bun install`, `bun run ...`, and `bunx ...`. Runtime remains browser/Cloudflare Workers, not Bun.

## Long-Running Work

Make small commits by concern. Push deploy-relevant commits to `fork/bluesky`. Report any remaining dirty files explicitly.
