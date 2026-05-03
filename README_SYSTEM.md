# SafePath AI: Road Condition-Aware Routing System

A production-ready navigation application that prioritizes vehicle safety by avoiding reported road hazards (potholes) using PostGIS spatial analysis and real-world routing APIs.

## Tech Stack
- **Frontend**: React, Leaflet, Tailwind CSS 4
- **Backend**: Node.js, Express, PostgreSQL/PostGIS
- **APIs**: OpenRouteService (Routing), Nominatim (Geocoding)

---

## 1. Setup Instructions

### Prerequisites
- **PostgreSQL** installed with **PostGIS** extension.
- **Node.js** (v18+) and **npm**.

### Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on the template below.
4. Start the server:
   ```bash
   node index.js
   ```
   *The server will automatically initialize the database and create the `potholes` table.*

### Frontend Setup
1. Navigate to the `frontend-node` directory:
   ```bash
   cd frontend-node
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

---

## 2. Environment Variables (`backend/.env`)

Required variables for the backend:

```env
PORT=5000
DB_USER=your_postgres_user
DB_HOST=localhost
DB_DATABASE=road_safety
DB_PASSWORD=your_password
DB_PORT=5432
ORS_API_KEY=your_openrouteservice_api_key
```

### Obtaining an ORS API Key
1. Sign up at [OpenRouteService Dashboard](https://openrouteservice.org/dev/#/signup).
2. Create a free API Key.
3. Paste it into the `ORS_API_KEY` field in `.env`.

---

## 3. How It Works Internally

### Safety-Aware Routing Logic
1. **Request**: The user selects a destination. The frontend sends the start/end coordinates to the backend.
2. **Fetch Routes**: The backend calls the **OpenRouteService API** to get up to 3 candidate routes (fastest, shortest, etc.).
3. **Spatial Analysis**: For each route, the backend generates a 50m "buffer" around the route geometry using PostGIS.
4. **Scoring**: It queries the `potholes` table to find all hazards within that buffer:
   ```sql
   SELECT COUNT(*), SUM(severity) FROM potholes WHERE ST_DWithin(location, route_path, 50)
   ```
5. **Ranking**: Routes are scored based on hazard density and severity. The route with the lowest hazard count is flagged as "Safest".
6. **Visualization**: The frontend renders the routes. If a route has hazards, it is colored red; otherwise, it is blue.

### Real-Time Reporting
- Users can click the "plus" button to report a pothole.
- The report includes GPS coordinates, a severity scale (1-5), and a description.
- New reports are immediately persisted and reflected on the map for all users.

---

## 4. Verification & Testing

### Test API Endpoints
- **Health Check**: `GET http://localhost:5000/health`
- **List Potholes**: `GET http://localhost:5000/api/potholes`
- **Sample Route Request**:
  ```bash
  curl -X POST http://localhost:5000/api/route \
    -H "Content-Type: application/json" \
    -d '{"start": [8.681495, 49.41461], "end": [8.687872, 49.420318]}'
  ```

### Manual Testing
1. Open the frontend in your browser.
2. Use the search panel to enter a start and destination (e.g., "New York City" to "Brooklyn").
3. Verify that the map zooms to the route.
4. Click the "Report Pothole" button and add a hazard along the route path.
5. Search for the same route again and observe the updated "Hazard Count" and safety rating.
