import test from "node:test";
import assert from "node:assert/strict";
import { scanText, toMarkdown } from "../src/radar.js";

test("finds local node20 actions", () => {
  const findings = scanText("runs:\n  using: node20\n  main: index.js\n", "action.yml");
  assert.deepEqual(findings.map((item) => item.id), ["GH-2026-NODE20"]);
});

test("finds mutable third-party refs but permits full SHAs and GitHub-owned actions", () => {
  const source = `steps:\n  - uses: actions/checkout@v5\n  - uses: vendor/tool@main\n  - uses: vendor/safe@0123456789abcdef0123456789abcdef01234567\n`;
  const findings = scanText(source, ".github/workflows/ci.yml");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].id, "GH-ACTIONS-MUTABLE-REF");
  assert.equal(findings[0].line, 3);
});

test("finds privileged checkout of pull request head", () => {
  const source = `on:\n  pull_request_target:\nsteps:\n  - uses: actions/checkout@v5\n    with:\n      ref: \${{ github.event.pull_request.head.sha }}\n`;
  const findings = scanText(source, ".github/workflows/review.yml");
  assert.ok(findings.some((item) => item.id === "GH-PR-TARGET-HEAD"));
});

test("finds self-hosted runners and legacy output commands", () => {
  const source = `jobs:\n  build:\n    runs-on: self-hosted\n    steps:\n      - run: echo "::set-output name=x::y"\n`;
  const findings = scanText(source, ".github/workflows/ci.yaml");
  assert.deepEqual(findings.map((item) => item.id), ["GH-SELF-HOSTED-FLOOR", "GH-LEGACY-COMMAND"]);
});

test("renders a clean report", () => {
  assert.match(toMarkdown([]), /No tracked compatibility gaps found/);
});
