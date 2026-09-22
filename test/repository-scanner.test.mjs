import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanRepository } from "../src/repository-scanner.mjs";

test("escanea archivos permitidos y excluye credenciales/directorios pesados", async () => {
    const root = await mkdtemp(join(tmpdir(), "javir-scanner-"));
  try {
    await mkdir(join(root, "src"));
    await mkdir(join(root, "model"));
    await mkdir(join(root, "node_modules"));
    await writeFile(join(root, "model", "model.js"), "export function getModel() { return 'ok'; }");
    await writeFile(join(root, "src", "api-route.js"), "import { getModel } from '../model/model.js';\nexport const route = () => getModel();");
    await writeFile(join(root, ".env"), "TOKEN=secret");
    await writeFile(join(root, "node_modules", "ignored.js"), "ignored");
    const result = await scanRepository(root);
    assert.equal(result.summary.files, 2);
    assert.equal(result.scene.objects.some((object) => object.title === "src"), true);
    assert.equal(result.summary.excluded >= 2, true);
    assert.equal(result.summary.symbols >= 2, true);
    assert.equal(result.summary.imports >= 1, true);
    assert.equal(result.scene.analysis.observedRelationCount >= 1, true);
    assert.equal(result.scene.analysis.repoPath, root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
