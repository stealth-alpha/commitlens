# CommitLens

**A conventional-commit linter that shows you the release notes and breaking
changes *before* you push — not after you've shipped them.**

Zero dependencies. Node 18+. MIT licensed.

## The problem

Conventional commits only work if they're actually conventional. By the time a
bad message lands on `main`, it's already polluted your changelog, your
release-notes generator silently dropped it into "Miscellaneous", and a
breaking change slipped out under a patch bump.

Every existing linter tells you *that* a commit is wrong — after you wrote it.
None of them tell you **what your release notes will look like** or **whether
this push breaks your users**.

CommitLens answers three questions in one command:

1. Do my unpushed commits pass the Conventional Commits spec (and my team's rules)?
2. What will the release notes for this push look like?
3. Am I about to introduce breaking changes?

## Install

```bash
npm i -g @stealth-alpha/commitlens
# or run without installing:
npx @stealth-alpha/commitlens check
```

## 30-second quickstart

```bash
$ cd your-project

# Lint everything you haven't pushed yet
$ commitlens check
commitlens · origin/main..HEAD · feature/api
✗ totally rewrote the auth layer
   error type-empty: commit does not follow Conventional Commits ("type: description")
✗ fix(api): handle empty body.
   warn subject-full-stop: subject must not end with a period
✓ feat(api): add pagination

3 commits · 1 clean · 1 warning · 1 error · 1 breaking
```

Preview the release notes this push will produce:

```bash
$ commitlens notes --range origin/main..HEAD
## Unreleased

### ⚠ BREAKING CHANGES
- totally rewrote the auth layer — tokens are now opaque

### Bug Fixes
- **api**: handle empty body.

### Features
- **api**: add pagination
```
(The sample repo's third commit carries a `BREAKING CHANGE: tokens are now opaque` footer.)

Check breaking changes alone:

```bash
$ commitlens breaking
• 1 breaking change(s) in origin/main..HEAD:
  ! totally rewrote the auth layer — tokens are now opaque (f3a09c1)
warn: This push will introduce breaking changes — bump MAJOR before releasing.
```

## How it picks its range

With no `--range` flag, CommitLens reviews exactly what you're about to push:

1. `<upstream>..HEAD` when your branch has an upstream
2. `<latest-version-tag>..HEAD` when the repo has a semver tag
3. the entire history otherwise

## Use it as a git hook

**commit-msg** (lint the message as it's written):

```bash
# .git/hooks/commit-msg
#!/bin/sh
npx @stealth-alpha/commitlens check "$1"
```

**pre-push** (lint the whole outgoing range):

```bash
# .git/hooks/pre-push
#!/bin/sh
npx @stealth-alpha/commitlens check --strict
```

## Configuration

Run `commitlens init` to write a `commitlens.config.json`:

```json
{
  "types": ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"],
  "maxSubjectLength": 100,
  "maxBodyLineLength": 100,
  "rules": {
    "type-empty": "error",
    "type-enum": "error",
    "type-case": "error",
    "scope-case": "warn",
    "subject-empty": "error",
    "subject-full-stop": "warn",
    "subject-max-length": "error",
    "body-max-line-length": "warn",
    "breaking-migration-note": "error"
  }
}
```

Any rule can be `"error"`, `"warn"`, or `"off"`; `--strict` promotes warnings
to failures.

## Commands

| Command | Purpose |
| --- | --- |
| `commitlens check [file]` | Lint the outgoing range, or one commit-message file (hooks) |
| `commitlens check --staged` | Lint the last composed message |
| `commitlens notes [--write]` | Release-notes preview (`md` or `--format json`) |
| `commitlens breaking` | Breaking-change report for the range |
| `commitlens init` | Write `commitlens.config.json` |

## Why zero dependencies?

CommitLens is built entirely on Node built-ins: no transitive-dependency audit
fatigue, no supply-chain surface, installs in milliseconds, works offline. It's
the same philosophy as the rest of our tooling.

## CommitLens Pro

Running CommitLens across an organization? **CommitLens Pro** ($9/month) adds
team-level shared rule packs, a hosted dashboard of convention drift per repo,
pre-push policy enforcement through a GitHub App (block merges that would ship
undeclared breaking changes), and Slack/email digests of breaking changes
heading to your next release. One tier, no seat games. License via Gumroad —
link placeholder.

## License

MIT — see [LICENSE](LICENSE).

---

Part of the [stealth-alpha toolkit](https://stealth-alpha.github.io/toolkit/) — eight zero-dependency CLIs for release automation, agent security, and repo hygiene.
