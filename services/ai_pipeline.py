import imagehash
from PIL import Image
import io
import requests
from ultralytics import YOLO
import numpy as np
from typing import List, Dict

# Lazy-load road damage model to save RAM on startup
model = None

def get_yolo_model():
    global model
    if model is None:
        model = YOLO("best.pt")
    return model

# Mapping for the specialized RDD-India classes
DAMAGE_MAP = {
    0: "Longitudinal Crack",
    1: "Minor Longitudinal Crack",
    2: "Transverse Crack",
    3: "Minor Transverse Crack",
    4: "Alligator Crack",
    5: "Pothole",
    6: "Rutting/Manhole",
    7: "Blurred Line",
    8: "Faded Markings",
    9: "Road Marking Issue"
}

# Severity weights for different classes
SEVERITY_WEIGHTS = {
    0: 2, # Longitudinal Crack
    1: 1, # Minor Longitudinal Crack
    2: 2, # Transverse Crack
    3: 1, # Minor Transverse Crack
    4: 4, # Alligator Crack
    5: 5, # Pothole
    6: 3, # Rutting/Manhole
    7: 1, # Blurred Line
    8: 1, # Faded Markings
    9: 2  # Road Marking Issue
}

def get_image_hash(image_url: str) -> str:
    """
    Downloads an image and generates a perceptual hash (pHash).
    """
    try:
        if not image_url or not image_url.startswith('http'):
            return str(imagehash.phash(Image.new('RGB', (100, 100), color = 'red')))
            
        response = requests.get(image_url, timeout=5)
        response.raise_for_status()
        img = Image.open(io.BytesIO(response.content))
        return str(imagehash.phash(img))
    except Exception as e:
        return "0000000000000000"

def calculate_hash_difference(hash1_str: str, hash2_str: str) -> int:
    """
    Calculates the Hamming distance between two pHash strings.
    """
    try:
        h1 = imagehash.hex_to_hash(hash1_str)
        h2 = imagehash.hex_to_hash(hash2_str)
        return h1 - h2
    except:
        return 999

# Multi-Model AI Ensemble for Comprehensive Road Intelligence
class AIMediator:
    def __init__(self):
        self.models = {}
        self.active_models = ["primary_damage"]

    def get_model(self, key):
        if key not in self.models:
            if key == "primary_damage":
                self.models[key] = YOLO("best.pt")
        return self.models.get(key)

    def analyze(self, image_data: bytes) -> Dict:
        try:
            img = Image.open(io.BytesIO(image_data))
            img_w, img_h = img.size
            img_area = img_w * img_h
            
            all_detections = []
            max_severity = 1
            
            for key in self.active_models:
                model = self.get_model(key)
                if not model: continue
                
                results = model(img, conf=0.25)
                for r in results:
                    for box in r.boxes:
                        cls_id = int(box.cls[0])
                        conf = float(box.conf[0])
                        
                        # Get human-readable label
                        label = DAMAGE_MAP.get(cls_id, model.names[cls_id])
                        
                        # Calculate Severity
                        # 1. Base severity from class
                        base_severity = SEVERITY_WEIGHTS.get(cls_id, 2)
                        
                        # 2. Dynamic boost based on Bounding Box Area
                        # (Bigger damage = Higher severity)
                        b = box.xyxy[0].tolist()
                        bbox_area = (b[2] - b[0]) * (b[3] - b[1])
                        area_ratio = bbox_area / img_area
                        
                        severity = base_severity
                        if area_ratio > 0.05: # If damage takes > 5% of frame
                            severity = min(5, severity + 1)
                        if area_ratio > 0.15: # If damage takes > 15% of frame
                            severity = 5
                            
                        all_detections.append({
                            "type": label,
                            "confidence": round(conf, 2),
                            "severity": int(severity),
                            "bbox": b,
                            "source": key
                        })
                        max_severity = max(max_severity, severity)

            return {
                "status": "success",
                "detections": all_detections,
                "suggested_severity": int(max_severity),
                "active_pipeline": self.active_models,
                "model_version": "RDD-India-v1"
            }
        except Exception as e:
            return {"status": "error", "message": str(e), "suggested_severity": 3}

# Instantiate the mediator
ai_mediator = AIMediator()

def analyze_road_damage(image_data: bytes) -> Dict:
    """
    Entry point for road damage analysis.
    Delegates to the Multi-Model Mediator.
    """
    return ai_mediator.analyze(image_data)
