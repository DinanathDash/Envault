# Envault TypeScript SDK

`@dinanathdash/envault-sdk` provides the Envault agent interception client for secure mutation workflows with human approval gates.

## Install

```bash
npm install @dinanathdash/envault-sdk
```

## Build (package-local)

```bash
npm ci
npm run build
```

## Version and update commands

Check installed SDK version:

```bash
npm ls @dinanathdash/envault-sdk
```

Check latest published SDK version:

```bash
npm view @dinanathdash/envault-sdk version
```

Update SDK:

```bash
npm install @dinanathdash/envault-sdk@latest
```

Runtime behavior:
- SDK warns when a newer version is available.
- SDK can enforce a minimum supported version returned by the Envault server.
