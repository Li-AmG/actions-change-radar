#!/usr/bin/env node
import { scanRepository, toMarkdown } from "./radar.js";

const args = process.argv.slice(2);
const root = args.find((arg) => !arg.startsWith("--")) || ".";
const formatIndex = args.indexOf("--format");
const format = formatIndex >= 0 ? args[formatIndex + 1] : "markdown";
const findings = scanRepository(root);

if (format === "json") console.log(JSON.stringify({ findings }, null, 2));
else console.log(toMarkdown(findings));

process.exitCode = findings.some((item) => item.severity === "error") ? 2 : 0;
