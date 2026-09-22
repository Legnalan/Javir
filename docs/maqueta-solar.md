# Maqueta solar experimental · 2026-09-06

## Qué está implementado

Un modo alternativo al grafo de código: Sol y ocho planetas, órbitas animadas, anillos de Saturno, perspectiva e iluminación. Son esferas analíticas intersectadas por rayos, no tarjetas giradas. TypeGPU 0.12.4 administra el dispositivo y el buffer uniforme tipado; un shader WGSL interoperable con WebGPU dibuja la escena. Las proporciones y velocidades son ilustrativas.

Se muestra sobre el video en la pantalla: una webcam no proyecta luz físicamente sobre la mesa.

## Probarlo

1. Ejecuta `npm install` y `npm start`. El arranque compila los dos módulos de la maqueta con esbuild. Después de editar esos módulos ejecuta `npm run build:solar` y recarga.
2. Abre http://localhost:4173 en Brave o Chrome con WebGPU disponible. Pulsa **Sistema solar** y **Cámara y gestos**.
3. Apunta la cámara hacia una mesa y mantenla fija. Pulsa **Colocar en mesa** y haz clic en su centro, o mantén el índice en ese punto durante un segundo.
4. Abre **Ajustar superficie y cuerpos**: ajusta inclinación, distancia y tamaño para alinear la maqueta con la mesa.
5. Activa **Mostrar siluetas detectadas**. Comprueba que cubren a las personas, luego desactívalo.
6. De frente o de perfil, la maqueta permanece delante de tu cuerpo. Dar la espalda durante unos 450 ms habilita la oclusión para esa persona; se conserva la comparación de distancia estimada. **Ocultar planetas solo al dar la espalda** puede desmarcarse para mantener la maqueta siempre delante. Prueba primero con una persona y después con dos.
7. **Volver al grafo** libera el renderizador y el detector corporal. La escena del repositorio conserva sus datos. La cámara y el seguimiento de manos pueden seguir activos; apágalos desde Controles.

## Gestos y alternativa manual

- Un puño y la otra palma abierta fija: breve calibración de 350 ms; el puño gira en tres ejes y desplaza la maqueta. Si se mueve la palma, se recalibra. Un puño solo no activa giro.
- Dos palmas abiertas: desplazar.
- Dos pinzas que comienzan juntas: zoom general; dos pinzas separadas: tomar dos planetas diferentes.
- Índice: seleccionar; pinza estricta (índice y pulgar juntos, tres dedos arriba) sobre el planeta: arrastrar. Se toma el planeta bajo la pinza.
- Índice sobre Controles: abre el menú del workspace.
- Ratón: arrastrar planeta o fondo, Shift + arrastrar para girar, rueda para zoom. Pausar órbitas facilita la selección de los planetas pequeños.

## Cuerpos y oclusión

MediaPipe Pose Landmarker Lite detecta hasta cuatro poses y produce máscaras por persona. Se procesa en un worker clásico con WASM/CPU y video reducido a 640 px, como máximo unas seis capturas por segundo. El worker compone un mapa de profundidad de hasta 256 px de ancho. Los gestos mantienen su detector independiente y el renderizado se limita a unos 30 FPS y 1280 px de ancho.

La distancia absoluta no viene del modelo: se aproxima con el ancho de hombros, suponiendo 40 cm y una focal estimada. Los puntos relativos del cuerpo ajustan la profundidad local de la máscara. Antes de componerla se aplica una regla por postura: hombros y caderas deben indicar espalda con visibilidad suficiente durante 450 ms. De frente, perfil o postura dudosa, esa persona no aporta profundidad oclusora; su máscara sigue disponible para diagnóstico. La asociación espacial entre cuadros evita depender del orden de las poses. El shader compara la profundidad habilitada con cada esfera/anillo/órbita: un cuerpo cercano de espaldas puede ocultar el fragmento; uno lejano no. Las máscaras caducan a los 650 ms para no dejar siluetas fantasma al perder el seguimiento. No se identifican personas.

Esta regla expresa la interacción solicitada, no determina físicamente quién cruzó el plano de la mesa: dar la espalda no demuestra un cambio de profundidad. Si la postura falla, desmarca la oclusión para fijar toda la maqueta delante.

La estimación puede fallar con niños, personas de perfil, hombros ocultos, poca luz o cuerpos superpuestos. El ajuste de profundidad es global; todavía no hay calibración individual. El worker se detiene al salir del modo o apagar la cámara. Los fotogramas y máscaras no se guardan ni se suben; modelo, WASM y bundles se sirven desde el proyecto.

## Límites y siguiente fase

- La mesa se coloca manualmente. No se detecta automáticamente el plano más cercano.
- El anclaje está en la imagen, no en coordenadas persistentes de la habitación. Si mueves la cámara debes volver a colocar la maqueta.
- No hay profundidad métrica, reconstrucción de muebles, oclusión por objetos no humanos ni seguimiento del punto de vista de los ojos.
- Siguiente fase: adaptador de superficie/profundidad con capacidades explícitas; WebXR hit-test y depth-sensing cuando el dispositivo los ofrezca, o marcador visual calibrado para webcam. Después, estudiar profundidad monocular y seguimiento visual con una prueba de estabilidad antes de activar colocación automática.
- La segmentación corporal está integrada en el modo solar, no en el grafo de arquitectura.

## Verificación de esta entrega

- Pruebas unitarias de órbitas, proyección, recorte y espejo del video, estimación corporal y comparación de profundidad.
- Brave automatizado con WebGPU: shader compilado y renderizado sin errores de aplicación; giro combinado, bloqueo de puño aislado, pausa por deriva de palma y zoom probados con entradas sintéticas.
- Prueba de píxeles del renderizador: alfa del Sol = 255 sin cuerpo; 0 con cuerpo delante; 255 con cuerpo detrás.
- Detector real sobre una composición de dos imágenes de ejemplo oficiales de MediaPipe: dos personas y mapa de profundidad no vacío.
- Cámara real en Brave: video visible, gestos activos y estado del detector con dos personas. Sin errores de aplicación observados; MediaPipe emite avisos internos sobre proyección de landmarks.
- Pendiente: calibrar sobre una mesa real y validar que la oclusión siga correctamente los movimientos del usuario; rendimiento sostenido con cuatro personas y manos simultáneas.

## Fuentes

- TypeGPU: https://github.com/software-mansion/TypeGPU
- Interoperabilidad oficial: https://docs.swmansion.com/TypeGPU/integration/webgpu-interoperability/
- Poses y máscaras en web: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js
- Imagen de prueba oficial: https://developers.google.com/static/mediapipe/images/solutions/examples/pose_detector.png
