# Javir — primera prueba de cámara y gestos

## Objetivo

Comprobar que una persona puede apuntar directamente a cualquier card con el índice, abrir su detalle, moverla con una pinza de una sola mano, hacer zoom general o mover dos cards con dos manos, orbitar la cámara en 3D y retirar una card con un barrido reversible.

## Preparación

1. Ejecuta `npm start` y abre `http://localhost:4173`.
2. Confirma que la escena muestre **Índice · Javir**; el mapa se carga automáticamente desde el repositorio local en solo lectura.
3. Presiona **Gestos** y concede permiso de cámara cuando el navegador lo solicite.
4. Coloca una mano completa frente a la cámara, aproximadamente a una distancia de brazo. Para probar los modos de dos manos, prepara después dos pinzas visibles.

La vista usa un área de cámara amplia y controles compactos para que las manos y el fondo sean más visibles. Las cards del índice se muestran como nodos holográficos azules; el color de tipo se conserva en la etiqueta y en el inspector.

## Prueba principal

1. Espera el estado **Mano detectada** y confirma que aparece el esqueleto sobre la imagen.
2. Extiende únicamente el dedo índice sobre una card distinta a la selección actual.
3. Confirma el estado **Índice: [card]**, que la card quedó seleccionada sin moverse y que aparece el botón **Detalle**.
4. Activa **Detalle** y confirma que se abre el inspector lateral con identidad, posición, relaciones y origen.
5. Mantén la selección y junta pulgar e índice de una sola mano, dejando medio, anular y meñique extendidos hacia arriba.
6. Confirma **Pinza activa**, mueve la mano lentamente y abre los dedos para soltar. Si recoges los tres dedos, la pinza se cancela y esa postura se reserva para el puño de órbita.
7. Presiona **Deshacer** para confirmar que Javir conserva un único paso de historial por movimiento gestual.

## Resultado esperado

- La cámara se muestra como fondo espejado.
- El esqueleto de la mano sigue los movimientos sin bloquear la selección de objetos.
- El índice sobre una card la selecciona directamente, aunque otra card estuviera seleccionada.
- La selección por índice ocurre sin cerrar la pinza.
- Al extender el índice sobre una card, la card se selecciona pero no se mueve con el dedo.
- El botón **Detalle** abre el inspector sin desmontar ni alterar el diagrama.
- Una pinza individual válida exige índice y pulgar juntos, con medio, anular y meñique arriba; mueve únicamente la card seleccionada previamente por el índice.
- Un puño cerrado exige los cinco dedos recogidos; no se interpreta como pinza y queda reservado para orbitar.
- Una pinza sin selección gestual previa no mueve una card por accidente.
- El objeto deja de moverse al abrir los dedos o perder la mano durante varios cuadros.
- Arrastre, teclado y botones del inspector siguen funcionando.

## Zoom general y movimiento de dos cards

1. Junta pulgar e índice en ambas manos, manteniendo los otros tres dedos arriba, y comienza con las dos pinzas muy cerca entre sí.
2. Confirma el estado **Zoom general** y la línea punteada entre ambas pinzas.
3. Separa las dos pinzas para ampliar toda la escena y acércalas para reducirla; no cambia el tamaño de una card individual.
4. Para mover dos cards, reinicia el gesto con las pinzas separadas y coloca cada una sobre una card distinta.
5. Confirma **Dos cards en movimiento**, mueve ambas manos y abre las pinzas para soltar.
6. Al retirar una mano, la operación de dos manos termina y el zoom queda en su último valor.

El zoom por botones y gestos usa un rango amplio de **10% a 500%**: permite convertir el diagrama en una vista general muy pequeña y regresar a un acercamiento grande sin quedar atrapado en el límite anterior.

## Manipulador espacial aproximado

1. Pulsa el botón de recentrado espacial para partir de una referencia limpia.
2. Presenta dos manos abiertas y mantenlas como si sujetaras una pelota durante unos cuadros.
3. Confirma **Preparando volumen espacial** y espera **Manipulador de escena**.
4. Mueve el punto medio de ambas manos para trasladar el diagrama completo; cambia el ángulo entre las manos para orbitar y modifica su separación para acercar o alejar la escena.
5. Confirma el indicador **Delante** o **Detrás** como una señal visual aproximada, no como una medición física de profundidad.
6. Abre o pierde una mano para terminar la manipulación; el cambio completo queda disponible en **Deshacer**.

## Barrido lateral para retirar una card

1. Coloca el cursor de una mano sobre una card y espera su resaltado azul.
2. Abre completamente la mano y haz un barrido corto de izquierda a derecha o de derecha a izquierda, sin regresar en la misma trayectoria.
3. Mantén el barrido entre 80 y 650 ms y recorre al menos una quinta parte del ancho normalizado de la escena.
4. Confirma el estado **Barrido completado** y que desaparecieron la card y sus relaciones.
5. Usa **Deshacer** para restaurar la card y sus relaciones.

## Manipulador espacial por puño

1. Cierra el puño con todos los dedos recogidos y colócalo visible frente a la cámara, sin apuntar a una card.
2. Manténlo estable aproximadamente cinco cuadros.
3. Confirma **Preparando manipulador 3D**; la mano que uses funciona como anclaje inicial.
4. Confirma **Manipulador espacial por puño**. Gira la muñeca para orbitar y mueve el puño para desplazar el diagrama en X/Y; cambia la distancia a la cámara para producir profundidad estimada.
5. Pitch, yaw y roll se acumulan en el holograma y el contador puede cruzar 360° sin reiniciarse. Usa **Deshacer** para revertir toda la sesión de manipulación.

## Límites actuales

- Índice para seleccionar y abrir **Detalle**; pinza individual de índice + pulgar con tres dedos arriba para mover la selección; dos manos abiertas para manipular el lienzo completo; dos pinzas muy juntas al iniciar para zoom general; dos pinzas separadas al iniciar para mover dos cards; cualquier puño cerrado con todos los dedos recogidos para orbitar y desplazar espacialmente de forma acumulativa; barrido lateral corto para retirar.
- Seguimiento objetivo de 15 cuadros por segundo para reducir carga.
- El movimiento de cards sigue siendo 2D; la órbita usa orientación acumulativa del puño, perspectiva del lienzo y cards orientadas hacia la cámara.
- La iluminación baja, el contraluz o una mano parcialmente fuera del encuadre reducen la estabilidad.
- La profundidad y el volumen son estimaciones heurísticas, no tracking físico de la habitación; no se promete que el usuario quede medido delante o detrás del diagrama.
- La oclusión de persona no está habilitada en este MVP porque el paquete local sólo incluye el modelo de manos; el fallback mantiene visible la cámara y no bloquea la escena.
- El cálculo de MediaPipe ocurre de forma síncrona en el hilo de la interfaz; una fase posterior deberá moverlo a un Web Worker si afecta la fluidez.
