# Envault MCP Server

This MCP server exposes direct Envault operations so blank chats can call tools immediately instead of exploring repo files.

## Tools

- `envault_status`
- `envault_pull`
- `envault_push`
- `envault_approve`
- `envault_set_local_key`
- `envault_remove_local_key`

## Local setup

1. Install dependencies:

```bash
cd mcp-server
npm install
```

2. Ensure `envault` CLI is installed and authenticated:

```bash
envault login
envault status
```

3. Start server:

```bash
npm start
```

## Version and update commands

Check installed MCP server version:

```bash
npx -y @dinanathdash/envault-mcp-server --version
# or inside this folder
npm run version
```

Check whether an npm update is available:

```bash
npx -y @dinanathdash/envault-mcp-server --check-update
# or inside this folder
npm run check:update
```

Update to latest package version:

```bash
npm install -g @dinanathdash/envault-mcp-server@latest
```

## Installation options for end users

You have 3 practical distribution models:

1. Local path (no publish required)
- Ship this repo (or this folder) and point MCP client to local file path.

2. npm package (recommended for broad adoption)
- Publish this package and let users configure MCP with `npx`.
- This is the simplest install UX for most LLM clients.

3. Source install from GitHub
- Users clone repo and run from local checkout.

### Recommended MCP config after npm publish

```json
{
  "mcpServers": {
    "envault": {
      "command": "npx",
      "args": ["-y", "@dinanathdash/envault-mcp-server"],
      "cwd": "/absolute/path/to/your/project"
    }
  }
}
```

### MCP config for local repo path

```json
{
  "mcpServers": {
    "envault": {
      "command": "node",
      "args": ["/absolute/path/to/Envault/mcp-server/server.mjs"],
      "cwd": "/absolute/path/to/your/project"
    }
  }
}
```

## Publishing workflow

If you decide to publish on npm:

1. Create npm org/package name you want to keep long-term.
2. Verify package metadata in [mcp-server/package.json](mcp-server/package.json).
3. Run:

```bash
cd mcp-server
npm install
npm run check
npm publish --access public
```

4. Update docs/examples to your final package name if it changes.

## Release alignment (SDK + MCP)

- SDK package: `@dinanathdash/envault-sdk` (version `1.0.0`)
- MCP package: `@dinanathdash/envault-mcp-server` (version `1.0.0`)

Suggested publish sequence:

1. Publish SDK from [src/lib/sdk/package.json](src/lib/sdk/package.json).
2. Publish MCP from [mcp-server/package.json](mcp-server/package.json).
3. Verify both install paths using `npm view` and a fresh `npx` call.

Notes:
- npm is not the only option, but it is the lowest-friction default for MCP users.
- You can also keep this private/internal and distribute via local path configs.

## Behavior

- For "set key" workflows, use `envault_set_local_key` then `envault_push` (or set `autoPush=true`).
- Approval workflows are fully inline using `envault_approve`.
- Local env file resolution reads `envault.json` mappings and default environment.
