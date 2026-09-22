import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, extname, join, normalize, relative, sep } from "node:path";

export const SCANNER_LIMITS = {
  maxDepth: 6,
  maxFiles: 500,
  maxFileBytes: 220_000,
  maxSamples: 18,
  maxSampleBytes: 40_000
};

const ignoredDirectories = new Set([
  ".git",
  ".codebase-memory",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target",
  "vendor"
]);

const sensitiveNames = new Set([".env", ".env.local", ".env.production", "id_rsa", "id_ed25519"]);
const sensitiveExtensions = new Set([".key", ".pem", ".p12", ".pfx", ".cer", ".crt"]);
const sampleExtensions = new Set([".c", ".cpp", ".cs", ".css", ".gd", ".go", ".html", ".java", ".js", ".json", ".jsx", ".md", ".mjs", ".php", ".py", ".rs", ".sql", ".swift", ".ts", ".tsx", ".vue"]);

function isSensitive(name) {
  const lowerName = name.toLowerCase();
  return sensitiveNames.has(lowerName) || lowerName.startsWith(".env.") || sensitiveExtensions.has(extname(lowerName));
}

function isIgnoredDirectory(name) {
  return ignoredDirectories.has(name) || name.startsWith(".");
}

function typeForDirectory(name) {
  const lowerName = name.toLowerCase();
  if (/api|route|controller|endpoint/.test(lowerName)) return "api";
  if (/data|database|db|persistence|repository|storage/.test(lowerName)) return "database";
  if (/integration|external|adapter|connector/.test(lowerName)) return "external";
  if (/service|worker|job/.test(lowerName)) return "service";
  return "module";
}

function signalForPath(path) {
  const value = path.toLowerCase();
  if (/api|route|controller|endpoint|http/.test(value)) return { type: "api", title: "Interfaces / API", subtitle: "Signal from paths" };
  if (/sql|database|db|repository|persistence|entity|prisma|migration/.test(value)) return { type: "database", title: "Persistencia", subtitle: "Signal from paths" };
  if (/integration|external|connector|sat|stripe/.test(value)) return { type: "external", title: "Integraciones", subtitle: "Signal from paths" };
  return null;
}

async function walk(directory, root, depth, result) {
  if (depth > SCANNER_LIMITS.maxDepth || result.files.length >= SCANNER_LIMITS.maxFiles) return;
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (result.files.length >= SCANNER_LIMITS.maxFiles) break;
    const absolutePath = join(directory, entry.name);
    const relativePath = relative(root, absolutePath) || entry.name;

    if (entry.isDirectory()) {
      if (isIgnoredDirectory(entry.name)) {
        result.excluded.push({ path: relativePath, reason: "directorio excluido" });
        continue;
      }
      await walk(absolutePath, root, depth + 1, result);
      continue;
    }

    if (!entry.isFile()) continue;
    if (isSensitive(entry.name)) {
      result.excluded.push({ path: relativePath, reason: "posible secreto o credencial" });
      continue;
    }

    const fileStat = await stat(absolutePath);
    if (fileStat.size > SCANNER_LIMITS.maxFileBytes) {
      result.excluded.push({ path: relativePath, reason: "archivo mayor al límite" });
      continue;
    }

    result.files.push({ path: relativePath.split(sep).join("/"), extension: extname(entry.name).toLowerCase(), bytes: fileStat.size });
  }
}

async function readSamples(root, files) {
  const samples = [];
  for (const file of files) {
    if (samples.length >= SCANNER_LIMITS.maxSamples) break;
    if (!sampleExtensions.has(file.extension)) continue;
    if (file.extension === ".json") continue;
    try {
      const content = await readFile(join(root, file.path), "utf8");
      samples.push({ path: file.path, content: content.slice(0, SCANNER_LIMITS.maxSampleBytes) });
    } catch {
      // Un archivo que no pueda leerse no bloquea el mapa del resto del proyecto.
    }
  }
  return samples;
}

function extractCodeStructure(filePath, content) {
  const symbols = new Set();
  const symbolPattern = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g;
  for (const match of content.matchAll(symbolPattern)) symbols.add(match[1] || match[2]);

  const imports = new Set();
  const importPatterns = [
    /import\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    /export\s+[\s\S]*?\s+from\s+["']([^"']+)["']/g
  ];
  importPatterns.forEach((pattern) => {
    for (const match of content.matchAll(pattern)) imports.add(match[1]);
  });
  return { path: filePath, symbols: [...symbols].slice(0, 80), imports: [...imports].slice(0, 80) };
}

function resolveImportPath(fromPath, importPath, knownFiles) {
  if (!importPath.startsWith(".")) return null;
  const base = normalize(join(dirname(fromPath), importPath)).split(sep).join("/");
  const candidates = [base, `${base}.js`, `${base}.mjs`, `${base}.ts`, `${base}.tsx`, `${base}.jsx`, `${base}/index.js`, `${base}/index.ts`];
  return candidates.find((candidate) => knownFiles.has(candidate)) || null;
}

function addRelation(relations, relation) {
  if (!relations.some((existing) => existing.id === relation.id)) relations.push(relation);
}

function createScene(repoPath, result, samples) {
  const projectName = basename(repoPath);
  const rootObject = {
    id: "repo-root",
    type: "application",
    title: projectName,
    subtitle: "Repositorio analizado",
    x: 12,
    y: 46,
    color: "violet",
    status: "active",
    description: "Raíz del repositorio inspeccionado en modo solo lectura.",
    sourceRefs: ["."]
  };

  const topLevel = new Map();
  for (const file of result.files) {
    const [firstSegment] = file.path.split("/");
    const key = file.path.includes("/") ? firstSegment : "(raíz)";
    if (!topLevel.has(key)) topLevel.set(key, []);
    topLevel.get(key).push(file);
  }

  const groups = [...topLevel.entries()].slice(0, 8);
  const objects = [rootObject];
  const relations = [];
  const groupByFile = new Map();
  const groupGap = groups.length > 1 ? 64 / (groups.length - 1) : 0;

  groups.forEach(([name, files], index) => {
    const id = `group-${index}`;
    const object = {
      id,
      type: name === "(raíz)" ? "module" : typeForDirectory(name),
      title: name === "(raíz)" ? "Archivos raíz" : name,
      subtitle: `${files.length} archivo${files.length === 1 ? "" : "s"}`,
      x: groups.length > 4 ? 32 + (index % 3) * 18 : groups.length === 1 ? 48 : 30 + index * groupGap,
      y: groups.length > 4 ? 28 + Math.floor(index / 3) * 42 : 46,
      color: typeForDirectory(name) === "database" ? "amber" : typeForDirectory(name) === "api" ? "blue" : typeForDirectory(name) === "external" ? "rose" : "green",
      status: "active",
      description: `Grupo de primer nivel detectado en ${projectName}.`,
      sourceRefs: files.slice(0, 3).map((file) => file.path),
      evidenceKind: "observed",
      symbols: [],
      imports: []
    };
    objects.push(object);
    files.forEach((file) => groupByFile.set(file.path, id));
    relations.push({ id: `repo-root-${id}`, from: rootObject.id, to: id, label: "contiene" });
  });

  const knownFiles = new Set(result.files.map((file) => file.path));
  const structures = samples.filter((sample) => /\.(c|cpp|cs|gd|go|java|js|jsx|mjs|php|py|rs|swift|ts|tsx|vue)$/.test(sample.path)).map((sample) => extractCodeStructure(sample.path, sample.content));
  let symbolCount = 0;
  let importCount = 0;
  let observedRelationCount = 0;
  structures.forEach((structure) => {
    const sourceGroupId = groupByFile.get(structure.path);
    const sourceObject = objects.find((object) => object.id === sourceGroupId);
    if (!sourceObject) return;
    sourceObject.symbols.push(...structure.symbols.map((name) => ({ name, source: structure.path })));
    symbolCount += structure.symbols.length;
    structure.imports.forEach((importPath) => {
      const resolvedPath = resolveImportPath(structure.path, importPath, knownFiles);
      if (!resolvedPath) return;
      importCount += 1;
      sourceObject.imports.push({ source: structure.path, target: resolvedPath });
      const targetGroupId = groupByFile.get(resolvedPath);
      if (!targetGroupId || targetGroupId === sourceGroupId) return;
      const relation = { id: `import-${sourceGroupId}-${targetGroupId}`, from: sourceGroupId, to: targetGroupId, label: "importa" };
      if (!relations.some((existing) => existing.id === relation.id)) observedRelationCount += 1;
      addRelation(relations, relation);
    });
  });

  const signals = [];
  const pathText = result.files.map((file) => file.path).join("\n");
  const sampleText = samples.map((sample) => sample.content).join("\n");
  const allText = `${pathText}\n${sampleText}`.toLowerCase();
  const signalRules = [
    { type: "api", pattern: /api|route|controller|endpoint|http/, title: "Interfaces / API" },
    { type: "database", pattern: /sql|database|db|repository|persistence|entity|prisma|migration/, title: "Persistencia" },
    { type: "external", pattern: /integration|external|connector|sat|stripe/, title: "Integraciones" }
  ];
  signalRules.forEach((rule) => {
    if (rule.pattern.test(allText)) signals.push({ ...rule, subtitle: "Signal from paths" });
  });

  signals.slice(0, 3).forEach((signal, index) => {
    const id = `signal-${signal.type}`;
    const object = {
      id,
      type: signal.type,
      title: signal.title,
      subtitle: signal.subtitle,
      x: 86,
      y: 16 + index * 31,
      color: signal.type === "database" ? "amber" : signal.type === "api" ? "blue" : "rose",
      status: "attention",
      description: "Señal sugerida por nombres de rutas o archivos; requiere validación humana.",
      evidenceKind: "inferred",
      symbols: [],
      imports: [],
      sourceRefs: result.files.filter((file) => signalForPath(file.path)?.type === signal.type || samples.some((sample) => sample.path === file.path && signal.pattern.test(sample.content.toLowerCase()))).slice(0, 3).map((file) => file.path)
    };
    if (object.sourceRefs.length === 0) object.sourceRefs = [`heuristic://${signal.type}`];
    objects.push(object);
    const source = objects.find((item) => item.id.startsWith("group-")) || rootObject;
    relations.push({ id: `${source.id}-${id}`, from: source.id, to: id, label: "posible relación" });
  });

  return {
    schemaVersion: 1,
    name: `Índice · ${projectName}`,
    objects,
    relations,
    analysis: {
      repoPath,
      fileCount: result.files.length,
      excludedCount: result.excluded.length,
      excludedPaths: result.excluded.slice(0, 12),
      truncated: result.files.length >= SCANNER_LIMITS.maxFiles,
      samples: samples.map((sample) => sample.path),
      symbolCount,
      importCount,
      observedRelationCount,
      scannedAt: new Date().toISOString()
    }
  };
}

export async function scanRepository(repoPath) {
  const repositoryStat = await stat(repoPath);
  if (!repositoryStat.isDirectory()) throw new Error("La ruta indicada no es un directorio");

  const result = { files: [], excluded: [] };
  await walk(repoPath, repoPath, 0, result);
  const samples = await readSamples(repoPath, result.files);
  const scene = createScene(repoPath, result, samples);
  return {
    scene,
    summary: {
      path: repoPath,
      files: result.files.length,
      excluded: result.excluded.length,
      sampleFiles: samples.length,
      symbols: scene.analysis.symbolCount,
      imports: scene.analysis.importCount,
      limits: SCANNER_LIMITS,
      excludedPaths: result.excluded.slice(0, 20)
    }
  };
}
