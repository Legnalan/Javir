# Javir — especificación viva

Versión inicial: 0.1 · 2026-09-04 · estado: construcción

## Propósito

Javir ayuda a una persona desarrolladora a ver la arquitectura de un sistema como una escena: módulos, servicios, repositorios y dependencias tienen identidad, posición, relaciones y referencias verificables.

## Alcance de este primer spike

1. Mac como superficie inicial mediante una aplicación web local.
2. Escena 2D con modelo estable de objetos y relaciones.
3. Selección por puntero y alternativa de teclado.
4. Comandos cerrados para crear, mover, seleccionar, guardar y deshacer.
5. Cámara opcional y local; la escena sigue operando sin cámara.
6. Adaptador local de solo lectura para mapear un repositorio real dentro de `Documents/GitHub`.
7. Visor de fragmentos de código con ruta, líneas y origen local para respaldar cada referencia.
8. Detección inicial de símbolos e imports JavaScript/TypeScript para distinguir relaciones observadas de señales inferidas.
9. Seguimiento local de hasta dos manos en cámara, selección espacial por índice, acción contextual **Detalle** y arrastre 2D mediante pinza de una sola mano sobre la card seleccionada.
10. Manipulador espacial aproximado con dos manos abiertas que traslada, orbita y acerca/aleja el diagrama completo dentro de un volumen virtual; la heurística usa tamaño relativo de manos, separación y posición, con suavizado y recentrado, sin afirmar profundidad física medida.
11. Zoom general continuo de rango amplio (10%-500%) cuando dos pinzas comienzan muy juntas; si comienzan separadas, cada pinza puede tomar y mover una card distinta. Cualquier puño cerrado estable controla una manipulación 3D acumulativa mediante pitch, yaw, roll y traslación espacial, sin limitar el giro a una sola vuelta; también se conserva el retiro reversible mediante barrido horizontal corto.
12. La sesión inicial carga automáticamente el índice local del propio repositorio Javir mediante el adaptador de solo lectura. La superficie usa cámara más visible, controles compactos y tarjetas/conexiones con tratamiento holográfico azul para priorizar la prueba espacial.

## Orden de evolución

P0 definición → P1 superficie Mac → P2 escena → P3 interacción → P4 análisis de repositorio → P5 inteligencia → P6 display externo → P7 visionOS.

## Límites de seguridad

El MVP no lee secretos, no ejecuta comandos por voz, no modifica archivos y no envía código a un proveedor externo. La cámara requiere permiso explícito; sus fotogramas se procesan dentro del navegador y no se envían al servidor de Javir. MediaPipe declara telemetría de uso/rendimiento del runtime, por lo que deberá evaluarse su configuración o sustitución antes de distribuir el producto. Cada integración futura deberá declarar permisos, destino del contexto y nivel de riesgo antes de operar.

## Decisiones registradas

- `Javir` se conserva como nombre de trabajo.
- La escena es la fuente de verdad compartida por UI, voz, gestos e IA.
- La cámara es opcional y no debe bloquear ventas, navegación ni análisis.
- El modelo usa IDs estables y referencias a fuentes para distinguir hechos de inferencias.
- El escáner puede ampliar su cobertura por lenguaje, pero sus regex actuales son evidencia heurística y no sustituyen un parser ni un análisis semántico completo.
- El conjunto gestual usa el índice extendido sólo para seleccionar, ofrece **Detalle** para abrir el inspector, usa una pinza individual estricta —índice y pulgar juntos, medio/anular/meñique arriba— para mover la selección, dos manos abiertas para manipular globalmente el lienzo, dos pinzas que comienzan muy juntas para zoom general, dos pinzas que comienzan separadas para mover dos cards independientes, y cualquier puño cerrado —todos los dedos recogidos— para orbitar y desplazar espacialmente de forma acumulativa. El índice se valida con los otros dedos recogidos y una pinza sin selección previa no mueve cards; la pinza no se activa si los tres dedos de apoyo no están arriba, evitando confundirla con el puño. El manipulador de puño usa suavizado, calibración, traslación X/Y, cambio relativo de tamaño para profundidad estimada y pitch/yaw/roll acumulativos; una vez calibrado puede continuar aunque la mano cambie de posición o se use la otra mano. El manipulador de dos manos mantiene suavizado, calibración/recentrado, traducción, ángulo entre manos y tamaño relativo de palmas para producir profundidad estimada, no tracking físico de la habitación. El barrido exige dirección única, duración y distancia mínimas; la órbita por puño cruza continuamente 360 grados sin clamp visual de una vuelta. El zoom y los movimientos se agrupan en una sola operación de historial; el retiro, la órbita, el desplazamiento por puño y el manipulador también pueden deshacerse.

## Próxima decisión

Elegir un repositorio pequeño de prueba distinto de Javir y comparar el mapa generado con su estructura real antes de conectar inteligencia externa.
