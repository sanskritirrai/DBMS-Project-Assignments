from sqlalchemy import String, Integer, Boolean, Date, DateTime, Text, ForeignKey, Numeric, Enum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(Enum("admin", "pharmacist", "staff"), default="staff")
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())

class Supplier(Base):
    __tablename__ = "suppliers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(140))
    contact_person: Mapped[str | None] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(20))
    city: Mapped[str | None] = mapped_column(String(80))

class Customer(Base):
    __tablename__ = "customers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(140))
    phone: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(160))
    city: Mapped[str | None] = mapped_column(String(80))

class Medicine(Base):
    __tablename__ = "medicines"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(180))
    generic_name: Mapped[str] = mapped_column(String(180))
    category: Mapped[str | None] = mapped_column(String(100))
    strength: Mapped[str | None] = mapped_column(String(80))
    dosage_form: Mapped[str | None] = mapped_column(String(80))
    requires_prescription: Mapped[bool] = mapped_column(Boolean, default=False)
    manufacturer: Mapped[str | None] = mapped_column(String(140))

class Inventory(Base):
    __tablename__ = "inventory"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    medicine_id: Mapped[int] = mapped_column(ForeignKey("medicines.id"))
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id"))
    batch_number: Mapped[str] = mapped_column(String(80))
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    reorder_level: Mapped[int] = mapped_column(Integer, default=20)
    purchase_price: Mapped[float] = mapped_column(Numeric(10,2), default=0)
    selling_price: Mapped[float] = mapped_column(Numeric(10,2), default=0)
    expiry_date: Mapped[Date] = mapped_column(Date)
    medicine: Mapped["Medicine"] = relationship()

class Prescription(Base):
    __tablename__ = "prescriptions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    prescription_number: Mapped[str] = mapped_column(String(40), unique=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"))
    doctor_name: Mapped[str] = mapped_column(String(140))
    prescription_date: Mapped[Date] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Enum("pending", "dispensed", "cancelled"), default="pending")
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    customer: Mapped["Customer"] = relationship()

class PrescriptionItem(Base):
    __tablename__ = "prescription_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    prescription_id: Mapped[int] = mapped_column(ForeignKey("prescriptions.id", ondelete="CASCADE"))
    medicine_id: Mapped[int] = mapped_column(ForeignKey("medicines.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    instructions: Mapped[str | None] = mapped_column(String(255))
    prescription: Mapped["Prescription"] = relationship()
    medicine: Mapped["Medicine"] = relationship()
