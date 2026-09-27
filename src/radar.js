import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const rules = JSON.parse(fs.readFileSync(path.join(here, "..", "rules.json"), "utf8"));
const byId = new Map(rules.map((rule) => [rule.id, rule]));

function finding(id, file, line, evidence) {
  return { ...byId.get(id), file, line, evidence };
}

function isFullSha(ref) {
  return /^[0-9a-f]{40}$/i.test(ref);
}

function isGitHubOwned(target) {
  return /^(actions|github|githubsecuritylab)\//i.test(target);
}

export function scanText(text, file) {
  const lines = text.split(/\r?\n/);
  const results = [];
  const isWorkflow = /\.github[\\/]workflows[\\/].+\.ya?ml$/i.test(file);
  const isActionMetadata = /(^|[\\/])action\.ya?ml$/i.test(file);
  const hasPullRequestTarget = lines.some((line) => /^\s*pull_request_target\s*:/i.test(line));

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (isActionMetadata && /^\s*using\s*:\s*["']?node20["']?\s*$/i.test(line)) {
      results.push(finding("GH-2026-NODE20", file, lineNumber, line.trim()));
    }

    const uses = line.match(/^\s*-?\s*uses\s*:\s*["']?([^\s"']+)["']?/i);
    if (isWorkflow && uses) {
      const value = uses[1];
      const at = value.lastIndexOf("@");
      if (at > 0 && !value.startsWith("./") && !value.startsWith("docker://")) {
        const target = value.slice(0, at);
        const ref = value.slice(at + 1);
        if (!isFullSha(ref) && !isGitHubOwned(target)) {
          results.push(finding("GH-ACTIONS-MUTABLE-REF", file, lineNumber, line.trim()));
        }
      }
      if (hasPullRequestTarget && /checkout/i.test(value)) {
        const nearby = lines.slice(index, Math.min(lines.length, index + 8)).join("\n");
        if (/github\.event\.pull_request\.head\.(sha|ref)/i.test(nearby)) {
          results.push(finding("GH-PR-TARGET-HEAD", file, lineNumber, line.trim()));
        }
      }
    }

    if (isWorkflow && /^\s*runs-on\s*:.*self-hosted/i.test(line)) {
      results.push(finding("GH-SELF-HOSTED-FLOOR", file, lineNumber, line.trim()));
    }
    if (isWorkflow && /::set-output\s+name=/i.test(line)) {
      results.push(finding("GH-LEGACY-COMMAND", file, lineNumber, line.trim()));
    }
  });

  return results;
}

function walk(root) {
  const found = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if ([".git", "node_modules", "dist", "vendor"].includes(entry.name)) continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (/\.ya?ml$/i.test(entry.name)) found.push(full);
  }
  return found;
}

export function scanRepository(root) {
  const absolute = path.resolve(root);
  return walk(absolute).flatMap((file) => {
    const relative = path.relative(absolute, file).replaceAll("\\", "/");
    return scanText(fs.readFileSync(file, "utf8"), relative);
  });
}

export function toMarkdown(findings) {
  const errors = findings.filter((item) => item.severity === "error").length;
  const warnings = findings.filter((item) => item.severity === "warning").length;
  const header = `# Actions Change Radar\n\n${errors} error(s), ${warnings} warning(s).`;
  if (!findings.length) return `${header}\n\nNo tracked compatibility gaps found.\n`;
  const rows = findings.map((item) =>
    `| ${item.severity.toUpperCase()} | ${item.id} | \`${item.file}:${item.line}\` | ${item.title} | ${item.effectiveDate} |`
  );
  const details = findings.map((item) =>
    `### ${item.id}: ${item.title}\n\n- Location: \`${item.file}:${item.line}\`\n- Evidence: \`${item.evidence}\`\n- Fix: ${item.remediation}\n- [Official source](${item.source})`
  );
  return `${header}\n\n| Severity | Rule | Location | Finding | Effective |\n|---|---|---|---|---|\n${rows.join("\n")}\n\n${details.join("\n\n")}\n`;
}
