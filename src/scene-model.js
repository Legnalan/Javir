export const SCHEMA_VERSION = 1;

export const objectTypes = [
  { value: "application", label: "Aplicación", color: "violet" },
  { value: "api", label: "API", color: "blue" },
  { value: "module", label: "Módulo", color: "green" },
  { value: "database", label: "Base de datos", color: "amber" },
  { value: "external", label: "Externo", color: "rose" },
  { value: "service", label: "Servicio", color: "cyan" }
];

export const initialScene = {
  schemaVersion: SCHEMA_VERSION,
  name: "Arquitectura de facturación",
  objects: [
    {
      id: "app",
      type: "application",
      title: "App escritorio",
      subtitle: "Surface / Mac",
      x: 15,
      y: 35,
      z: -120,
      color: "violet",
      status: "active",
      description: "Superficie donde la persona explora el mapa y emite comandos.",
      sourceRefs: ["src/surfaces/mac"]
    },
    {
      id: "api",
      type: "api",
      title: "API Gateway",
      subtitle: "HTTP / REST",
      x: 30,
      y: 35,
      z: -55,
      color: "blue",
      status: "active",
      description: "Punto de entrada para las operaciones del sistema.",
      sourceRefs: ["src/api/routes"]
    },
    {
      id: "billing",
      type: "module",
      title: "Facturación",
      subtitle: "Core domain",
      x: 51,
      y: 35,
      z: 10,
      color: "green",
      status: "attention",
      description: "Módulo de ejemplo con reglas de negocio y dependencias.",
      sourceRefs: ["src/billing", "docs/decisions/0001-billing.md"]
    },
    {
      id: "sql",
      type: "database",
      title: "SQL Server",
      subtitle: "Persistence",
      x: 72,
      y: 23,
      z: 115,
      color: "amber",
      status: "active",
      description: "Almacén persistente detectado por el adaptador simulado.",
      sourceRefs: ["src/infrastructure/sql"]
    },
    {
      id: "sat",
      type: "external",
      title: "SAT",
      subtitle: "External / CFDI",
      x: 72,
      y: 60,
      z: 115,
      color: "rose",
      status: "external",
      description: "Servicio externo que recibe o valida información fiscal.",
      sourceRefs: ["src/integrations/sat"]
    },
    {
      id: "reports",
      type: "service",
      title: "Reportes",
      subtitle: "Read model",
      x: 51,
      y: 72,
      z: 72,
      color: "cyan",
      status: "new",
      description: "Servicio agregado a la escena para explorar una nueva relación.",
      sourceRefs: ["demo://command/agrega-reportes"]
    }
  ],
  relations: [
    { id: "app-api", from: "app", to: "api", label: "solicita" },
    { id: "api-billing", from: "api", to: "billing", label: "orquesta" },
    { id: "billing-sql", from: "billing", to: "sql", label: "persiste" },
    { id: "billing-sat", from: "billing", to: "sat", label: "timbrado" },
    { id: "billing-reports", from: "billing", to: "reports", label: "expone datos" }
  ]
};

export function cloneScene(scene) {
  return structuredClone(scene);
}

export function findObject(scene, id) {
  return scene.objects.find((object) => object.id === id) || null;
}

export function createObject({ id, title, type = "module", x = 52, y = 82, z = 72 }) {
  const metadata = objectTypes.find((entry) => entry.value === type) || objectTypes[2];
  return {
    id,
    type: metadata.value,
    title,
    subtitle: metadata.label,
    x,
    y,
    z,
    color: metadata.color,
    status: "new",
    description: "Objeto creado desde la superficie de escena.",
    sourceRefs: ["local://scene"]
  };
}

export function serializeScene(scene) {
  return JSON.stringify({ ...scene, schemaVersion: SCHEMA_VERSION }, null, 2);
}

export function validScene(candidate) {
  return Boolean(
    candidate &&
    candidate.schemaVersion === SCHEMA_VERSION &&
    Array.isArray(candidate.objects) &&
    Array.isArray(candidate.relations)
  );
}
