import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { SCANNER_LIMITS, scanRepository } from "./src/repository-scanner.mjs";

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));
const githubRoot = resolve(process.env.JAVIR_GITHUB_ROOT || join(homedir(), "Documents/GitHub"));
const defaultRepository = resolve(process.env.JAVIR_DEFAULT_REPO || projectRoot);
const port = Number(process.env.PORT || 4173);
const excludedPathParts = new Set([".codebase-memory", ".git", "node_modules", ".next", "dist", "build", "coverage", "target", "vendor"]);
const sensitiveFileExtensions = new Set([".key", ".pem", ".p12", ".pfx", ".cer", ".crt"]);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".txt": "text/plain; charset=utf-8"
};

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

function isInside(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

async function allowedRepositoryPath(requestUrl) {
  const url = new URL(requestUrl, "http://localhost");
  const requested = url.searchParams.get("path") || defaultRepository;
  const candidate = await realpath(resolve(requested));
  const realGithubRoot = await realpath(githubRoot);
  return isInside(realGithubRoot, candidate) ? candidate : null;
}

function isSafeSourcePath(relativePath) {
  const parts = relativePath.split(/[\\/]+/).filter(Boolean);
  const fileName = parts.at(-1)?.toLowerCase() || "";
  return Boolean(parts.length) && !parts.includes("..") && !parts.some((part) => excludedPathParts.has(part) || part.startsWith(".env")) && !sensitiveFileExtensions.has(extname(fileName));
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

async function readSourceSnippet(requestUrl) {
  const url = new URL(requestUrl, "http://localhost");
  const repositoryPath = await allowedRepositoryPath(requestUrl);
  const relativePath = url.searchParams.get("file") || "";
  if (!repositoryPath || !isSafeSourcePath(relativePath)) return { status: 403, body: { error: "Archivo no permitido" } };

  const candidate = resolve(repositoryPath, relativePath);
  const sourcePath = await realpath(candidate);
  if (!isInside(repositoryPath, sourcePath)) return { status: 403, body: { error: "El archivo está fuera del repositorio" } };
  const sourceStat = await stat(sourcePath);
  if (!sourceStat.isFile()) return { status: 400, body: { error: "La referencia no es un archivo" } };
  if (sourceStat.size > SCANNER_LIMITS.maxFileBytes) return { status: 413, body: { error: "El archivo supera el límite de lectura" } };

  const content = await readFile(sourcePath, "utf8");
  const lines = content.split(/\r?\n/);
  const requestedStart = Number(url.searchParams.get("start") || 1);
  const requestedEnd = Number(url.searchParams.get("end") || Math.min(lines.length, 180));
  const start = clamp(Number.isFinite(requestedStart) ? requestedStart : 1, 1, Math.max(1, lines.length));
  const end = clamp(Number.isFinite(requestedEnd) ? requestedEnd : start + 179, start, Math.min(lines.length, start + 179));
  return {
    status: 200,
    body: {
      repositoryPath,
      file: relative(repositoryPath, sourcePath).split(sep).join("/"),
      language: extname(sourcePath).slice(1) || "text",
      startLine: start,
      endLine: end,
      totalLines: lines.length,
      content: lines.slice(start - 1, end).join("\n")
    }
  };
}

function safePath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const candidate = normalize(join(projectRoot, requestedPath));
  return isInside(projectRoot, candidate) ? candidate : null;
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url?.startsWith("/api/health")) {
    json(response, 200, { ok: true, mode: "local-read-only", project: "Javir" });
    return;
  }

  if (request.method === "GET" && request.url?.startsWith("/api/config")) {
    json(response, 200, { project: "Javir", mode: "local-read-only", defaultRepository, githubRoot });
    return;
  }

  if (request.method === "GET" && request.url?.startsWith("/api/analyze")) {
    try {
      const repositoryPath = await allowedRepositoryPath(request.url);
      if (!repositoryPath) {
        json(response, 403, { error: "Solo se permiten repositorios dentro de la carpeta local configurada" });
        return;
      }
      const result = await scanRepository(repositoryPath);
      json(response, 200, result);
    } catch (error) {
      const status = error.code === "ENOENT" ? 404 : 400;
      json(response, status, { error: error.message || "No fue posible analizar el repositorio" });
    }
    return;
  }

  if (request.method === "GET" && request.url?.startsWith("/api/source")) {
    try {
      const result = await readSourceSnippet(request.url);
      json(response, result.status, result.body);
    } catch (error) {
      const status = error.code === "ENOENT" ? 404 : 400;
      json(response, status, { error: error.message || "No fue posible leer el archivo" });
    }
    return;
  }

  const filePath = safePath(request.url || "/");

  if (!filePath) {
    response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    response.end("Ruta no permitida");
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      "cache-control": "no-cache",
      "content-type": contentTypes[extname(filePath)] || "application/octet-stream"
    });
    response.end(file);
  } catch (error) {
    const status = error.code === "ENOENT" ? 404 : 500;
    response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
    response.end(status === 404 ? "No encontrado" : "Error interno del servidor");
  }
});

server.listen(port, () => {
  console.log(`Javir disponible en http://localhost:${port}`);
});
