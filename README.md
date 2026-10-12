# Javir

Javir es un espacio visual para entender y manipular la arquitectura de un proyecto de software. Al abrirse, carga en solo lectura el índice del propio repositorio Javir y convierte sus carpetas, símbolos e imports observados en un holograma navegable; después podrá recibir cámara, voz, proveedores de IA y superficies espaciales.

## Estado

MVP v0.1 en construcción.

**Nuevo laboratorio solar (2026-09-06):** botón **Sistema solar**, renderizado Three.js/WebGL con mallas esféricas, iluminación y anillos 3D y oclusión corporal aproximada para hasta cuatro personas. Colocación manual sobre la mesa en el video; todavía sin detección automática de superficies ni anclaje al mover la cámara. La guía completa y los límites comprobados están en [Maqueta solar](docs/maqueta-solar.md). Este modo incorpora el detector corporal; las referencias a falta de segmentación más abajo describen el grafo de arquitectura.

La entrega actual ya incluye:

- escena de arquitectura con objetos seleccionables y relaciones visibles;
- inspector lateral con identidad, origen, tipo y acciones del objeto;
- mover objetos con arrastre o con botones de teclado;
- comandos escritos y reconocimiento de voz opcional del navegador;
- cámara opcional como fondo de referencia, con permiso explícito;
- seguimiento local de hasta dos manos con MediaPipe, selección directa por índice, acción contextual **Detalle** y arrastre por pinza de una sola mano (índice + pulgar juntos) sobre la selección;
- navegación con cámara Three.js: puño para orbitar, dos pellizcos para zoom, garra para trasladar el diagrama, V para enfoque y pulgar arriba para recentrar;
- presentación holográfica azul: cámara más visible, controles compactos, tarjetas translúcidas y conexiones con brillo cian para distinguir el índice del proyecto;
- zoom mediante dos pellizcos, sin modificar las posiciones individuales de los cuadros;
- guardar, cargar y deshacer la escena en almacenamiento local;
- adaptador local de solo lectura para mapear repositorios dentro de `Documents/GitHub`, con exclusiones y muestras visibles.
- detección inicial de imports y símbolos JavaScript/TypeScript para enriquecer relaciones observadas.
- visor de fragmentos de código vinculado a las referencias del mapa, sin operaciones de escritura.

## Navegación 3D del mapa

El mapa de arquitectura utiliza Three.js con cámara en perspectiva, conexiones y volúmenes 3D. Arrastra el fondo para orbitar, usa clic derecho para desplazar y la rueda para acercar. Haz clic en el fondo para activar WASD (avanzar y moverse lateralmente), Q/E (bajar/subir), Shift (acelerar), F (enfocar selección) y R (recentrar cámara). Los botones permiten enfocar, ver desde arriba y restaurar toda la vista. Arrastrar un cuadro mueve únicamente ese objeto sobre su plano, incluso después de girar la cámara. El sistema solar conserva su renderizador WebGPU.

## Invocar la escena

El diagrama y el sistema solar empiezan ocultos, incluso al cargar una escena guardada. Activa **Cámara y gestos**, muestra una palma abierta con los cinco dedos extendidos y mantenla quieta durante un segundo. Un aro junto a la mano muestra el progreso; al completarlo aparece el escenario elegido. Cambia de postura antes de seleccionar o mover. Perder la mano, cambiar de mano o moverla demasiado reinicia la cuenta. Al cambiar con los botones o crear una sesión nueva, debes invocar otra vez. Con un escenario ya invocado, haz un **barrido lateral con la palma abierta** para recorrer diagrama, sistema solar y Aventador. Desplaza la mano al menos un 25% del ancho en unos 120–650 ms; no hace falta llegar al borde. Recoge los dedos antes de otro barrido. La **garra solo mueve el modelo**, incluso al alcanzar el borde o lanzarlo; abrir la mano añade inercia de hasta 650 ms. La transición respeta movimiento reducido y conserva los ajustes. El barrido ya no retira cards del diagrama.


## Sonidos de interacción

Sonidos suaves de holograma acompañan la carga e invocación, selección, toma y liberación, zoom, órbita y confirmación de comandos. Se sintetizan localmente con Web Audio y se habilitan tras el primer clic o tecla; no requieren descargas de audio. El icono de altavoz arriba a la derecha permite silenciarlos y recuerda la preferencia. Mantener un gesto no repite su sonido. Si el navegador bloquea el audio, los controles visuales siguen disponibles.

## Gestos actuales del mapa

- Índice: selecciona un objeto.
- Dos índices apuntando: seleccionan varios objetos a la vez, uno por mano, en el diagrama y en el sistema solar. Un solo índice vuelve a selección individual.
- Pellizco de índice y pulgar: arrastra únicamente el objeto seleccionado previamente con esa mano.
- Garra con dedos parcialmente cerrados, sin formar puño: toma y desplaza todo el modelo en X/Y. Abre la mano para soltar.
- Puño cerrado: mueve la mano para girar la cámara alrededor del mapa.
- Dos pellizcos: sepáralos para acercar y júntalos para alejar. No requieren selección y conservan las posiciones de los objetos. Abre ambos antes de volver al arrastre individual.
- V con índice y medio, los demás recogidos: mantenla estable 0.75 s para enfocar la selección o el grupo seleccionado (F).
- Pulgar arriba con los otros dedos recogidos: mantenlo estable 1.1 s para restaurar la vista completa (recentrar), sin cambiar las posiciones individuales.
- Mano abierta: libera la cámara y el modelo. Los comandos sostenidos se ejecutan una sola vez hasta cambiar de gesto.

Empieza directamente con el índice extendido o la garra; el mapa toma control con una detección estable durante un cuarto de segundo. También puedes tomar control con puño, V o pulgar arriba. Los controles de cámara se aplican al mapa Three.js; el sistema solar conserva sus gestos de selección, pellizco y garra.

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

La cámara no es requisito para usar la escena. Al iniciar una sesión nueva, Javir intenta cargar automáticamente el repositorio inicial configurado mediante el adaptador local de solo lectura; el botón **Analizar proyecto** permite volver a generar el índice. Para la primera prueba gestual, activa **Gestos**, permite la cámara y extiende únicamente el dedo índice sobre una card: la card se selecciona y aparece **Detalle**. Activa ese botón para abrir el inspector lateral; después une índice y pulgar sin importar la posición de los otros dedos para mover la card seleccionada. Los otros tres dedos pueden estar extendidos o recogidos; si no existe selección gestual previa, la pinza no mueve nada. Para desplazar el lienzo completo, forma una garra parcial y mueve la mano en X/Y. Para orbitar, cierra el puño y mueve la mano; para zoom, separa o junta dos pellizcos. Una V estable durante 0.75 s enfoca la selección y el pulgar arriba estable durante 1.1 s recentra la vista. Abre la mano para soltar; estos comandos no cambian posiciones individuales. Dos pellizcos controlan únicamente el zoom, incluso si hay dos cuadros seleccionados. La profundidad del lienzo es ilustrativa: no mide físicamente la habitación. Consulta la [guía de prueba de gestos](docs/prueba-gestos.md).

El seguimiento utiliza `@mediapipe/tasks-vision` 1.0.1 y un modelo servido localmente desde `public/models`. Los fotogramas se procesan en el navegador y no se envían al servidor de Javir. El aviso de privacidad de MediaPipe indica que su runtime puede enviar métricas de uso y rendimiento a Google; esto deberá revisarse antes de una distribución pública. La IA todavía es un adaptador simulado: ninguna acción escribe código, ejecuta comandos, publica cambios o transmite el repositorio.

## Documentación

- [Especificación viva](docs/especificacion-viva.md)
- [Primera prueba de cámara y gestos](docs/prueba-gestos.md)
- [Diseño visual persistido](design-system/javir/MASTER.md)

## Deportivo y despiece

**Aventador** carga el modelo 3D local de Lamborghini Aventador de Arion Digital, conservando sus materiales y texturas. Invócala con la palma abierta durante un segundo o usa **Ver sin cámara**. Selecciona piezas con el índice, un clic o el listado del panel. Dos pellizcos separados acercan el modelo: entre 1.45× y 2.05× se abren los conjuntos; entre 2.05× y 2.85× se separan neumáticos, rines y frenos. Si seleccionas una rueda y superas 2.35×, la vista aísla sus tres componentes. Alejar ensambla nuevamente; **Ensamblar** también recupera piezas movidas. El mouse y el deslizador permiten probarlo sin cámara.

El carrusel recorre diagrama, sistema solar y deportivo en ambos sentidos con barrido lateral de palma abierta. El coche contiene 22 conjuntos seleccionables; las superficies se agrupan por región para el despiece. Los asientos, motor y frenos internos son ilustrativos; no es un despiece CAD oficial. Consulta la [atribución del modelo](public/models/aventador-LICENSE.md).
