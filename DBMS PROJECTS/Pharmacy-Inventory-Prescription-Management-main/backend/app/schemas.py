from datetime import date
from pydantic import BaseModel, EmailStr, Field


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class MedicineCreate(BaseModel):
    name: str
    generic_name: str
    category: str | None = None
    strength: str | None = None
    dosage_form: str | None = None
    requires_prescription: bool = False
    manufacturer: str | None = None


class MedicineUpdate(BaseModel):
    name: str | None = None
    generic_name: str | None = None
    category: str | None = None
    strength: str | None = None
    dosage_form: str | None = None
    requires_prescription: bool | None = None
    manufacturer: str | None = None


class InventoryCreate(BaseModel):
    medicine_id: int
    supplier_id: int | None = None
    batch_number: str
    quantity: int = Field(ge=0)
    reorder_level: int = Field(default=20, ge=0)
    purchase_price: float = Field(ge=0)
    selling_price: float = Field(ge=0)
    expiry_date: date


class InventoryUpdate(BaseModel):
    quantity: int | None = Field(default=None, ge=0)
    reorder_level: int | None = Field(default=None, ge=0)
    purchase_price: float | None = Field(default=None, ge=0)
    selling_price: float | None = Field(default=None, ge=0)
    expiry_date: date | None = None
    batch_number: str | None = None


class CustomerCreate(BaseModel):
    full_name: str
    phone: str | None = None
    email: str | None = None
    city: str | None = None


class PrescriptionItemInput(BaseModel):
    medicine_id: int
    quantity: int = Field(gt=0)
    instructions: str | None = None


class PrescriptionCreate(BaseModel):
    customer_id: int
    doctor_name: str
    prescription_date: date
    notes: str | None = None
    items: list[PrescriptionItemInput]


class PrescriptionUpdate(BaseModel):
    doctor_name: str | None = None
    prescription_date: date | None = None
    status: str | None = None
    notes: str | None = None
