from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date
from typing import List, Optional
from datetime import datetime, date
import json

from database import get_db, engine
import models
import schemas

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="ParkSmart API", version="1.0.0", description="Vehicle Parking Management System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── WebSocket Manager ───────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                pass

manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ─── Vehicle Types ────────────────────────────────────────────────────────────

@app.get("/vehicle-types", response_model=List[schemas.VehicleType])
def get_vehicle_types(db: Session = Depends(get_db)):
    return db.query(models.VehicleType).all()


@app.post("/vehicle-types", response_model=schemas.VehicleType)
def create_vehicle_type(vt: schemas.VehicleTypeCreate, db: Session = Depends(get_db)):
    db_vt = models.VehicleType(**vt.dict())
    db.add(db_vt)
    db.commit()
    db.refresh(db_vt)
    return db_vt


@app.put("/vehicle-types/{type_id}", response_model=schemas.VehicleType)
def update_vehicle_type(type_id: int, vt: schemas.VehicleTypeCreate, db: Session = Depends(get_db)):
    db_vt = db.query(models.VehicleType).filter(models.VehicleType.id == type_id).first()
    if not db_vt:
        raise HTTPException(status_code=404, detail="Vehicle type not found")
    for key, value in vt.dict().items():
        setattr(db_vt, key, value)
    db.commit()
    db.refresh(db_vt)
    return db_vt


# ─── Parking Slots ────────────────────────────────────────────────────────────

@app.get("/slots", response_model=List[schemas.ParkingSlot])
def get_slots(db: Session = Depends(get_db)):
    return db.query(models.ParkingSlot).order_by(
        models.ParkingSlot.floor_number, models.ParkingSlot.slot_number
    ).all()


@app.post("/slots", response_model=schemas.ParkingSlot)
def create_slot(slot: schemas.ParkingSlotCreate, db: Session = Depends(get_db)):
    existing = db.query(models.ParkingSlot).filter(
        models.ParkingSlot.slot_number == slot.slot_number
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Slot number already exists")
    db_slot = models.ParkingSlot(**slot.dict())
    db.add(db_slot)
    db.commit()
    db.refresh(db_slot)
    return db_slot


@app.put("/slots/{slot_id}", response_model=schemas.ParkingSlot)
def update_slot(slot_id: int, slot: schemas.ParkingSlotCreate, db: Session = Depends(get_db)):
    db_slot = db.query(models.ParkingSlot).filter(models.ParkingSlot.id == slot_id).first()
    if not db_slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    for key, value in slot.dict().items():
        setattr(db_slot, key, value)
    db.commit()
    db.refresh(db_slot)
    return db_slot


# ─── Vehicle Entry ────────────────────────────────────────────────────────────

@app.post("/vehicle-entry", response_model=schemas.ParkingRecordDetail)
async def vehicle_entry(entry: schemas.VehicleEntry, db: Session = Depends(get_db)):
    # Check for duplicate active entry
    existing_active = (
        db.query(models.ParkingRecord)
        .join(models.Vehicle)
        .filter(
            models.Vehicle.vehicle_number == entry.vehicle_number,
            models.ParkingRecord.status == "active"
        )
        .first()
    )
    if existing_active:
        raise HTTPException(status_code=400, detail="Vehicle already has an active parking session")

    # Get or create vehicle
    vehicle = db.query(models.Vehicle).filter(
        models.Vehicle.vehicle_number == entry.vehicle_number
    ).first()

    vehicle_type = db.query(models.VehicleType).filter(
        models.VehicleType.id == entry.vehicle_type_id
    ).first()
    if not vehicle_type:
        raise HTTPException(status_code=404, detail="Vehicle type not found")

    if not vehicle:
        vehicle = models.Vehicle(
            vehicle_number=entry.vehicle_number,
            vehicle_type_id=entry.vehicle_type_id,
            owner_name=entry.owner_name,
        )
        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)

    # Auto-assign nearest free slot matching type
    slot_type_map = {1: "bike", 2: "car", 3: "truck"}  # adjust to your seeded IDs
    desired_type = vehicle_type.type_name.lower()

    slot = (
        db.query(models.ParkingSlot)
        .filter(
            models.ParkingSlot.slot_type == desired_type,
            models.ParkingSlot.is_occupied == False,
        )
        .order_by(models.ParkingSlot.floor_number, models.ParkingSlot.slot_number)
        .first()
    )
    if not slot:
        raise HTTPException(status_code=409, detail=f"No available {desired_type} slots")

    slot.is_occupied = True
    db.commit()

    # Create parking record
    record = models.ParkingRecord(
        vehicle_id=vehicle.id,
        slot_id=slot.id,
        entry_time=datetime.utcnow(),
        status="active",
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    await manager.broadcast({"event": "vehicle_entry", "slot_id": slot.id, "slot_number": slot.slot_number})

    return _build_record_detail(record, db)


# ─── Vehicle Exit ─────────────────────────────────────────────────────────────

@app.post("/vehicle-exit", response_model=schemas.ParkingRecordDetail)
async def vehicle_exit(exit_data: schemas.VehicleExit, db: Session = Depends(get_db)):
    vehicle = db.query(models.Vehicle).filter(
        models.Vehicle.vehicle_number == exit_data.vehicle_number
    ).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    record = (
        db.query(models.ParkingRecord)
        .filter(
            models.ParkingRecord.vehicle_id == vehicle.id,
            models.ParkingRecord.status == "active",
        )
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="No active parking session for this vehicle")

    exit_time = datetime.utcnow()
    # Ensure entry_time is naive to avoid timezone mismatch errors with Postgres timestamps
    entry_time_naive = record.entry_time.replace(tzinfo=None) if record.entry_time.tzinfo else record.entry_time
    duration_seconds = (exit_time - entry_time_naive).total_seconds()
    total_hours = max(duration_seconds / 3600, 0.25)  # Minimum 15 minutes charge

    vehicle_type = db.query(models.VehicleType).filter(
        models.VehicleType.id == vehicle.vehicle_type_id
    ).first()
    fee = round(total_hours * float(vehicle_type.price_per_hour), 2)

    record.exit_time = exit_time
    record.total_hours = round(total_hours, 2)
    record.fee = fee
    record.status = "completed"

    slot = db.query(models.ParkingSlot).filter(models.ParkingSlot.id == record.slot_id).first()
    slot.is_occupied = False
    db.commit()
    db.refresh(record)

    await manager.broadcast({"event": "vehicle_exit", "slot_id": slot.id, "slot_number": slot.slot_number})

    return _build_record_detail(record, db)


@app.get("/vehicle-exit/preview/{vehicle_number}", response_model=schemas.ExitPreview)
def preview_exit(vehicle_number: str, db: Session = Depends(get_db)):
    vehicle = db.query(models.Vehicle).filter(
        models.Vehicle.vehicle_number == vehicle_number
    ).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    record = (
        db.query(models.ParkingRecord)
        .filter(
            models.ParkingRecord.vehicle_id == vehicle.id,
            models.ParkingRecord.status == "active",
        )
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="No active parking session")

    now = datetime.utcnow()
    # Ensure entry_time is naive to avoid timezone mismatch errors with Postgres timestamps
    entry_time_naive = record.entry_time.replace(tzinfo=None) if record.entry_time.tzinfo else record.entry_time
    duration_seconds = (now - entry_time_naive).total_seconds()
    total_hours = max(duration_seconds / 3600, 0.25)

    vehicle_type = db.query(models.VehicleType).filter(
        models.VehicleType.id == vehicle.vehicle_type_id
    ).first()
    estimated_fee = round(total_hours * float(vehicle_type.price_per_hour), 2)
    slot = db.query(models.ParkingSlot).filter(models.ParkingSlot.id == record.slot_id).first()

    return {
        "vehicle_number": vehicle.vehicle_number,
        "owner_name": vehicle.owner_name,
        "vehicle_type": vehicle_type.type_name,
        "slot_number": slot.slot_number,
        "entry_time": record.entry_time,
        "duration_hours": round(total_hours, 2),
        "estimated_fee": estimated_fee,
        "price_per_hour": float(vehicle_type.price_per_hour),
        "record_id": record.id,
    }


# ─── Payments ─────────────────────────────────────────────────────────────────

@app.post("/payment", response_model=schemas.Payment)
def create_payment(payment: schemas.PaymentCreate, db: Session = Depends(get_db)):
    record = db.query(models.ParkingRecord).filter(
        models.ParkingRecord.id == payment.parking_record_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Parking record not found")

    db_payment = models.Payment(
        parking_record_id=payment.parking_record_id,
        amount=payment.amount,
        payment_method=payment.payment_method,
        payment_time=datetime.utcnow(),
        status="completed",
    )
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment


@app.get("/payments", response_model=List[schemas.Payment])
def get_payments(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(models.Payment).order_by(models.Payment.payment_time.desc()).offset(skip).limit(limit).all()


# ─── Dashboard Stats ──────────────────────────────────────────────────────────

@app.get("/dashboard-stats", response_model=schemas.DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    today = date.today()

    # Vehicles today
    vehicles_today = (
        db.query(func.count(models.ParkingRecord.id))
        .filter(cast(models.ParkingRecord.entry_time, Date) == today)
        .scalar()
    )

    # Revenue today
    revenue_today = (
        db.query(func.coalesce(func.sum(models.Payment.amount), 0))
        .join(models.ParkingRecord)
        .filter(cast(models.Payment.payment_time, Date) == today)
        .scalar()
    )

    # Total slots and occupancy
    total_slots = db.query(func.count(models.ParkingSlot.id)).scalar()
    occupied_slots = db.query(func.count(models.ParkingSlot.id)).filter(
        models.ParkingSlot.is_occupied == True
    ).scalar()
    occupancy_rate = round((occupied_slots / total_slots * 100), 1) if total_slots else 0

    # Active parkings
    active_parkings = (
        db.query(func.count(models.ParkingRecord.id))
        .filter(models.ParkingRecord.status == "active")
        .scalar()
    )

    # Revenue last 7 days
    from sqlalchemy import text
    revenue_trend = db.execute(
        text("""
            SELECT DATE(payment_time) as day, COALESCE(SUM(amount), 0) as revenue
            FROM payments
            WHERE payment_time >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY DATE(payment_time)
            ORDER BY day
        """)
    ).fetchall()

    # Slot breakdown
    slot_breakdown = db.execute(
        text("""
            SELECT slot_type,
                   COUNT(*) as total,
                   SUM(CASE WHEN is_occupied THEN 1 ELSE 0 END) as occupied
            FROM parking_slots
            GROUP BY slot_type
        """)
    ).fetchall()

    return {
        "vehicles_today": vehicles_today,
        "revenue_today": float(revenue_today),
        "occupancy_rate": occupancy_rate,
        "active_parkings": active_parkings,
        "total_slots": total_slots,
        "occupied_slots": occupied_slots,
        "revenue_trend": [{"day": str(r.day), "revenue": float(r.revenue)} for r in revenue_trend],
        "slot_breakdown": [
            {"type": r.slot_type, "total": r.total, "occupied": r.occupied}
            for r in slot_breakdown
        ],
    }


@app.get("/parking-records", response_model=List[schemas.ParkingRecordDetail])
def get_parking_records(status: Optional[str] = None, skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    query = db.query(models.ParkingRecord)
    if status:
        query = query.filter(models.ParkingRecord.status == status)
    records = query.order_by(models.ParkingRecord.entry_time.desc()).offset(skip).limit(limit).all()
    return [_build_record_detail(r, db) for r in records]


# ─── Helper ───────────────────────────────────────────────────────────────────

def _build_record_detail(record: models.ParkingRecord, db: Session) -> dict:
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == record.vehicle_id).first()
    slot = db.query(models.ParkingSlot).filter(models.ParkingSlot.id == record.slot_id).first()
    vehicle_type = db.query(models.VehicleType).filter(
        models.VehicleType.id == vehicle.vehicle_type_id
    ).first()
    return {
        "id": record.id,
        "vehicle_number": vehicle.vehicle_number,
        "owner_name": vehicle.owner_name,
        "vehicle_type": vehicle_type.type_name,
        "slot_number": slot.slot_number,
        "floor_number": slot.floor_number,
        "entry_time": record.entry_time,
        "exit_time": record.exit_time,
        "total_hours": record.total_hours,
        "fee": record.fee,
        "status": record.status,
    }
