# Alive Navigation: The Intelligent Road Safety Ecosystem

Alive Navigation is a dual-platform solution designed to bridge the gap between commuters and municipal authorities. Unlike traditional GPS services, Alive Navigation focuses on "Suspension Safety," using a specialized intelligence layer to calculate the "Cost of Damage" for various routes.

## 🚀 Overview

The project consists of three main components:
1.  **Backend API**: A FastAPI service that handles hazard reports, telemetry, and intelligent routing.
2.  **Citizen HUD**: A mobile-first Vite application for commuters to navigate and report hazards in real-time.
3.  **Government Dashboard**: A management portal for authorities to monitor road health and coordinate repairs.

## ✨ Key Features

*   **Suspension-Aware Routing**: Dynamic navigation that avoids high-wear road segments and optimizes for vehicle longevity.
*   **AI Hazard Detection**: Real-time identification of road damage (potholes, cracks) using computer vision.
*   **Real-time GPS Telemetry**: Track route adherence and vehicle state in real-time.
*   **Government Oversight**: Data-driven heatmaps and clustering to help municipalities prioritize infrastructure repairs.
*   **Psychological Safety Stats**: Displays "Suspension Safety Index" and "Estimated Wear Cost" to inform driver decisions.

## 🛠️ Technology Stack

### AI & Intelligence
*   **Model**: **YOLOv8** (You Only Look Once) custom-trained for infrastructure damage.
*   **Detection Classes**: Longitudinal Crack, Transverse Crack, Alligator Crack, Potholes, Manholes, and more.
*   **Ensemble Mediator**: A multi-stage pipeline (`AIMediator`) that aggregates detections and assigns severity scores.
*   **Deduplication**: Uses **Perceptual Hashing (pHash)** via `imagehash` to identify and merge duplicate hazard reports.

### Backend
*   **Framework**: FastAPI (Python)
*   **Pathfinding**: Custom **A* Algorithm** on a weighted grid system.
*   **Database**: SQLAlchemy with SQLite.
*   **Communication**: WebSockets for live telemetry and report synchronization.

### Frontend
*   **Framework**: React (Vite)
*   **Styling**: Tailwind CSS
*   **Maps**: Leaflet / OpenStreetMap / Overpass API

## 📦 Installation

### 1. Navigation Engine & Backend Setup
```bash
# Navigate to root directory
cd rd

# Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies (includes ultralytics, fastapi, sqlalchemy)
pip install -r requirements.txt

# Seed the database with initial road data
python seed_db.py

# Run the server
python main.py
```
*Note: Ensure `best.pt` is in the root directory for the AI models to load.*

### 2. Frontend Setup (Citizen & Gov)
Run both apps in separate terminals:
```bash
# Citizen App
cd frontend/citizen-app && npm install && npm run dev

# Gov Dashboard
cd frontend/gov-dashboard && npm install && npm run dev
```

## 🎮 Usage: Real-Time Detection

1.  **Start the Engine**: Ensure the Backend API is running.
2.  **Launch Citizen HUD**: Open the Citizen App and grant Location permissions.
3.  **Report Hazards**:
    *   Click the **"Report"** icon.
    *   Upload or capture a photo of the road damage.
    *   The **AI Pipeline** will automatically classify the damage type (e.g., "Pothole") and suggest a severity score.
4.  **Smart Navigation**:
    *   Enter a destination.
    *   Select your **Vehicle Type** (Bike, Car, or Truck).
    *   Choose a **Route Mode**:
        *   `SMOOTHEST`: Maximize suspension protection.
        *   `FASTEST`: Standard speed-optimized routing.
        *   `SAFE_AT_NIGHT`: Avoids deep potholes in low-visibility conditions.

## 📄 License

This project is licensed under the **MIT License** - see the `LICENSE` file for details.

---
*Created with ❤️ for a safer, smoother commute.*
