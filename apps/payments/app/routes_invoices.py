"""Casuya Payments microservice — invoice routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import InvoiceRecord, PaymentRecord
from app.services import audit, get_db, invoice_dict, now, payment_dict

router = APIRouter()

settings = get_settings()


class CreateInvoiceBody(BaseModel):
    user_id: str
    amount: float
    currency: str = "TZS"
    tax_amount: float = 0
    discount_amount: float = 0
    items: list | None = None
    due_date: str | None = None


@router.get("/invoices")
def list_invoices(user_id: str | None = None, status: str | None = None, db: Session = Depends(get_db)):
    q = db.query(InvoiceRecord)
    if user_id:
        q = q.filter(InvoiceRecord.user_id == user_id)
    if status:
        q = q.filter(InvoiceRecord.status == status)
    rows = q.order_by(InvoiceRecord.created_at.desc()).all()
    return [invoice_dict(r) for r in rows]


@router.get("/invoices/{invoice_id}")
def get_invoice(invoice_id: str, db: Session = Depends(get_db)):
    row = db.query(InvoiceRecord).filter(InvoiceRecord.id == invoice_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice_dict(row)


@router.post("/invoices")
def create_invoice(body: CreateInvoiceBody, db: Session = Depends(get_db)):
    row = InvoiceRecord(
        user_id=body.user_id,
        amount=body.amount,
        currency=body.currency,
        tax_amount=body.tax_amount,
        discount_amount=body.discount_amount,
        items=body.items or [],
        status="pending",
        due_date=body.due_date,
    )
    db.add(row)
    audit(db, "invoice.create", "invoice", row.id, body.user_id, {"amount": body.amount})
    db.commit()
    db.refresh(row)
    return invoice_dict(row)


@router.post("/invoices/{invoice_id}/pay")
def pay_invoice(invoice_id: str, db: Session = Depends(get_db)):
    row = db.query(InvoiceRecord).filter(InvoiceRecord.id == invoice_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Invoice not found")
    total = row.amount + (row.tax_amount or 0) - (row.discount_amount or 0)
    payment = PaymentRecord(
        user_id=row.user_id,
        amount=total,
        currency=row.currency,
        provider="azampay",
        invoice_id=row.id,
        status="success",
        sandbox=settings.azampay_sandbox,
        note="Invoice paid",
    )
    row.status = "paid"
    row.paid_at = now()
    db.add(payment)
    audit(db, "invoice.pay", "invoice", row.id, row.user_id, {"amount": total})
    db.commit()
    db.refresh(row)
    return {"invoice": invoice_dict(row), "payment": payment_dict(payment)}
