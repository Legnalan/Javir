# Javir

Javir es un espacio visual para entender y manipular la arquitectura de un proyecto de software. Al abrirse, carga en solo lectura el índice del propio repositorio Javir y convierte sus carpetas, símbolos e imports observados en un holograma navegable; después podrá recibir cámara, voz, proveedores de IA y superficies espaciales.

## Estado

MVP v0.1 en construcción.

**Nuevo laboratorio solar (2026-09-06):** botón **Sistema solar**, renderizado TypeGPU/WebGPU y oclusión corporal aproximada para hasta cuatro personas. Colocación manual sobre la mesa en el video; todavía sin detección automática de superficies ni anclaje al mover la cámara. La guía completa y los límites comprobados están en [Maqueta solar](docs/maqueta-solar.md). Este modo incorpora el detector corporal; las referencias a falta de segmentación más abajo describen el grafo de arquitectura.

La entrega actual ya incluye:

- escena de arquitectura con objetos seleccionables y relaciones visibles;
- inspector lateral con identidad, origen, tipo y acciones del objeto;
- mover objetos con arrastre o con botones de teclado;
- comandos escritos y reconocimiento de voz opcional del navegador;
- cámara opcional como fondo de referencia, con permiso explícito;
- seguimiento local de hasta dos manos con MediaPipe, selección directa por índice, acción contextual **Detalle** y arrastre por pinza estricta de una sola mano (índice + pulgar juntos y tres dedos arriba) sobre la selección;
- manipulador espacial aproximado con dos manos abiertas: traslada, orbita y acerca/aleja el diagrama completo dentro de un volumen virtual estimado;
- presentación holográfica azul: cámara más visible, controles compactos, tarjetas translúcidas y conexiones con brillo cian para distinguir el índice del proyecto;
- zoom general continuo de amplio rango (10%-500%) cuando dos pinzas comienzan muy juntas, movimiento simultáneo de dos cards cuando las pinzas comienzan separadas, manipulación 3D acumulativa con el giro y desplazamiento de cualquier puño cerrado y retiro reversible mediante un barrido horizontal sobre el objetivo;
- guardar, cargar y deshacer la escena en almacenamiento local;
- adaptador local de solo lectura para mapear repositorios dentro de `Documents/GitHub`, con exclusiones y muestras visibles.
- detección inicial de imports y símbolos JavaScript/TypeScript para enriquecer relaciones observadas.
- visor de fragmentos de código vinculado a las referencias del mapa, sin operaciones de escritura.

## Ejecutar

Requiere Node.js 18 o posterior.

```bash
npm install
npm start
```

Después abre [http://localhost:4173](http://localhost:4173).

Comprobaciones disponibles:

```bash
npm run check
npm test
```

## Dirección técnica

La app está escrita con HTML, CSS y JavaScript nativos para que el prototipo no dependa de un framework y sea fácil de portar a una app Mac o a una futura superficie visionOS. El modelo de escena vive separado de la interfaz en `src/scene-model.js`; el escáner local está en `src/repository-scanner.mjs` y combina señales inferidas con imports y símbolos observados mediante heurísticas acotadas.

El servidor expone endpoints locales `GET /api/analyze?path=...` y `GET /api/source?path=...&file=...`. El análisis devuelve conteos de archivos, exclusiones, muestras, símbolos e imports; las referencias de código se pueden abrir en el visor de solo lectura. Solo acepta rutas reales dentro de la carpeta local de proyectos configurada, ignora carpetas pesadas y posibles credenciales, y no tiene rutas de escritura. Puedes cambiar la raíz con `JAVIR_GITHUB_ROOT` y el repositorio inicial con `JAVIR_DEFAULT_REPO`.

La cámara no es requisito para usar la escena. Al iniciar una sesión nueva, Javir intenta cargar automáticamente el repositorio inicial configurado mediante el adaptador local de solo lectura; el botón **Analizar proyecto** permite volver a generar el índice. Para la primera prueba gestual, activa **Gestos**, permite la cámara y extiende únicamente el dedo índice sobre una card: la card se selecciona y aparece **Detalle**. Activa ese botón para abrir el inspector lateral; después une índice y pulgar manteniendo medio, anular y meñique arriba para mover la card seleccionada. Si los tres dedos se recogen, esa postura se clasifica como puño cerrado y no como pinza; si no existe selección gestual previa, la pinza no mueve nada. Para manipular el lienzo completo, presenta dos manos abiertas como si sujetaras una pelota y mantenlas estables unos cuadros; después traslada el punto medio, cambia el ángulo o acerca/aleja las manos. Para el manipulador espacial de una mano, cierra todos los dedos con cualquiera de las manos y espera la calibración; después gira la muñeca para orbitar y mueve el puño para desplazar el diagrama en X/Y o acercarlo/alejarlo por profundidad estimada. La rotación se acumula, cruza 360° y no se reinicia. Con dos manos en pinza, junta ambas muy cerca para controlar el zoom general; si comienzan separadas, coloca cada pinza sobre una card distinta para moverlas al mismo tiempo. Para retirar una card, apunta sobre ella y haz un barrido lateral corto con la mano abierta; la acción queda disponible en **Deshacer**. La profundidad del lienzo es una heurística visual basada en tamaño relativo de manos, separación y posición: no es medición física de la habitación. La segmentación de persona queda fuera de este MVP porque no hay un modelo estable local disponible; la aplicación degrada mostrando cámara y escena sin oclusión. Consulta la [guía de prueba de gestos](docs/prueba-gestos.md).

El seguimiento utiliza `@mediapipe/tasks-vision` 1.0.1 y un modelo servido localmente desde `public/models`. Los fotogramas se procesan en el navegador y no se envían al servidor de Javir. El aviso de privacidad de MediaPipe indica que su runtime puede enviar métricas de uso y rendimiento a Google; esto deberá revisarse antes de una distribución pública. La IA todavía es un adaptador simulado: ninguna acción escribe código, ejecuta comandos, publica cambios o transmite el repositorio.

## Documentación

- [Especificación viva](docs/especificacion-viva.md)
- [Primera prueba de cámara y gestos](docs/prueba-gestos.md)
- [Diseño visual persistido](design-system/javir/MASTER.md)
