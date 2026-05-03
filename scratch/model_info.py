from ultralytics import YOLO

model = YOLO("best.pt")
print(f"Model Task: {model.task}")
print(f"Model Type: {type(model.model)}")
print(f"Model Names: {model.names}")
print(f"Model Overrides: {model.overrides}")
