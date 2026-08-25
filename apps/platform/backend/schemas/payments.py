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
