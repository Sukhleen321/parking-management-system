from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class VehicleType(Base):
    __tablename__ = "vehicle_types"
    id = Column(Integer, primary_key=True, index=True)
    type_name = Column(String(50), unique=True, nullable=False)  # bike, car, truck
    price_per_hour = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    vehicles = relationship("Vehicle", back_populates="vehicle_type")


class Vehicle(Base):
    __tablename__ = "vehicles"
    id = Column(Integer, primary_key=True, index=True)
    vehicle_number = Column(String(20), unique=True, nullable=False, index=True)
    vehicle_type_id = Column(Integer, ForeignKey("vehicle_types.id"), nullable=False)
    owner_name = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    vehicle_type = relationship("VehicleType", back_populates="vehicles")
    parking_records = relationship("ParkingRecord", back_populates="vehicle")


class ParkingSlot(Base):
    __tablename__ = "parking_slots"
    id = Column(Integer, primary_key=True, index=True)
    slot_number = Column(String(20), unique=True, nullable=False)
    slot_type = Column(String(20), nullable=False)  # bike, car, truck
    is_occupied = Column(Boolean, default=False)
    floor_number = Column(Integer, default=1)
    parking_records = relationship("ParkingRecord", back_populates="slot")


class ParkingRecord(Base):
    __tablename__ = "parking_records"
    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=False)
    slot_id = Column(Integer, ForeignKey("parking_slots.id"), nullable=False)
    entry_time = Column(DateTime(timezone=True), nullable=False)
    exit_time = Column(DateTime(timezone=True), nullable=True)
    total_hours = Column(Float, nullable=True)
    fee = Column(Numeric(10, 2), nullable=True)
    status = Column(String(20), default="active")  # active, completed
    vehicle = relationship("Vehicle", back_populates="parking_records")
    slot = relationship("ParkingSlot", back_populates="parking_records")
    payment = relationship("Payment", back_populates="parking_record", uselist=False)


class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    parking_record_id = Column(Integer, ForeignKey("parking_records.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    payment_method = Column(String(20), nullable=False)  # cash, upi, card
    payment_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), default="completed")
    parking_record = relationship("ParkingRecord", back_populates="payment")


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(200), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="staff")  # admin, staff
    created_at = Column(DateTime(timezone=True), server_default=func.now())
