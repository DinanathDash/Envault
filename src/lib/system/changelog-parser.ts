import fs from "fs";
import path from "path";

export interface Author {
  name: string;
  github: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  rawDate: Date;
  category: string;
  body: string;
  slug: string;
  authors: Author[];
}

export function splitChangelogBody(markdown: string): {
  title: string;
  remainingBody: string;
} {
  const lines = markdown.split("\n");
  let headerIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (headerIndex !== -1) {
        return {
          title: lines.slice(0, i).join(" ").trim(),
          remainingBody: lines.slice(i).join("\n").trim(),
        };
      }
    } else if (headerIndex === -1) {
      if (line.startsWith("-") || line.startsWith("```")) {
        return { title: "", remainingBody: markdown };
      }
      headerIndex = i;
    }
  }

  return { title: markdown.trim(), remainingBody: "" };
}

const CATEGORY_ORDER = [
  "Security",
  "CLI",
  "Integrations",
  "Email",
  "API",
  "UI",
  "Docs",
  "Fix",
  "Performance",
  "Release",
] as const;

const CATEGORY_PATTERNS: Record<(typeof CATEGORY_ORDER)[number], RegExp[]> = {
  Security: [
    /\bsecurity\b/gi,
    /\bhmac\b/gi,
    /\bcsp\b/gi,
    /\bpasskey\b/gi,
    /\bwebauthn\b/gi,
    /\boauth\b/gi,
    /\bencrypt/gi,
    /\baudit\b/gi,
    /\bauthori[sz]ation\b/gi,
    /\baccess control\b/gi,
  ],
  CLI: [/\bcli\b/gi, /\bcommand\b/gi, /\bgoreleaser\b/gi, /\bnpm wrapper\b/gi],
  Integrations: [/\bgithub\b/gi, /\bintegration/gi, /\bapp installation\b/gi],
  Email: [/\bemail\b/gi, /\bresend\b/gi, /\bdigest\b/gi],
  API: [/\bapi\b/gi, /\broute\b/gi, /\bendpoint\b/gi],
  UI: [
    /\bui\b/gi,
    /\bcomponent\b/gi,
    /\bdesign\b/gi,
    /\banimation\b/gi,
    /\bnavbar\b/gi,
    /\btheme\b/gi,
  ],
  Docs: [
    /\bdoc(s|umentation)?\b/gi,
    /\bfumadoc/i,
    /\bchangelog\b/gi,
    /\brelease guide\b/gi,
  ],
  Fix: [/\bfix(es|ed)?\b/gi, /\bresolve(d)?\b/gi, /\bpatch(ed)?\b/gi],
  Performance: [/\bperformance\b/gi, /\bcach/gi, /\bredis\b/gi, /\boptim/gi],
  Release: [/\brelease\b/gi, /\bversion\b/gi],
};

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function normalizeCategory(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return (
    CATEGORY_ORDER.find((category) => category.toLowerCase() === normalized) ??
    null
  );
}

function detectCategory(heading: string, body: string): string {
  // Optional explicit override in heading: "## 1.2.1 - 2026-03-10 [Security]"
  const explicitMatch = heading.match(/\[([a-z ]+)\]/i);
  if (explicitMatch) {
    const explicit = normalizeCategory(explicitMatch[1]);
    if (explicit) return explicit;
  }

  const scores = new Map<string, number>();
  for (const category of CATEGORY_ORDER) scores.set(category, 0);

  for (const category of CATEGORY_ORDER) {
    if (category === "Release") continue;
    const patterns = CATEGORY_PATTERNS[category];
    let score = 0;
    for (const pattern of patterns) {
      // Heading relevance is weighted higher than body mentions.
      score += countMatches(heading, pattern) * 3;
      score += countMatches(body, pattern);
    }
    scores.set(category, score);
  }

  let bestCategory = "Release";
  let bestScore = 0;
  for (const category of CATEGORY_ORDER) {
    const score = scores.get(category) ?? 0;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
}

function formatDisplayDate(rawDate: Date): string {
  return rawDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function parseChangelog(): ChangelogEntry[] {
  const changelogMdxPath = path.join(process.cwd(), "CHANGELOG.mdx");
  const changelogMdPath = path.join(process.cwd(), "CHANGELOG.md");
  const changelogPath = fs.existsSync(changelogMdxPath)
    ? changelogMdxPath
    : changelogMdPath;
  const raw = fs.readFileSync(changelogPath, "utf-8");

  // Split on ## headings - each is one release
  const sections = raw.split(/^## /m).filter(Boolean);

  const entries: ChangelogEntry[] = [];

  for (const section of sections) {
    const lines = section.split("\n");
    const heading = lines[0].trim();

    // Matches "1.3.0 - 2026-03-09" or "1.3.0" or "1.3.0 (2026-03-09)"
    const versionMatch = heading.match(/^(\d+\.\d+\.\d+)/);
    if (!versionMatch) continue;

    const version = versionMatch[1];
    const dateMatch = heading.match(/(\d{4}-\d{2}-\d{2})/);
    const rawDate = dateMatch ? new Date(dateMatch[1]) : new Date();
    const date = formatDisplayDate(rawDate);

    let body = lines.slice(1).join("\n").trim();

    // Extract > Authors: line and strip it from the body
    const authors: Author[] = [];
    const authorLineMatch = body.match(/^> Authors:\s*(.+)$/m);
    if (authorLineMatch) {
      // Split by comma and parse each "Name (GitHubHandle)" part individually
      for (const part of authorLineMatch[1].split(",")) {
        const m = part.trim().match(/^(.+?)\s*\((\w+)\)$/);
        if (m) authors.push({ name: m[1].trim(), github: m[2] });
      }
      body = body.replace(/^> Authors:.*$\n?/m, "").trim();
    }

    // Strip trailing --- separators that MDX would render as <hr>
    body = body.replace(/\n+---\s*$/, "").trim();

    const category = detectCategory(heading, body);
    const slug = `v${version}`;

    entries.push({ version, date, rawDate, category, body, slug, authors });
  }

  // Newest first
  return entries.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
}
