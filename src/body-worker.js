import { FilesetResolver, PoseLandmarker, ObjectDetector } from '@mediapipe/tasks-vision';
import { composeBodyDepth, updateBodyOccluders } from './solar-math.js';
let detector;
let objectsDetector, lastObjectAt=-Infinity;
let bodyTracks=[];
const canvas = new OffscreenCanvas(640, 360);
const context = canvas.getContext('2d');
self.onmessage = async ({data}) => {
  try {
    if (data.type === 'init') {
      const files = await FilesetResolver.forVisionTasks(data.origin+'/node_modules/@mediapipe/tasks-vision/wasm');
      detector = await PoseLandmarker.createFromOptions(files, {
        baseOptions:{modelAssetPath:data.origin+'/public/models/pose_landmarker_lite.task', delegate:'CPU'},
        runningMode:'VIDEO', numPoses:4, outputSegmentationMasks:true,
        minPoseDetectionConfidence:.55, minPosePresenceConfidence:.55
      });
      try {
        objectsDetector=await ObjectDetector.createFromOptions(files,{
          baseOptions:{modelAssetPath:data.origin+'/public/models/efficientdet_lite0_uint8.tflite',delegate:'CPU'},
          runningMode:'VIDEO',scoreThreshold:.5,maxResults:12,categoryDenylist:['person']
        });
      } catch(error){self.postMessage({type:'objects-error',message:error.message});}
      self.postMessage({type:'ready'});
    } else if (data.type === 'frame' && detector) {
      const frame=data.frame;
      canvas.width=frame.width; canvas.height=frame.height;
      context.drawImage(frame,0,0); frame.close();
      if(objectsDetector && data.objects && data.timestamp-lastObjectAt>1000){
        lastObjectAt=data.timestamp;
        try {
          const result=objectsDetector.detectForVideo(canvas,data.timestamp);
          const detections=result.detections.map(d=>({label:d.categories[0].categoryName,score:d.categories[0].score,
            x:1-(d.boundingBox.originX+d.boundingBox.width)/canvas.width,y:d.boundingBox.originY/canvas.height,
            width:d.boundingBox.width/canvas.width,height:d.boundingBox.height/canvas.height}));
          self.postMessage({type:'objects',detections,timestamp:data.timestamp});
        } catch(error){objectsDetector.close();objectsDetector=null;self.postMessage({type:'objects-error',message:error.message});}
      }
      detector.detectForVideo(canvas,data.timestamp,(result)=> {
        const masks=(result.segmentationMasks || []).map(mask=>({width:mask.width,height:mask.height,data:mask.getAsFloat32Array().slice()}));
        bodyTracks=updateBodyOccluders(result.landmarks,bodyTracks,data.timestamp,canvas.width/canvas.height);
        const depth=composeBodyDepth(result.landmarks,masks,canvas.width/canvas.height,data.focal??1.25,data.bodyScale??1,bodyTracks.map(track=>track.occludes));
        self.postMessage({type:'result',timestamp:data.timestamp,people:result.landmarks.length,occludingPeople:bodyTracks.filter(track=>track.occludes).length,depth},[depth.data.buffer]);
      });
    } else data.frame?.close();
  } catch(error) { data.frame?.close(); self.postMessage({type:'error',message:error.message}); }
};
