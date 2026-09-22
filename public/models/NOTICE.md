# Modelo de seguimiento de mano

## Detector de objetos

`efficientdet_lite0_uint8.tflite`: modelo oficial de Google MediaPipe.
Origen: https://storage.googleapis.com/mediapipe-tasks/object_detector/efficientdet_lite0_uint8.tflite
Documentación: https://developers.google.com/edge/mediapipe/solutions/vision/object_detector
Se ejecuta localmente en un worker. Devuelve clases y recuadros, no profundidad ni máscaras de objetos. No guarda ni sube imágenes.

`hand_landmarker.task` proviene del modelo oficial Hand Landmarker de Google MediaPipe, variante `float16/1`.

- Origen: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`
- Runtime: `@mediapipe/tasks-vision` 1.0.1
- Licencia del runtime: Apache-2.0

El modelo y el runtime se sirven desde este proyecto. Los fotogramas de la cámara se procesan en el navegador y no se envían al servidor de Javir.

## Detector corporal de la maqueta solar

`pose_landmarker_lite.task`: modelo oficial Google MediaPipe Pose Landmarker Lite, float16/1.
Origen: https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
Se ejecuta localmente en un worker, con hasta cuatro poses y máscaras por persona. No reconoce identidades, no guarda ni sube imágenes. Los puntos 3D son relativos al cuerpo; la distancia a la cámara se aproxima por el tamaño de hombros, no es una medición del espacio.
