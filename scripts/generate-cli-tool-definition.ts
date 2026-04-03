#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

type FlagInfo = {
  name: string;
  short?: string;
  usage: string;
  persistent: boolean;
};

type CommandInfo = {
  varName: string;
  use: string;
  short: string;
  aliases: string[];
  hidden: boolean;
  parentVar?: string;
  path: string;
  flags: FlagInfo[];
};

type Manifest = {
  generatedAt: string;
  sourceDir: string;
  commands: CommandInfo[];
};

const CMD_DIR = path.join(process.cwd(), "cli-go", "cmd");
const OUTPUT_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "sdk",
  "cli-tool-definition.generated.json",
);

function countChar(line: string, target: string): number {
  let count = 0;
  for (const ch of line) {
    if (ch === target) count += 1;
  }
  return count;
}

function extractQuotedStrings(line: string): string[] {
  const result: string[] = [];
  const regex = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(line)) !== null) {
    result.push(match[1]);
  }
  return result;
}

function extractAliases(block: string): string[] {
  const match = block.match(/Aliases:\s*\[\]string\{([\s\S]*?)\}/);
  if (!match) return [];
  return extractQuotedStrings(match[1]);
}

function parseCommandBlocks(content: string): Array<{ varName: string; block: string }> {
  const lines = content.split(/\r?\n/);
  const blocks: Array<{ varName: string; block: string }> = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const start = line.match(/^\s*var\s+([A-Za-z0-9_]+)\s*=\s*&cobra\.Command\s*\{/);
    if (!start) {
      i += 1;
      continue;
    }

    const varName = start[1];
    let depth = countChar(line, "{") - countChar(line, "}");
    const buffer: string[] = [line];
    i += 1;

    while (i < lines.length && depth > 0) {
      const nextLine = lines[i];
      buffer.push(nextLine);
      depth += countChar(nextLine, "{") - countChar(nextLine, "}");
      i += 1;
    }

    blocks.push({ varName, block: buffer.join("\n") });
  }

  return blocks;
}

function parseFlags(content: string): Map<string, FlagInfo[]> {
  const byCommand = new Map<string, FlagInfo[]>();
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(
      /([A-Za-z0-9_]+)\.(PersistentFlags|Flags)\(\)\.[A-Za-z0-9_]+VarP?\(/,
    );
    if (!match) continue;

    const commandVar = match[1];
    const persistent = match[2] === "PersistentFlags";
    const quoted = extractQuotedStrings(line);
    if (quoted.length < 2) continue;

    const name = quoted[0];
    const usage = quoted[quoted.length - 1];

    let short: string | undefined;
    if (/VarP\(/.test(line) && quoted.length >= 3) {
      short = quoted[1];
      if (short === "") short = undefined;
    }

    const existing = byCommand.get(commandVar) || [];
    existing.push({ name, short, usage, persistent });
    byCommand.set(commandVar, existing);
  }

  return byCommand;
}

function parseParents(content: string): Array<{ parent: string; child: string }> {
  const links: Array<{ parent: string; child: string }> = [];
  const regex = /([A-Za-z0-9_]+)\.AddCommand\(([^)]+)\)/g;
  let match: RegExpExecArray | null = null;
  while ((match = regex.exec(content)) !== null) {
    const parent = match[1];
    const childrenRaw = match[2];
    const children = childrenRaw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    for (const child of children) {
      links.push({ parent, child });
    }
  }
  return links;
}

function commandToken(useValue: string): string {
  return useValue.trim().split(/\s+/)[0] || useValue.trim();
}

function buildManifest(): Manifest {
  const files = fs
    .readdirSync(CMD_DIR)
    .filter((name) => name.endsWith(".go") && !name.endsWith("_test.go"));

  const commandByVar = new Map<string, Omit<CommandInfo, "path">>();
  const parents = new Map<string, string>();
  const flags = new Map<string, FlagInfo[]>();

  for (const fileName of files) {
    const fullPath = path.join(CMD_DIR, fileName);
    const content = fs.readFileSync(fullPath, "utf-8");

    for (const { varName, block } of parseCommandBlocks(content)) {
      const useMatch = block.match(/Use:\s*"([^"]+)"/);
      const shortMatch = block.match(/Short:\s*"([^"]+)"/);
      if (!useMatch || !shortMatch) continue;

      const hidden = /Hidden:\s*true/.test(block);
      commandByVar.set(varName, {
        varName,
        use: useMatch[1],
        short: shortMatch[1],
        aliases: extractAliases(block),
        hidden,
        flags: [],
      });
    }

    for (const [cmdVar, cmdFlags] of parseFlags(content)) {
      const existing = flags.get(cmdVar) || [];
      flags.set(cmdVar, [...existing, ...cmdFlags]);
    }

    for (const link of parseParents(content)) {
      parents.set(link.child, link.parent);
    }
  }

  const resolvePath = (varName: string): string => {
    const parts: string[] = [];
    const seen = new Set<string>();
    let current: string | undefined = varName;

    while (current && !seen.has(current)) {
      seen.add(current);
      const info = commandByVar.get(current);
      if (info) {
        if (current === "rootCmd") {
          parts.unshift(commandToken(info.use));
          break;
        }
        parts.unshift(commandToken(info.use));
      }
      current = parents.get(current);
      if (current === "rootCmd") {
        const rootInfo = commandByVar.get("rootCmd");
        if (rootInfo) {
          parts.unshift(commandToken(rootInfo.use));
        }
        break;
      }
    }

    return parts.join(" ");
  };

  const commands: CommandInfo[] = Array.from(commandByVar.values())
    .map((command) => {
      const cmdFlags = flags.get(command.varName) || [];
      return {
        ...command,
        parentVar: parents.get(command.varName),
        path: resolvePath(command.varName),
        flags: cmdFlags,
      };
    })
    .filter((command) => command.path.length > 0 && !command.hidden)
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    generatedAt: new Date().toISOString(),
    sourceDir: "cli-go/cmd",
    commands,
  };
}

function main() {
  const manifest = buildManifest();
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  console.log(`Generated CLI tool definition: ${OUTPUT_PATH}`);
  console.log(`Commands: ${manifest.commands.length}`);
}

main();
