import manifest from "./cli-tool-definition.generated.json";

type Flag = {
  name: string;
  short?: string;
  usage: string;
  persistent: boolean;
};

type Command = {
  path: string;
  short: string;
  aliases: string[];
  flags: Flag[];
};

type Manifest = {
  generatedAt: string;
  commands: Command[];
};

function formatFlag(flag: Flag): string {
  const long = `--${flag.name}`;
  const short = flag.short ? `-${flag.short}, ` : "";
  return `${short}${long}: ${flag.usage}`;
}

export function buildCliToolDefinitionText(maxFlagsPerCommand = Number.POSITIVE_INFINITY): string {
  const data = manifest as Manifest;
  const lines: string[] = [];

  lines.push("CLI Tool Definition (auto-generated from cli-go/cmd):");

  for (const command of data.commands) {
    const aliasText =
      command.aliases.length > 0
        ? ` (aliases: ${command.aliases.join(", ")})`
        : "";

    lines.push(`- ${command.path}${aliasText}: ${command.short}`);

    const criticalFlags = command.flags.slice(0, maxFlagsPerCommand);
    if (criticalFlags.length > 0) {
      lines.push(`  Critical flags: ${criticalFlags.map(formatFlag).join(" | ")}`);
    }
  }

  lines.push(
    `Generated at: ${data.generatedAt}. If command docs drift, re-run: npm run generate:cli-tool-def`,
  );

  return lines.join("\n");
}
