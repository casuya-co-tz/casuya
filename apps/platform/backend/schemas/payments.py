from pydantic import BaseModel


class CheckoutRequest(BaseModel):
    amount_tzs: float
    mobile_number: str
    provider: str = "azampay"
    idempotency_key: str | None = None


class PaymentResponse(BaseModel):
    id: str
    amount_tzs: float
    provider: str
    provider_reference: str | None = None
    status: str
    sandbox: bool | None = None
    note: str | None = None
    idempotent: bool | None = None
    plan_id: str | None = None
    plan_name: str | None = None


class PaymentPlanCreate(BaseModel):
    name: str
    description: str | None = None
    amount_tzs: float
    currency: str = "TZS"
    audience: str = "both"  # student | teacher | both
    is_active: bool = True


class PaymentPlanUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    amount_tzs: float | None = None
    currency: str | None = None
    audience: str | None = None
    is_active: bool | None = None


class PaymentPlanResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    amount_tzs: float
    currency: str
    audience: str
    is_active: bool
    created_at: str | None = None


class PlanCheckoutRequest(BaseModel):
    mobile_number: str
    provider: str = "azampay"
    idempotency_key: str | None = None
