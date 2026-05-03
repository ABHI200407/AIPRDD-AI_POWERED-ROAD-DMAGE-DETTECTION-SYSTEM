from fastapi import FastAPI, File, UploadFile, HTTPException
from ultralytics import YOLO
import io
from PIL import Image
import numpy as np

app = FastAPI(title="Road Sentinel AI Engine")

# Load the custom YOLOv8 model
# Note: Ensure best.pt is in the same directory as this app.py on Hugging Face
try:
    model = YOLO("best.pt")
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

@app.get("/")
def read_root():
    return {"message": "Road Sentinel AI Engine is Live on Hugging Face Spaces."}

@app.post("/detect")
async def detect_damage(file: UploadFile = File(...)):
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded on server.")

    try:
        # Read image bytes
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # Run YOLOv8 inference
        results = model.predict(source=image, conf=0.25)
        
        detections = []
        top_class = "unknown"
        max_conf = 0
        
        # Process results
        for result in results:
            for box in result.boxes:
                cls_id = int(box.cls[0])
                label = model.names[cls_id]
                conf = float(box.conf[0])
                
                # Simple severity mapping based on class or confidence
                # (You can refine this logic based on your specific model classes)
                severity = 3
                if conf > 0.8: severity = 5
                elif conf > 0.6: severity = 4
                
                detections.append({
                    "class_name": label,
                    "confidence": round(conf, 2),
                    "severity_score": severity
                })
                
                if conf > max_conf:
                    max_conf = conf
                    top_class = label

        return {
            "status": "success",
            "detections": detections,
            "top_class": top_class,
            "count": len(detections)
        }

    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "detections": [],
            "top_class": "unknown"
        }
