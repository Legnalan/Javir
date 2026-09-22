import test from "node:test";
import assert from "node:assert/strict";
import { createObject, initialScene, serializeScene, validScene } from "../src/scene-model.js";

test("la escena inicial tiene objetos y relaciones", () => {
  assert.equal(initialScene.schemaVersion, 1);
  assert.equal(initialScene.objects.length, 6);
  assert.equal(initialScene.relations.length, 5);
  assert.equal(new Set(initialScene.objects.map((object) => object.z)).size > 1, true);
});

test("crear objeto conserva tipo y genera metadatos", () => {
  const object = createObject({ id: "auth", title: "Autenticación", type: "service" });
  assert.deepEqual(
    { id: object.id, title: object.title, type: object.type, color: object.color, z: object.z },
    { id: "auth", title: "Autenticación", type: "service", color: "cyan", z: 72 }
  );
});

test("serializar y validar una escena mantiene el contrato", () => {
  const scene = JSON.parse(serializeScene(initialScene));
  assert.equal(validScene(scene), true);
  assert.equal(validScene({ ...scene, schemaVersion: 99 }), false);
});
