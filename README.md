# ValuEngine — Stock Valuation App

A full-stack web app that runs intelligent multi-model valuation on any US stock ticker.

## Stack
- Backend: Python + FastAPI + yfinance
- Frontend: React + Vite + Recharts

## Run Locally

### Backend
```
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Deploy
- Frontend → Vercel (set root directory to `frontend`)
- Backend  → Render (set root directory to `backend`, start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`)
- After deploying backend, update `API` in `src/App.jsx` to your Render URL.

## Disclaimer
For informational purposes only. Not financial advice.
