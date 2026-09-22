# Control con varias personas

Se detectan hasta seis manos y cuatro cuerpos. Solo las dos manos fijadas controlan la escena: muestra tus dos palmas abiertas durante un segundo, preferentemente sin otras manos en cuadro durante esta calibración.

Mantén ambas manos visibles. Si una desaparece se pausa el control, sin convertir el zoom en un arrastre. Usa «Tomar control» en la maqueta solar para reasignar las manos. En el grafo puedes apagar y encender los gestos para recalibrar.

La identidad es temporal y aproximada por posición, no reconocimiento personal. Cruces y oclusiones completas pueden requerir recalibración. No se garantiza distinguir personas cuyas manos se superponen.

El detector local EfficientDet Lite0 muestra recuadros de objetos en la maqueta solar. Estos no miden profundidad ni detectan planos físicos de la mesa. Se ejecuta como máximo una vez por segundo fuera del hilo de interacción; puede desactivarse si afecta el rendimiento.

Validación pendiente: prueba física con varias personas y manos cruzadas, iluminación variable y rendimiento sostenido de cámara.
