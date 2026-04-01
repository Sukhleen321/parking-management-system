from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ─── Vehicle Types ────────────────────────────────────────────────────────────

class VehicleTypeCreate(BaseModel):
    type_name: str
    price_per_hour: float


class VehicleType(BaseModel):
    id: int
    type_name: str
    price_per_hour: float
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ─── Parking Slots ────────────────────────────────────────────────────────────

class ParkingSlotCreate(BaseModel):
    slot_number: str
    slot_type: str
    is_occupied: bool = False
    floor_number: int = 1


class ParkingSlot(BaseModel):
    id: int
    slot_number: str
    slot_type: str
    is_occupied: bool
    floor_number: int

    class Config:
        from_attributes = True


# ─── Vehicle Entry / Exit ─────────────────────────────────────────────────────

class VehicleEntry(BaseModel):
    vehicle_number: str
    vehicle_type_id: int
    owner_name: Optional[str] = None


class VehicleExit(BaseModel):
    vehicle_number: str


class ExitPreview(BaseModel):
    vehicle_number: str
    owner_name: Optional[str]
    vehicle_type: str
    slot_number: str
    entry_time: datetime
    duration_hours: float
    estimated_fee: float
    price_per_hour: float
    record_id: int


# ─── Parking Record ───────────────────────────────────────────────────────────

class ParkingRecordDetail(BaseModel):
    id: int
    vehicle_number: str
    owner_name: Optional[str]
    vehicle_type: str
    slot_number: str
    floor_number: int
    entry_time: datetime
    exit_time: Optional[datetime]
    total_hours: Optional[float]
    fee: Optional[float]
    status: str

    class Config:
        from_attributes = True


# ─── Payment ──────────────────────────────────────────────────────────────────

class PaymentCreate(BaseModel):
    parking_record_id: int
    amount: float
    payment_method: str


class Payment(BaseModel):
    id: int
    parking_record_id: int
    amount: float
    payment_method: str
    payment_time: datetime
    status: str

    class Config:
        from_attributes = True


# ─── Dashboard ────────────────────────────────────────────────────────────────

class RevenueTrend(BaseModel):
    day: str
    revenue: float


class SlotBreakdown(BaseModel):
    type: str
    total: int
    occupied: int


class DashboardStats(BaseModel):
    vehicles_today: int
    revenue_today: float
    occupancy_rate: float
    active_parkings: int
    total_slots: int
    occupied_slots: int
    revenue_trend: List[RevenueTrend]
    slot_breakdown: List[SlotBreakdown]
