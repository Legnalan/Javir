# Javir — primera prueba de cámara y gestos

## Objetivo

Comprobar que una persona puede apuntar directamente a cualquier card con el índice, abrir su detalle, moverla con una pinza de una sola mano, tomar y desplazar todo el modelo con una garra, seleccionar varias cards apuntando con ambos índices y hacer zoom general y retirar una card con un barrido reversible.

## Preparación

1. Ejecuta `npm start` y abre `http://localhost:4173`.
2. Confirma que el escenario esté vacío y muestre la instrucción de invocación. El índice local se carga en segundo plano, pero sus objetos permanecen ocultos.
3. Presiona **Gestos** y concede permiso de cámara cuando el navegador lo solicite.
4. Muestra una palma abierta con los cinco dedos extendidos y mantenla quieta durante un segundo. Confirma el aro de progreso y la aparición del diagrama. Cambia a índice o garra antes de manipularlo. Repite en Sistema solar y al volver al grafo: cada cambio exige una invocación nueva.
5. Comprueba que retirar la mano antes de completar el segundo, recoger el pulgar o moverla demasiado cancela la cuenta; mantener la palma después de invocar no mueve objetos. Abrirla posteriormente libera el control sin ocultar la escena.

La vista usa un área de cámara amplia y controles compactos para que las manos y el fondo sean más visibles. Las cards del índice se muestran como nodos holográficos azules; el color de tipo se conserva en la etiqueta y en el inspector.

## Prueba principal

1. Espera el estado **Mano detectada** y confirma que aparece el esqueleto sobre la imagen.
2. Extiende únicamente el dedo índice sobre una card distinta a la selección actual.
3. Confirma el estado **Índice: [card]**, que la card quedó seleccionada sin moverse y que aparece el botón **Detalle**.
4. Activa **Detalle** y confirma que se abre el inspector lateral con identidad, posición, relaciones y origen.
5. Mantén la selección y junta pulgar e índice de una sola mano, con los otros tres dedos en cualquier posición.
6. Confirma **Pinza activa**, mueve la mano lentamente y abre los dedos para soltar. Los otros tres dedos pueden recogerse sin soltar la pinza. Separa índice y pulgar para soltar; la garra parcialmente cerrada toma el modelo completo.
7. Presiona **Deshacer** para confirmar que Javir conserva un único paso de historial por movimiento gestual.

## Resultado esperado

- La cámara se muestra como fondo espejado.
- El esqueleto de la mano sigue los movimientos sin bloquear la selección de objetos.
- El índice sobre una card la selecciona directamente, aunque otra card estuviera seleccionada.
- La selección por índice ocurre sin cerrar la pinza.
- Al extender el índice sobre una card, la card se selecciona pero no se mueve con el dedo.
- El botón **Detalle** abre el inspector sin desmontar ni alterar el diagrama.
- Una pinza individual válida exige únicamente índice y pulgar juntos; mueve únicamente la card seleccionada previamente por el índice.
- Un puño cerrado gira la cámara del mapa; no arrastra objetos. La garra traslada el modelo y conserva los dedos parcialmente cerrados.
- Una pinza sin selección gestual previa no mueve una card por accidente.
- El objeto deja de moverse al abrir los dedos o perder la mano durante varios cuadros.
- Arrastre, teclado y botones del inspector siguen funcionando.

## Selección múltiple con dos índices

1. Apunta a una card distinta con cada índice. Confirma **Selección múltiple: 2 objetos** y ambos resaltados.
2. Cambia una mano a pellizco: debe mover solamente el objeto que esa mano seleccionó.
3. Haz pellizco con ambas manos: debe hacer zoom sin mover ninguno de los objetos seleccionados.
4. Apunta con un solo índice para volver a selección individual. Apuntar con ambos al mismo objeto debe contar una sola selección.
5. Repite con dos planetas en el sistema solar. En el diagrama, F o una V sostenida encuadran el grupo seleccionado.

## Zoom con dos pellizcos

1. Junta índice y pulgar en ambas manos, sin exigir posición a los otros dedos.
2. Confirma **Dos pellizcos: zoom**, aunque no tengas selección o haya dos objetos seleccionados.
3. Separa lentamente las manos para acercar; júntalas para alejar. Los cuadros y planetas conservan sus posiciones individuales.
4. Abre ambos pellizcos antes de volver a mover una selección con un solo pellizco. Perder una mano no debe arrastrar una selección por accidente.

## Tomar el modelo con garra

1. Con la mano que tomó control, dobla parcialmente los dedos como si sostuvieras una pelota pequeña; no cierres el puño ni hagas pellizco.
2. Espera **Modelo tomado con garra**; al reconocerla, la toma empieza sin exigir cinco cuadros inmóviles.
3. Mueve la mano para desplazar el modelo completo horizontal y verticalmente. Los objetos conservan sus posiciones dentro del modelo.
4. Abre la mano para soltar. El desplazamiento queda disponible en **Deshacer**.
5. Este gesto no requiere seleccionar un objeto previamente. El pellizco sí requiere una selección previa con el índice de esa mano.

## Cámara 3D y comandos F / recentrar

1. Cierra una mano en puño y muévela horizontal/verticalmente. Confirma **Puño: girando la vista**. Las posiciones individuales no cambian.
2. Muestra dos puños: sepáralos para acercar y júntalos para alejar. Confirma **Dos puños: zoom**. Abre una mano para salir del zoom; el puño restante empieza una órbita con un nuevo punto inicial, sin salto.
3. Selecciona un cuadro con el índice. Forma una V (índice y medio extendidos, anular y meñique recogidos) y mantenla inmóvil 0.75 s. El porcentaje llega a 100% y aparece **Selección enfocada**.
4. Mantener la V no debe repetir el enfoque. Cambia de postura antes de repetir; si no hay selección, muestra **Selecciona primero un cuadro**.
5. Para recentrar, recoge los cuatro dedos y levanta el pulgar hacia arriba durante 1.1 s. Confirma **Vista recentrada**. El mapa completo vuelve al encuadre, sin cambiar posiciones de objetos.
6. La mano abierta suelta el control y no retira cuadros en la vista Three.js. Perder la mano cancela los puntos iniciales y el progreso de comandos, para retomar sin saltos.
7. Los nuevos controles de cámara corresponden al mapa de arquitectura; el sistema solar conserva su controlador propio.

## Barrido lateral para retirar una card (vista anterior, sin Three.js)

1. Coloca el cursor de una mano sobre una card y espera su resaltado azul.
2. Abre completamente la mano y haz un barrido corto de izquierda a derecha o de derecha a izquierda, sin regresar en la misma trayectoria.
3. Mantén el barrido entre 80 y 650 ms y recorre al menos una quinta parte del ancho normalizado de la escena.
4. Confirma el estado **Barrido completado** y que desaparecieron la card y sus relaciones.
5. Usa **Deshacer** para restaurar la card y sus relaciones.

## Límites actuales

- Índice para seleccionar; pellizco para arrastrar únicamente la selección previa; garra para desplazar el modelo completo. Dos pellizcos hacen zoom, sin mover selecciones.
- Seguimiento objetivo de 15 cuadros por segundo para reducir carga.
- El arrastre de objetos y el desplazamiento del modelo con garra operan en X/Y. La garra no cambia la rotación ni la profundidad.
- La iluminación baja, el contraluz o una mano parcialmente fuera del encuadre reducen la estabilidad.
- La profundidad y el volumen son estimaciones heurísticas, no tracking físico de la habitación; no se promete que el usuario quede medido delante o detrás del diagrama.
- La oclusión de persona no está habilitada en este MVP porque el paquete local sólo incluye el modelo de manos; el fallback mantiene visible la cámara y no bloquea la escena.
- El cálculo de MediaPipe ocurre de forma síncrona en el hilo de la interfaz; una fase posterior deberá moverlo a un Web Worker si afecta la fluidez.

## Alternar escenarios con palma y carrusel

1. Invoca un modelo y cambia de postura para manipularlo.
2. Con Controles cerrado, abre la palma y barre hacia izquierda o derecha. Recorre al menos un 25% del ancho en 120–650 ms; no necesitas alcanzar el borde.
3. Verifica el carrusel entre diagrama, sistema solar y Aventador en ambos sentidos.
4. Recoge los dedos antes de otro barrido. Mantener la palma abierta o perder tracking no encadena cambios.
5. La garra mueve el modelo y nunca lo cambia, incluso al llegar al borde o lanzarlo. Abrir la mano conserva el deslizamiento con fricción.
6. Confirma que un barrido en el diagrama no retira cards. Movimientos pequeños, lentos, verticales y de dos manos no cambian de modelo.
7. Movimiento reducido desactiva las animaciones y la inercia, conservando el cambio.

Pendiente: validar físicamente con cámara real; las pruebas automatizadas usan detecciones controladas.
