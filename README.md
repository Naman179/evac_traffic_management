# EVAC Congestion System — Production Web App

This repository wraps the existing EVAC ML research pipeline in a full-stack web application (FastAPI backend + React SPA frontend) for real-time monitoring and incident deployment recommendation in Bengaluru.

---

## Getting Started

### Prerequisites
* Python 3.11+
* Node.js 20+
* Docker & Docker Compose (optional)

---

## Run Locally (Development)

### 1. Start the Backend
1. Go to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the development server:
   ```bash
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```
4. Access the API documentation at: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 2. Start the Frontend
1. Go to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Access the application at: [http://localhost:5173](http://localhost:5173)

---

## Run via Docker Compose

To spin up both frontend and backend automatically:
```bash
docker-compose up --build
```
* **Frontend:** [http://localhost:80](http://localhost:80)
* **Backend Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
"# evac_traffic_management" 
