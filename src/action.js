import fs from "node:fs";
import { scanRepository, toMarkdown } from "./radar.js";

const root = process.env.INPUT_PATH || ".";
const threshold = (process.env["INPUT_FAIL-ON"] || "error").toLowerCase();
const findings = scanRepository(root);
const markdown = toMarkdown(findings);

if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `findings=${findings.length}\n`);

for (const item of findings) {
  const command = item.severity === "error" ? "error" : "warning";
  console.log(`::${command} file=${item.file},line=${item.line},title=${item.id}::${item.title} — ${item.remediation}`);
}

console.log(markdown);
const shouldFail = threshold === "warning" ? findings.length > 0 :
  threshold === "error" ? findings.some((item) => item.severity === "error") : false;
if (shouldFail) process.exitCode = 1;
