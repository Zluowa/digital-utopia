# Open Source Release Plan (Private -> Public)

## Goal

Release **Digital Utopia only** as a standalone public GitHub project with one-line install.

## Phase 0: Private Staging (now)

1. Keep repo private.
2. Finalize docs:
   - `README.md`
   - `INSTALL.md`
   - `ACKNOWLEDGEMENTS.md`
   - `OPEN_SOURCE_STATUS.md`
3. Confirm one-line installer works:
   - `npx create-utopia my-world --target openclaw --yes`
4. Confirm no secrets/private runtime artifacts are tracked.
5. Create clean export snapshot:
   - `powershell -NoProfile -File scripts/release/stage-public.ps1`

## Phase 1: Private GitHub Repo Setup

1. Create a private GitHub repo (example: `digital-utopia`).
2. Push this project only.
3. Enable branch protection for `main`.
4. Add maintainers and run internal review.

## Phase 2: Install Path Hardening

Pick at least one public one-line path:

- GitHub path:
  - `npx --yes github:tishi-tech/digital-utopia my-world --target openclaw --yes`
- npm path:
  - Publish `create-utopia` and use:
  - `npx create-utopia@latest my-world --target openclaw --yes`

Validate on a clean machine (Node 20+, git only).

## Phase 3: Public Launch

1. Switch repository visibility: private -> public.
2. Publish launch notes with:
   - Vision
   - Quick start
   - Architecture summary
   - Thanks to `vibe-kanban` and OSS community
3. Announce in target channels.

## Post-Launch

1. Triage issues daily in first week.
2. Track install success rate and onboarding friction.
3. Publish first roadmap update.
