# Actions Change Radar

GitHub changes Actions continuously. A workflow can remain unchanged while its runner, JavaScript runtime, security assumptions, or supported commands change underneath it.

Actions Change Radar turns dated GitHub platform changes into a local repository report. It scans workflow YAML and local action metadata, links every finding to an official source, and suggests a concrete migration. It has no runtime dependencies, needs no token, sends no telemetry, and never uploads repository content.

> Early project: the first rules focus on high-impact Actions changes and security boundaries. A clean report does not prove a workflow is secure.

## What it detects

| Rule | Signal |
|---|---|
| `GH-2026-NODE20` | Local JavaScript actions that still declare `node20` |
| `GH-ACTIONS-MUTABLE-REF` | Third-party actions and reusable workflows referenced by a mutable tag or branch |
| `GH-PR-TARGET-HEAD` | Privileged `pull_request_target` workflows that check out pull-request head code |
| `GH-SELF-HOSTED-FLOOR` | Self-hosted jobs that need an explicit runner update plan |
| `GH-LEGACY-COMMAND` | Retired `::set-output` workflow commands |

Each rule has an effective date, remediation, and link to the GitHub Changelog in [`rules.json`](rules.json).

## Run locally

Requires Node.js 20 or newer.

```bash
node src/cli.js /path/to/repository --format markdown
node src/cli.js /path/to/repository --format json
```

Exit code `2` means at least one error-level migration was found. Warnings keep exit code `0`.

## Use as a GitHub Action

```yaml
name: Actions change radar
on:
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  radar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: Li-AmG/actions-change-radar@v0.1.0
        with:
          fail-on: error
```

The Action adds annotations and a Markdown job summary. `fail-on` accepts `error`, `warning`, or `never`.

## Why this is different

Security scanners primarily ask whether a workflow is vulnerable today. This project asks a narrower operational question: **which official GitHub platform changes require this repository to migrate, where, and by what date?** The versioned rule catalog makes every answer inspectable instead of relying on a remote service or opaque score.

## Add a rule

Open an issue with the official GitHub source, effective date, a minimal unsafe or incompatible example, and the expected remediation. Rules must be testable from repository files without transmitting their contents.

## Development

```bash
npm test
npm run scan:self
```

## License

MIT
