# 🚗 ParkSmart – Vehicle Parking Management System

## Tech Stack
- **Frontend**: React + Tailwind CSS → Vercel
- **Backend**: FastAPI (Python) → Render
- **Database**: PostgreSQL → Supabase

---

## 🗂 Project Structure
```
parking-system/
├── frontend/          # React app (Vite)
├── backend/           # FastAPI app
│   ├── main.py
│   ├── models.py
│   ├── schemas.py
│   ├── database.py
│   ├── seed.py
│   └── requirements.txt
└── database/
    └── schema.sql
```

---

## ⚡ Quick Start (Local Dev)

### 1. Database – Supabase
1. Create a free project at https://supabase.com
2. Open **SQL Editor** and paste `database/schema.sql`
3. Copy your **connection string** from Settings → Database

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create .env
echo 'DATABASE_URL=postgresql://user:pass@host:5432/postgres' > .env

# Seed the database
python seed.py

# Start server
uvicorn main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### 3. Frontend Setup
```bash
cd frontend
npm install
# Create .env.local
echo 'VITE_API_URL=http://localhost:8000' > .env.local
npm run dev
```

---

## 🚀 Deployment

### Backend → Render
1. Push `backend/` to a GitHub repo
2. Create a **New Web Service** on Render
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add environment variable: `DATABASE_URL=<your-supabase-url>`

### Frontend → Vercel
1. Push `frontend/` to GitHub
2. Import the project on Vercel
3. Add env var: `VITE_API_URL=https://your-backend.onrender.com`
4. Deploy!

---

## 🔌 API Reference

| Method | Endpoint                          | Description                    |
|--------|-----------------------------------|--------------------------------|
| POST   | `/vehicle-entry`                  | Register entry, assign slot    |
| POST   | `/vehicle-exit`                   | Calculate fee, free slot       |
| GET    | `/vehicle-exit/preview/{number}`  | Preview fee before exit        |
| GET    | `/slots`                          | All slots with availability    |
| GET    | `/dashboard-stats`                | Analytics dashboard data       |
| POST   | `/payment`                        | Record payment                 |
| GET    | `/payments`                       | List payments                  |
| GET    | `/vehicle-types`                  | List vehicle types + pricing   |
| PUT    | `/vehicle-types/{id}`             | Update pricing                 |
| WS     | `/ws`                             | Real-time slot updates         |

---

## 💰 Pricing Logic
```
total_hours = max((exit_time - entry_time).hours, 0.25)  # 15 min minimum
fee = total_hours × price_per_hour
```

Default rates: Bike ₹20/hr · Car ₹50/hr · Truck ₹100/hr

---

## 🔐 Default Admin Credentials
- Email: `admin@parksmart.com`
- Password: `admin123`

> ⚠️ Change these immediately in production!
