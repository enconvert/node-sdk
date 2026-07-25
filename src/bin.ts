#!/usr/bin/env node
/**
 * `enconvert-sdk`: the SDK's tiny CLI.
 *
 * The SDK itself is a library, so this exists for exactly one job people ask
 * for at the terminal: moving to the latest version without having to remember
 * which package manager the project uses. It detects npm / pnpm / yarn / bun
 * from the ambient package manager and always prints the exact install command
 * before running it, so nothing runs that you have not seen first.
 *
 * Deliberately dependency-free (node: builtins only): this file is bundled as
 * a separate ESM entry and the SDK ships zero runtime dependencies.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { VERSION } from "./index.js";

const PKG = "@enconvert/node-sdk";
const REGISTRY_URL = `https://registry.npmjs.org/${PKG}/latest`;
const USER_AGENT = `enconvert-sdk/${VERSION} (+https://enconvert.com)`;

type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

interface InstallPlan {
  manager: PackageManager;
  command: string;
  args: string[];
  /** How the manager was determined, shown so the choice is never a mystery. */
  source: string;
}

/** `npm add` is valid but `npm install` is the documented spelling; the rest use `add`. */
const INSTALL_VERB: Record<PackageManager, string> = {
  npm: "install",
  pnpm: "add",
  yarn: "add",
  bun: "add",
};

const LOCKFILES: ReadonlyArray<readonly [string, PackageManager]> = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lockb", "bun"],
  ["bun.lock", "bun"],
  ["package-lock.json", "npm"],
];

function isPackageManager(value: string): value is PackageManager {
  return value === "npm" || value === "pnpm" || value === "yarn" || value === "bun";
}

/**
 * npm, pnpm, yarn and bun all set npm_config_user_agent when they invoke a
 * script, e.g. "pnpm/8.15.1 npm/? node/v20.11.0 darwin arm64". That is the most
 * reliable signal, so it wins over anything on disk.
 */
function fromUserAgent(): PackageManager | undefined {
  const agent = process.env.npm_config_user_agent;
  if (agent === undefined || agent === "") return undefined;
  const name = agent.split("/")[0]?.trim().toLowerCase();
  return name !== undefined && isPackageManager(name) ? name : undefined;
}

/** Corepack's `"packageManager": "pnpm@8.15.1"` field pins the project's manager. */
function fromPackageJson(cwd: string): PackageManager | undefined {
  const path = join(cwd, "package.json");
  if (!existsSync(path)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
  const field = (parsed as { packageManager?: unknown }).packageManager;
  if (typeof field !== "string") return undefined;
  const name = field.split("@")[0]?.trim().toLowerCase();
  return name !== undefined && isPackageManager(name) ? name : undefined;
}

function fromLockfile(cwd: string): PackageManager | undefined {
  for (const [file, manager] of LOCKFILES) {
    if (existsSync(join(cwd, file))) return manager;
  }
  return undefined;
}

function detectPackageManager(cwd: string): { manager: PackageManager; source: string } {
  const agent = fromUserAgent();
  if (agent !== undefined) return { manager: agent, source: "npm_config_user_agent" };

  const pinned = fromPackageJson(cwd);
  if (pinned !== undefined) return { manager: pinned, source: 'package.json "packageManager"' };

  const lock = fromLockfile(cwd);
  if (lock !== undefined) return { manager: lock, source: "lockfile in the current directory" };

  return { manager: "npm", source: "default (no package manager detected)" };
}

function buildInstallPlan(cwd: string): InstallPlan {
  const { manager, source } = detectPackageManager(cwd);
  const args = [INSTALL_VERB[manager], `${PKG}@latest`];
  return { manager, args, command: `${manager} ${args.join(" ")}`, source };
}

type LatestVersion = { ok: true; version: string } | { ok: false; message: string };

/** Best effort: a registry that is unreachable must not stop the upgrade. */
async function fetchLatestVersion(): Promise<LatestVersion> {
  let resp: Response;
  try {
    resp = await fetch(REGISTRY_URL, {
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": USER_AGENT, accept: "application/json" },
    });
  } catch {
    return { ok: false, message: "Could not reach the npm registry (offline?)." };
  }
  if (!resp.ok) {
    return { ok: false, message: `The npm registry answered HTTP ${resp.status} for ${PKG}.` };
  }
  let body: unknown;
  try {
    body = await resp.json();
  } catch {
    return { ok: false, message: "The npm registry returned a response that could not be parsed." };
  }
  const version = (body as { version?: unknown }).version;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+/.test(version)) {
    return { ok: false, message: `The npm registry did not report a version for ${PKG}.` };
  }
  return { ok: true, version };
}

/** Numeric major/minor/patch compare; any prerelease or build suffix is ignored. */
function isNewer(latest: string, current: string): boolean {
  const parse = (v: string): number[] =>
    v.replace(/^v/, "").split(".").map((n) => Number.parseInt(n, 10) || 0);
  const a = parse(latest);
  const b = parse(current);
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
  }
  return false;
}

function printHelp(): void {
  console.log();
  console.log("  EnConvert SDK");
  console.log(`  JavaScript / TypeScript SDK for the EnConvert file conversion API (v${VERSION})`);
  console.log();
  console.log("  Usage: npx enconvert-sdk <command> [options]");
  console.log();
  console.log("  Commands:");
  console.log("    upgrade [--dry-run]  Install the latest SDK with this project's package manager");
  console.log("    version              Print the installed SDK version");
  console.log("    help                 Show this help");
  console.log();
  console.log("  Options:");
  console.log("    -n, --dry-run        Print the command that would run, then exit");
  console.log();
  console.log("  Docs: https://enconvert.com/docs");
  console.log();
}

async function runUpgrade(dryRun: boolean): Promise<void> {
  const plan = buildInstallPlan(process.cwd());

  console.log();
  console.log("  EnConvert SDK - upgrade");
  console.log();
  console.log(`  installed:       v${VERSION}`);
  console.log(`  package manager: ${plan.manager}  (from ${plan.source})`);

  const latest = await fetchLatestVersion();
  let upToDate = false;
  if (latest.ok) {
    console.log(`  latest on npm:   v${latest.version}`);
    upToDate = !isNewer(latest.version, VERSION);
    if (!upToDate) {
      console.log();
      console.log(`  Update available: v${VERSION} -> v${latest.version}`);
    }
  } else {
    console.log(`  latest on npm:   unknown - ${latest.message}`);
  }

  // --dry-run is an explicit "show me what you would do", so the command is
  // printed even when it would be a no-op. Without the flag there is nothing
  // worth running when we are already current.
  if (dryRun) {
    console.log();
    console.log(`  Would run: ${plan.command}`);
    if (upToDate) console.log(`  (v${VERSION} is already the latest, so this would be a no-op.)`);
    console.log("  --dry-run: nothing was changed.");
    console.log();
    return;
  }

  if (upToDate) {
    console.log();
    console.log(`  Already up to date (v${VERSION}).`);
    console.log();
    return;
  }

  console.log();
  console.log(`  Running: ${plan.command}`);
  console.log();

  const result = spawnSync(plan.manager, plan.args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  console.log();
  if (result.error !== undefined) {
    console.error(`  Could not run ${plan.manager}: ${result.error.message}`);
    console.error(`  Upgrade manually: ${plan.command}`);
    console.log();
    process.exitCode = 1;
    return;
  }
  if (result.status !== 0) {
    console.error(`  ${plan.manager} exited with status ${result.status ?? "unknown"}. Nothing was upgraded.`);
    console.error(`  Retry manually: ${plan.command}`);
    console.log();
    process.exitCode = 1;
    return;
  }
  console.log(`  Upgraded ${PKG}.`);
  console.log();
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const flags = new Set(argv.filter((a) => a.startsWith("-")));
  const command = argv.find((a) => !a.startsWith("-"));

  if (command === undefined) {
    if (flags.has("--version") || flags.has("-v")) {
      console.log(VERSION);
      return;
    }
    printHelp();
    return;
  }

  switch (command) {
    case "version":
      console.log(VERSION);
      return;
    case "upgrade":
      await runUpgrade(flags.has("--dry-run") || flags.has("-n"));
      return;
    case "help":
      printHelp();
      return;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exitCode = 1;
      return;
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[enconvert-sdk] fatal: ${message}\n`);
  process.exit(1);
});
