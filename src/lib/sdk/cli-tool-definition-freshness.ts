import { readdir, stat } from "node:fs/promises";
import path from "node:path";

type CachedFreshnessResult = {
  checkedAtMs: number;
  warning: string | null;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedResult: CachedFreshnessResult | null = null;

async function getNewestCliCommandMtimeMs(cmdDir: string): Promise<number> {
  const entries = await readdir(cmdDir, { withFileTypes: true });

  let newest = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".go")) continue;
    if (entry.name.endsWith("_test.go")) continue;

    const fullPath = path.join(cmdDir, entry.name);
    const fileStat = await stat(fullPath);
    newest = Math.max(newest, fileStat.mtimeMs);
  }

  return newest;
}

export async function getCliToolDefinitionFreshnessWarning(): Promise<string | null> {
  const nowMs = Date.now();
  if (cachedResult && nowMs-cachedResult.checkedAtMs < CACHE_TTL_MS) {
    return cachedResult.warning;
  }

  const manifestPath = path.join(
    process.cwd(),
    "src",
    "lib",
    "sdk",
    "cli-tool-definition.generated.json",
  );
  const cmdDir = path.join(process.cwd(), "cli-go", "cmd");

  try {
    const [manifestStat, newestCommandMtimeMs] = await Promise.all([
      stat(manifestPath),
      getNewestCliCommandMtimeMs(cmdDir),
    ]);

    const isStale = newestCommandMtimeMs > manifestStat.mtimeMs;
    const warning = isStale
      ? "Warning: CLI command manifest may be stale vs cli-go/cmd. Re-run `npm run generate:cli-tool-def` before relying on automated command guidance."
      : null;

    cachedResult = {
      checkedAtMs: nowMs,
      warning,
    };

    return warning;
  } catch {
    // Do not break agent flow if filesystem checks are unavailable.
    cachedResult = {
      checkedAtMs: nowMs,
      warning: null,
    };
    return null;
  }
}
