export const rpName = "Envault";

export function getRpId(req: Request) {
  const host = req.headers.get("host") || "envault.tech";
  // Remove port if present for rpID
  return host.split(":")[0];
}

export function getExpectedOrigin(req: Request) {
  const host = req.headers.get("host") || "envault.tech";
  // WebAuthn requires https unless it's localhost
  const protocol = host.includes("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}
