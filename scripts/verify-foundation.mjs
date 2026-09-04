import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requiredFiles = [
  "LICENSE",
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "tsconfig.base.json",
  "docs/DECISIONS.md",
  "docs/PRODUCT_BOUNDARY.md",
  "docs/PACKAGE_BOUNDARIES.md",
  "docs/BENCHMARK_METHODOLOGY.md",
  "docs/PHASE_STATUS.md",
  "design-system/facet/MASTER.md",
  "benchmarks/corpus/manifest.json",
];

const workspacePackages = [
  "packages/protocol",
  "packages/renderer",
  "packages/core",
  "packages/cli",
  "apps/review",
  "apps/docs",
  "services/share",
];

const failures = [];

for (const file of requiredFiles) {
  try {
    await access(resolve(root, file));
  } catch {
    failures.push(`Missing required file: ${file}`);
  }
}

for (const workspace of workspacePackages) {
  try {
    const manifest = JSON.parse(
      await readFile(resolve(root, workspace, "package.json"), "utf8"),
    );
    if (manifest.private !== true) {
      failures.push(`${workspace} must stay private until the public release phase`);
    }
    await access(resolve(root, workspace, "src/index.ts"));
  } catch (error) {
    failures.push(`Invalid workspace ${workspace}: ${error.message}`);
  }
}

try {
  const corpus = JSON.parse(
    await readFile(resolve(root, "benchmarks/corpus/manifest.json"), "utf8"),
  );
  if (corpus.frozen !== true) failures.push("Benchmark corpus must be frozen");
  if (corpus.artifacts?.length !== 20) {
    failures.push(`Benchmark corpus must contain 20 artifacts; found ${corpus.artifacts?.length ?? 0}`);
  }
  const ids = corpus.artifacts?.map((artifact) => artifact.id) ?? [];
  if (new Set(ids).size !== ids.length) failures.push("Benchmark artifact IDs must be unique");
  for (const artifact of corpus.artifacts ?? []) {
    for (const key of ["id", "title", "category", "requiredNodes", "interactions", "revision1", "revision2"]) {
      if (!artifact[key] || artifact[key].length === 0) {
        failures.push(`Artifact ${artifact.id ?? "<unknown>"} is missing ${key}`);
      }
    }
  }
} catch (error) {
  failures.push(`Invalid benchmark corpus: ${error.message}`);
}

try {
  const plan = await readFile(resolve(root, "docs/IMPLEMENTATION_AND_DEPLOYMENT_PLAN.md"), "utf8");
  const phaseHeadings = [...plan.matchAll(/^### Phase \d+ —/gm)];
  if (phaseHeadings.length !== 7) {
    failures.push(`Implementation plan must contain exactly 7 phases; found ${phaseHeadings.length}`);
  }
} catch (error) {
  failures.push(`Cannot verify implementation plan: ${error.message}`);
}

if (failures.length > 0) {
  console.error("Foundation verification failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Foundation verification passed: 7 workspaces, 7 phases, 20 frozen artifact briefs.");
}
