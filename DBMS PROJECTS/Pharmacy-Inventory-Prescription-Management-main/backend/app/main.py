import os
from datetime import date
from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from sqlalchemy.exc import SQLAlchemyError
from dotenv import load_dotenv
from .database import Base, engine, get_db
from . import models, schemas
from .auth import hash_password, verify_password, create_access_token, get_current_user

load_dotenv()
app = FastAPI(title="Pharmacy Inventory & Prescription API", version="1.0.0")
origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(SQLAlchemyError)
def database_error(request: Request, exc: SQLAlchemyError):
    # A database outage should be a readable 503, not an unhandled 500 with a
    # stack trace leaking into the response.
    print(f"[database] {exc.__class__.__name__}: {exc}", flush=True)
    return JSONResponse(
        status_code=503,
        content={"detail": "Database unavailable. Check DATABASE_URL and that MySQL is running."},
    )

def _seed_database():
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    try:
        user = db.query(models.User).filter_by(email="admin@shreepharmacy.in").first()
        if not user:
            db.add(models.User(
                full_name="Bhavya Shany",
                email="admin@shreepharmacy.in",
                password_hash=hash_password("Admin@123"),
                role="admin"
            ))
            db.commit()
        elif user.full_name == "User":
            user.full_name = "Bhavya Shany"
            db.commit()

        # --- ORM-based seed data ---
        # 1. Suppliers
        if db.query(models.Supplier).count() == 0:
            db.add_all([
                models.Supplier(id=1, name="Sharma Medical Distributors", contact_person="Rohit Sharma", phone="9876543210", city="Jaipur"),
                models.Supplier(id=2, name="Aarogya Pharma Wholesale", contact_person="Priya Mehta", phone="9876501234", city="Delhi"),
                models.Supplier(id=3, name="Bharat Medicos Supply", contact_person="Amit Verma", phone="9810012345", city="Gurugram"),
            ])
            db.commit()

        # 2. Customers
        if db.query(models.Customer).count() == 0:
            db.add_all([
                models.Customer(id=1, full_name="Aarav Sharma", phone="9876543211", email="aarav@example.in", city="Jaipur"),
                models.Customer(id=2, full_name="Ananya Gupta", phone="9876543212", email="ananya@example.in", city="Delhi"),
                models.Customer(id=3, full_name="Rohan Mehta", phone="9876543213", email="rohan@example.in", city="Alwar"),
                models.Customer(id=4, full_name="Priya Singh", phone="9876543214", email="priya@example.in", city="Gurugram"),
                models.Customer(id=5, full_name="Ishita Verma", phone="9876543215", email="ishita@example.in", city="Jaipur"),
            ])
            db.commit()

        # 3. Medicines
        if db.query(models.Medicine).count() == 0:
            db.add_all([
                models.Medicine(id=1, name="Dolo 650", generic_name="Paracetamol", category="Analgesic / Antipyretic", strength="650 mg", dosage_form="Tablet", requires_prescription=False, manufacturer="Micro Labs"),
                models.Medicine(id=2, name="Crocin 500", generic_name="Paracetamol", category="Analgesic / Antipyretic", strength="500 mg", dosage_form="Tablet", requires_prescription=False, manufacturer="Haleon"),
                models.Medicine(id=3, name="Cetirizine 10", generic_name="Cetirizine", category="Antihistamine", strength="10 mg", dosage_form="Tablet", requires_prescription=False, manufacturer="Generic"),
                models.Medicine(id=4, name="ORS Powder", generic_name="Oral Rehydration Salts", category="Electrolyte", strength="WHO formula", dosage_form="Sachet", requires_prescription=False, manufacturer="Generic"),
                models.Medicine(id=5, name="Pantoprazole 40", generic_name="Pantoprazole", category="Gastrointestinal", strength="40 mg", dosage_form="Tablet", requires_prescription=True, manufacturer="Generic"),
                models.Medicine(id=6, name="Amoxicillin 500", generic_name="Amoxicillin", category="Antibiotic", strength="500 mg", dosage_form="Capsule", requires_prescription=True, manufacturer="Generic"),
                models.Medicine(id=7, name="Azithromycin 500", generic_name="Azithromycin", category="Antibiotic", strength="500 mg", dosage_form="Tablet", requires_prescription=True, manufacturer="Generic"),
                models.Medicine(id=8, name="Metformin 500", generic_name="Metformin", category="Antidiabetic", strength="500 mg", dosage_form="Tablet", requires_prescription=True, manufacturer="Generic"),
                models.Medicine(id=9, name="Amlodipine 5", generic_name="Amlodipine", category="Antihypertensive", strength="5 mg", dosage_form="Tablet", requires_prescription=True, manufacturer="Generic"),
                models.Medicine(id=10, name="Vitamin C 500", generic_name="Ascorbic Acid", category="Vitamin / Supplement", strength="500 mg", dosage_form="Tablet", requires_prescription=False, manufacturer="Generic"),
                models.Medicine(id=11, name="Ibuprofen 400", generic_name="Ibuprofen", category="NSAID", strength="400 mg", dosage_form="Tablet", requires_prescription=True, manufacturer="Generic"),
                models.Medicine(id=12, name="Levocetirizine 5", generic_name="Levocetirizine", category="Antihistamine", strength="5 mg", dosage_form="Tablet", requires_prescription=True, manufacturer="Generic"),
            ])
            db.commit()

        # 4. Inventory (depends on medicines + suppliers)
        if db.query(models.Inventory).count() == 0:
            db.add_all([
                models.Inventory(id=1, medicine_id=1, supplier_id=1, batch_number="DL650-2401", quantity=140, reorder_level=30, purchase_price=1.80, selling_price=2.50, expiry_date=date(2027, 12, 31)),
                models.Inventory(id=2, medicine_id=2, supplier_id=1, batch_number="CR500-2402", quantity=85, reorder_level=25, purchase_price=1.20, selling_price=1.80, expiry_date=date(2027, 10, 31)),
                models.Inventory(id=3, medicine_id=3, supplier_id=2, batch_number="CTZ10-2403", quantity=18, reorder_level=25, purchase_price=1.00, selling_price=1.50, expiry_date=date(2027, 8, 31)),
                models.Inventory(id=4, medicine_id=4, supplier_id=3, batch_number="ORS-2404", quantity=60, reorder_level=20, purchase_price=12.00, selling_price=18.00, expiry_date=date(2027, 11, 30)),
                models.Inventory(id=5, medicine_id=5, supplier_id=2, batch_number="PNT40-2405", quantity=42, reorder_level=20, purchase_price=4.50, selling_price=6.00, expiry_date=date(2027, 9, 30)),
                models.Inventory(id=6, medicine_id=6, supplier_id=3, batch_number="AMX500-2406", quantity=24, reorder_level=20, purchase_price=5.00, selling_price=7.00, expiry_date=date(2027, 6, 30)),
                models.Inventory(id=7, medicine_id=7, supplier_id=1, batch_number="AZT500-2407", quantity=12, reorder_level=20, purchase_price=8.00, selling_price=11.00, expiry_date=date(2027, 7, 31)),
                models.Inventory(id=8, medicine_id=8, supplier_id=2, batch_number="MET500-2408", quantity=100, reorder_level=25, purchase_price=2.00, selling_price=3.00, expiry_date=date(2028, 1, 31)),
                models.Inventory(id=9, medicine_id=9, supplier_id=2, batch_number="AML5-2409", quantity=75, reorder_level=20, purchase_price=1.50, selling_price=2.20, expiry_date=date(2027, 12, 31)),
                models.Inventory(id=10, medicine_id=10, supplier_id=1, batch_number="VTC500-2410", quantity=55, reorder_level=20, purchase_price=2.00, selling_price=3.00, expiry_date=date(2027, 10, 31)),
                models.Inventory(id=11, medicine_id=11, supplier_id=3, batch_number="IBU400-2411", quantity=9, reorder_level=20, purchase_price=2.50, selling_price=3.50, expiry_date=date(2027, 5, 31)),
                models.Inventory(id=12, medicine_id=12, supplier_id=1, batch_number="LVC5-2412", quantity=31, reorder_level=15, purchase_price=2.00, selling_price=3.00, expiry_date=date(2027, 9, 30)),
            ])
            db.commit()

        # 5. Prescriptions (depends on customers)
        if db.query(models.Prescription).count() == 0:
            db.add_all([
                models.Prescription(id=1, prescription_number="RX-2026-001", customer_id=1, doctor_name="Dr. Neha Kapoor", prescription_date=date(2026, 10, 20), notes="Demo record only", status="pending"),
                models.Prescription(id=2, prescription_number="RX-2026-002", customer_id=2, doctor_name="Dr. Arjun Rao", prescription_date=date(2026, 10, 19), notes="Demo record only", status="dispensed"),
            ])
            db.commit()

        # 6. Prescription Items (depends on prescriptions + medicines)
        if db.query(models.PrescriptionItem).count() == 0:
            db.add_all([
                models.PrescriptionItem(id=1, prescription_id=1, medicine_id=5, quantity=10, instructions="As written on the original prescription"),
                models.PrescriptionItem(id=2, prescription_id=2, medicine_id=8, quantity=30, instructions="As written on the original prescription"),
            ])
            db.commit()
    finally:
        db.close()

@app.on_event("startup")
def startup():
    # An unreachable database should not take the whole deployment down: the
    # serverless function still has to serve the UI and report its own health.
    try:
        _seed_database()
    except Exception as exc:
        print(f"[startup] database seeding skipped: {exc}", flush=True)


@app.get("/api")
def root():
    return {
        "service": "Pharmacy Inventory & Prescription API",
        "status": "online",
        "docs": "/docs",
        "health": "/api/health"
    }

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "pharmacy-api"}

@app.post("/api/auth/login")
def login(payload: schemas.LoginInput, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(func.lower(models.User.email) == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return {
        "access_token": create_access_token(user),
        "token_type": "bearer",
        "user": {"id": user.id, "full_name": user.full_name, "email": user.email, "role": user.role}
    }

@app.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db), user=Depends(get_current_user)):
    medicine_count = db.query(models.Medicine).count()
    total_units = db.query(func.coalesce(func.sum(models.Inventory.quantity), 0)).scalar()
    low_stock = db.query(models.Inventory).filter(models.Inventory.quantity <= models.Inventory.reorder_level).count()
    pending = db.query(models.Prescription).filter_by(status="pending").count()
    expiring = db.query(models.Inventory).filter(models.Inventory.expiry_date <= date.today()).count()
    return {"medicine_count": medicine_count, "total_units": int(total_units or 0), "low_stock_batches": low_stock, "pending_prescriptions": pending, "expired_batches": expiring}

@app.get("/api/medicines")
def list_medicines(search: str = Query(default=""), db: Session = Depends(get_db), user=Depends(get_current_user)):
    q = db.query(models.Medicine)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(models.Medicine.name.ilike(like), models.Medicine.generic_name.ilike(like), models.Medicine.category.ilike(like)))
    return q.order_by(models.Medicine.name).all()

@app.post("/api/medicines", status_code=201)
def add_medicine(payload: schemas.MedicineCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    medicine = models.Medicine(**payload.model_dump())
    db.add(medicine); db.commit(); db.refresh(medicine)
    return medicine

@app.patch("/api/medicines/{medicine_id}")
def update_medicine(medicine_id: int, payload: schemas.MedicineUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    medicine = db.get(models.Medicine, medicine_id)
    if not medicine:
        raise HTTPException(status_code=404, detail="Medicine not found")
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(medicine, field, value)
    db.commit(); db.refresh(medicine)
    return medicine

@app.get("/api/inventory")
def list_inventory(search: str = Query(default=""), db: Session = Depends(get_db), user=Depends(get_current_user)):
    q = db.query(models.Inventory).join(models.Medicine)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(models.Medicine.name.ilike(like), models.Inventory.batch_number.ilike(like)))
    rows = q.order_by(models.Inventory.expiry_date).all()
    return [{
        "id": r.id, "medicine_id": r.medicine_id, "medicine_name": r.medicine.name,
        "generic_name": r.medicine.generic_name, "strength": r.medicine.strength,
        "batch_number": r.batch_number, "quantity": r.quantity, "reorder_level": r.reorder_level,
        "selling_price": float(r.selling_price), "expiry_date": r.expiry_date.isoformat()
    } for r in rows]

@app.post("/api/inventory", status_code=201)
def add_inventory(payload: schemas.InventoryCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if payload.quantity <= 0:
        return {"id": None, "message": "Batch with 0 quantity not added"}
    if not db.get(models.Medicine, payload.medicine_id):
        raise HTTPException(status_code=404, detail="Medicine not found")
    item = models.Inventory(**payload.model_dump())
    db.add(item); db.commit(); db.refresh(item)
    return {"id": item.id, "message": "Inventory batch added"}

@app.patch("/api/inventory/{inventory_id}")
def update_inventory(inventory_id: int, payload: schemas.InventoryUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = db.get(models.Inventory, inventory_id)
    if not item:
        raise HTTPException(status_code=404, detail="Inventory batch not found")
    update_data = payload.model_dump(exclude_unset=True)
    if update_data.get("quantity") is not None and update_data["quantity"] <= 0:
        db.delete(item)
        db.commit()
        return {"id": inventory_id, "message": "Inventory batch deleted (quantity reached 0)"}
    for field, value in update_data.items():
        setattr(item, field, value)
    db.commit(); db.refresh(item)
    return {"id": item.id, "message": "Inventory batch updated"}

@app.delete("/api/inventory/{inventory_id}")
def delete_inventory(inventory_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    item = db.get(models.Inventory, inventory_id)
    if not item:
        raise HTTPException(status_code=404, detail="Inventory batch not found")
    db.delete(item)
    db.commit()
    return {"id": inventory_id, "message": "Inventory batch deleted"}

@app.get("/api/customers")
def customers(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(models.Customer).order_by(models.Customer.full_name).all()

@app.post("/api/customers", status_code=201)
def add_customer(payload: schemas.CustomerCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    c = models.Customer(**payload.model_dump())
    db.add(c); db.commit(); db.refresh(c)
    return {"id": c.id, "message": "Customer added", "full_name": c.full_name}

@app.get("/api/suppliers")
def suppliers(db: Session = Depends(get_db), user=Depends(get_current_user)):
    return db.query(models.Supplier).order_by(models.Supplier.name).all()

@app.get("/api/prescriptions")
def prescriptions(db: Session = Depends(get_db), user=Depends(get_current_user)):
    rows = db.query(models.Prescription).join(models.Customer).order_by(models.Prescription.prescription_date.desc()).all()
    return [{
        "id": r.id, "prescription_number": r.prescription_number, "customer_name": r.customer.full_name,
        "doctor_name": r.doctor_name, "prescription_date": r.prescription_date.isoformat(),
        "status": r.status, "notes": r.notes
    } for r in rows]

@app.post("/api/prescriptions", status_code=201)
def create_prescription(payload: schemas.PrescriptionCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not db.get(models.Customer, payload.customer_id):
        raise HTTPException(status_code=404, detail="Customer not found")
    if not payload.items:
        raise HTTPException(status_code=400, detail="Add at least one prescription item")
    for item in payload.items:
        if not db.get(models.Medicine, item.medicine_id):
            raise HTTPException(status_code=404, detail=f"Medicine {item.medicine_id} not found")
    rx = models.Prescription(
        prescription_number=f"RX-{date.today().year}-{db.query(models.Prescription).count()+1:04d}",
        customer_id=payload.customer_id, doctor_name=payload.doctor_name,
        prescription_date=payload.prescription_date, notes=payload.notes, status="pending"
    )
    db.add(rx); db.flush()
    for item in payload.items:
        db.add(models.PrescriptionItem(
            prescription_id=rx.id, medicine_id=item.medicine_id,
            quantity=item.quantity, instructions=item.instructions
        ))
    db.commit(); db.refresh(rx)
    return {"id": rx.id, "prescription_number": rx.prescription_number, "message": "Prescription saved"}

@app.patch("/api/prescriptions/{prescription_id}")
def update_prescription(prescription_id: int, payload: schemas.PrescriptionUpdate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    rx = db.get(models.Prescription, prescription_id)
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rx, field, value)
    db.commit(); db.refresh(rx)
    return {"id": rx.id, "message": "Prescription updated"}
