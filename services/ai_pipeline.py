import imagehash
from PIL import Image
import io
import requests
from ultralytics import YOLO
import numpy as np
from typing import List, Dict

# Load custom road damage model (YOLOv8 trained on infrastructure)
model = YOLO("best.pt")

# Mapping for the specialized classes (D00, D10, etc.)
# D00: Longitudinal Crack, D10: Transverse Crack, D20: Alligator Crack, D40: Pothole
DAMAGE_MAP = {
    0: "Longitudinal Crack",
    1: "Transverse Crack",
    2: "Lateral Crack",
    3: "Complex Crack",
    4: "Alligator Crack",
    5: "Pothole",
    6: "Manhole",
    7: "Blurred Line",
    8: "Faded Markings",
    9: "Obstruction"
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
        self.models = {
            "primary_damage": YOLO("best.pt"),
            # Placeholder for future models
            # "traffic_flow": None,
            # "road_signs": None
        }
        self.active_models = ["primary_damage"]

    def add_model(self, key: str, path: str):
        try:
            self.models[key] = YOLO(path)
            if key not in self.active_models:
                self.active_models.append(key)
            return True
        except:
            return False

    def analyze(self, image_data: bytes) -> Dict:
        try:
            img = Image.open(io.BytesIO(image_data))
            all_detections = []
            max_severity = 1
            
            for key in self.active_models:
                model = self.models[key]
                if not model: continue
                
                results = model(img, conf=0.25)
                for r in results:
                    for box in r.boxes:
                        cls_id = int(box.cls[0])
                        conf = float(box.conf[0])
                        
                        # Use DAMAGE_MAP if it's the primary damage model
                        if key == "primary_damage":
                            label = DAMAGE_MAP.get(cls_id, model.names[cls_id])
                            severity = 5 if cls_id == 5 else (4 if cls_id == 4 else 2)
                        else:
                            label = f"[{key}] {model.names[cls_id]}"
                            severity = 3
                            
                        all_detections.append({
                            "type": label,
                            "confidence": conf,
                            "severity": severity,
                            "bbox": box.xyxy[0].tolist(),
                            "source": key
                        })
                        max_severity = max(max_severity, severity)

            return {
                "status": "success",
                "detections": all_detections,
                "suggested_severity": max_severity,
                "active_pipeline": self.active_models,
                "model_version": "Ensemble-v2-MultiStage"
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
