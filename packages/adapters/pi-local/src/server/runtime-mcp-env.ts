import type { AdapterRuntimeMcpAccess } from "@paperclipai/adapter-utils";

// Always assign the reserved key, including an empty set, so configured or
// inherited entries cannot substitute another MCP credential. TOKEN in the
// name makes the existing invocation-env logger redact it.
export function buildPiRuntimeMcpEnv(access: AdapterRuntimeMcpAccess | undefined) {
  const servers = access?.getServers() ?? [];
  if (servers.length > 16) throw new Error("Too many Pi runtime MCP servers");
  const value = JSON.stringify(servers.map(server => {
    for (const key of ["name", "url", "token", "connectionId"] as const) {
      if (typeof server[key] !== "string" || !server[key]) throw new Error("Invalid Pi runtime MCP server");
    }
    return { name: server.name, url: server.url, token: server.token, connectionId: server.connectionId };
  }));
  if (Buffer.byteLength(value) > 65536) throw new Error("Pi runtime MCP configuration exceeds bound");
  return { PAPERCLIP_PI_MCP_SERVERS_TOKEN_JSON: value };
}
