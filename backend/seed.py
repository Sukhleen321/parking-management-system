"""
Run once to seed the database with initial vehicle types and parking slots.
  python seed.py
"""
from database import SessionLocal, engine
import models

models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

# ─── Vehicle Types ────────────────────────────────────────────────────────────
if not db.query(models.VehicleType).first():
    types = [
        models.VehicleType(type_name="bike",  price_per_hour=20.00),
        models.VehicleType(type_name="car",   price_per_hour=50.00),
        models.VehicleType(type_name="truck", price_per_hour=100.00),
    ]
    db.add_all(types)
    db.commit()
    print("✅ Vehicle types seeded")

# ─── Parking Slots ────────────────────────────────────────────────────────────
if not db.query(models.ParkingSlot).first():
    slots = []
    # Floor 1 – Bikes (B01-B10)
    for i in range(1, 11):
        slots.append(models.ParkingSlot(slot_number=f"B{i:02d}", slot_type="bike",  floor_number=1))
    # Floor 1 – Cars (C01-C10)
    for i in range(1, 11):
        slots.append(models.ParkingSlot(slot_number=f"C{i:02d}", slot_type="car",   floor_number=1))
    # Floor 2 – Cars (C11-C20)
    for i in range(11, 21):
        slots.append(models.ParkingSlot(slot_number=f"C{i:02d}", slot_type="car",   floor_number=2))
    # Floor 2 – Trucks (T01-T05)
    for i in range(1, 6):
        slots.append(models.ParkingSlot(slot_number=f"T{i:02d}", slot_type="truck", floor_number=2))

    db.add_all(slots)
    db.commit()
    print(f"✅ {len(slots)} parking slots seeded")

# ─── Admin User ───────────────────────────────────────────────────────────────
if not db.query(models.User).first():
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    admin = models.User(
        name="Admin",
        email="admin@parksmart.com",
        password_hash=pwd_context.hash("admin123"),
        role="admin",
    )
    db.add(admin)
    db.commit()
    print("✅ Admin user created  →  admin@parksmart.com / admin123")

db.close()
print("\n🚀 Database seeded successfully!")
