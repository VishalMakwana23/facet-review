import { createInterface } from "node:readline";
import { compileIntent, decodeCandidate, inspectArtifact, migrateEnvelope, representationReceipt, validateArtifact, type ArtifactEnvelope, type CompactIntent, type FacetArtifact, type ProtocolCandidate } from "@facet-review/protocol";
import { renderProductArtifact } from "@facet-review/renderer";

type JsonRpcId = string | number | null;
interface Request { jsonrpc?: string; id?: JsonRpcId; method?: string; params?: Record<string, unknown> }

const tools = [
  { name:"compile_intent", description:"Compile a compact fi1 decision intent into a validated Facet artifact with deterministic stable IDs.", inputSchema:{type:"object",properties:{intent:{type:"array",description:"Compact fi1 tuple."}},required:["intent"],additionalProperties:false}, annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false} },
  { name:"validate_artifact", description:"Validate a canonical or compact Facet artifact without changing local state.", inputSchema:{type:"object",properties:{artifact:{description:"Canonical object or ft1 tuple."}},required:["artifact"],additionalProperties:false}, annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false} },
  { name:"inspect_artifact", description:"Classify a Facet artifact, recommend a deterministic review recipe, and report quality issues without model calls.", inputSchema:{type:"object",properties:{artifact:{description:"Canonical object, ft1 tuple, or fi1 intent."}},required:["artifact"],additionalProperties:false}, annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false} },
  { name:"render_artifact", description:"Render a validated Facet artifact as a self-contained, local-only HTML review canvas.", inputSchema:{type:"object",properties:{artifact:{description:"Canonical object, ft1 tuple, or fi1 intent."}},required:["artifact"],additionalProperties:false}, annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false} },
] as const;

export async function runMcpServer(): Promise<number> {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let request: Request;
    try { request = JSON.parse(line) as Request; }
    catch { writeError(null, -32700, "Parse error"); continue; }
    if (request.id === undefined) continue;
    try {
      if (request.method === "initialize") {
        const requested = typeof request.params?.protocolVersion === "string" ? request.params.protocolVersion : "2025-11-25";
        writeResult(request.id, { protocolVersion: requested, capabilities:{ tools:{ listChanged:false } }, serverInfo:{ name:"facet-review", version:"0.0.0" }, instructions:"Compile compact decision intent, validate artifacts, and render local review HTML. This server performs no publishing or network calls." });
      } else if (request.method === "ping") writeResult(request.id, {});
      else if (request.method === "tools/list") writeResult(request.id, { tools });
      else if (request.method === "tools/call") writeResult(request.id, callTool(request.params));
      else writeError(request.id, -32601, "Method not found");
    } catch (error) { writeError(request.id, -32603, error instanceof Error ? error.message : String(error)); }
  }
  return 0;
}

function callTool(params: Record<string, unknown> | undefined): Record<string, unknown> {
  const name = params?.name;
  const args = recordValue(params?.arguments);
  try {
    if (name === "compile_intent") return toolResult(compileIntent(args.intent as CompactIntent));
    if (name === "validate_artifact") return toolResult(validateArtifact(parseArtifactValue(args.artifact)));
    if (name === "inspect_artifact") {
      const input = args.artifact;
      const artifact = Array.isArray(input) && input[0] === "fi1" ? compileIntent(input as CompactIntent) : parseArtifactValue(input);
      return toolResult(inspectArtifact(artifact));
    }
    if (name === "render_artifact") {
      const input = args.artifact;
      const artifact = Array.isArray(input) && input[0] === "fi1" ? compileIntent(input as CompactIntent) : parseArtifactValue(input);
      return toolResult({ html:renderProductArtifact(artifact), receipt:representationReceipt(artifact) });
    }
    throw new Error(`Unknown tool: ${String(name)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content:[{type:"text",text:message}], isError:true };
  }
}

function parseArtifactValue(input: unknown): FacetArtifact {
  if (Array.isArray(input)) return decodeCandidate(input as ProtocolCandidate);
  if (!input || typeof input !== "object") throw new Error("Artifact must be an object or tuple");
  if ("format" in input || "f" in input) return decodeCandidate(input as ProtocolCandidate);
  return migrateEnvelope(input as ArtifactEnvelope);
}
function recordValue(value: unknown): Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function toolResult(value: unknown): Record<string, unknown> { return { content:[{type:"text",text:JSON.stringify(value)}], structuredContent:value, isError:false } }
function writeResult(id: JsonRpcId, result: unknown): void { process.stdout.write(`${JSON.stringify({jsonrpc:"2.0",id,result})}\n`) }
function writeError(id: JsonRpcId, code: number, message: string): void { process.stdout.write(`${JSON.stringify({jsonrpc:"2.0",id,error:{code,message}})}\n`) }
