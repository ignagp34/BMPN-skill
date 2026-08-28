/**
 * Install (or refresh) the `/bpmn` skill in the user's Claude Code skills
 * directory.
 *
 * Copies `skills/bpmn/` — SKILL.md, the DSL specification, and the self-contained
 * `bin/` bundle — to `~/.claude/skills/bpmn`, so `/bpmn` works from any project
 * rather than only from this repository.
 *
 *   node scripts/install-skill.mjs [--target <dir>] [--dry-run]
 */

import { cp, mkdir, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(ROOT, "skills", "bpmn");

function parseArgs(argv) {
  const options = { target: join(homedir(), ".claude", "skills", "bpmn"), dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--target") {
      options.target = resolve(argv[i + 1] ?? "");
      i += 1;
    } else if (argv[i] === "--dry-run") {
      options.dryRun = true;
    } else {
      throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  return options;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

const options = parseArgs(process.argv.slice(2));

if (!(await exists(join(SOURCE, "bin", "bpmn-render.mjs")))) {
  console.error("The skill bundle is missing. Run `npm run skill:build` first.");
  process.exit(1);
}

console.log(`source: ${SOURCE}`);
console.log(`target: ${options.target}`);

if (options.dryRun) {
  console.log("(dry run — nothing copied)");
  process.exit(0);
}

// Replace rather than merge, so a renamed or deleted file never lingers.
await rm(options.target, { recursive: true, force: true });
await mkdir(dirname(options.target), { recursive: true });
await cp(SOURCE, options.target, { recursive: true });

console.log("Installed. Start a new Claude Code session and run /bpmn.");
