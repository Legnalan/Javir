# Control con varias personas

Se detectan hasta seis manos y cuatro cuerpos. En el mapa, puedes empezar directamente con el índice o la garra: una detección estable durante un cuarto de segundo toma control. Después puedes seleccionar con el índice y arrastrar con una pinza de esa misma mano (índice y pulgar juntos). Muestra ambas palmas para habilitar también los gestos de dos manos, preferentemente sin otras manos en cuadro durante esta calibración. En la maqueta solar también puedes usar una mano: índice para elegir, pellizco para mover el planeta seleccionado y garra para mover todo el sistema.

En el mapa puedes retirar una mano y seguir seleccionando y arrastrando con la otra. Si una desaparece durante un gesto de dos pinzas, el gesto se pausa: muestra ambas manos o abre la pinza antes de iniciar un arrastre. En la maqueta solar, la selección y la garra funcionan con una sola mano. Usa «Tomar control» en la maqueta solar para reasignar las manos. En el grafo, el seguimiento se recupera automáticamente después de salir del encuadre; vuelve a seleccionar el objeto si se reasigna la mano.

La identidad es temporal y aproximada por posición, no reconocimiento personal. Cruces y oclusiones completas pueden requerir recalibración. No se garantiza distinguir personas cuyas manos se superponen.

El detector local EfficientDet Lite0 muestra recuadros de objetos en la maqueta solar. Estos no miden profundidad ni detectan planos físicos de la mesa. Se ejecuta como máximo una vez por segundo fuera del hilo de interacción; puede desactivarse si afecta el rendimiento.

Validación pendiente: prueba física con varias personas y manos cruzadas, iluminación variable y rendimiento sostenido de cámara.
