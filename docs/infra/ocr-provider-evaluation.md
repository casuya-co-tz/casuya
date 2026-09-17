# Blackboard OCR — Provider Evaluation (B-04)

**Status:** Implemented — Mathpix proxy wired; Recognize button + grade-time OCR  
**Code:** `packages/blackboard/src/integrations/OcrBridge.ts`  
**Decision date:** 2026-09-17

## Context

The blackboard captures student handwriting for practice steps. OCR converts canvas
strokes into text/LaTeX for feedback. When `OCR_PROVIDER=mathpix` is set on the platform,
the embed calls `POST /v1/ocr/handwriting` (Recognize button and grade-time enrichment).
When OCR is off or the network fails, drawing-only work remains `__drawing__` (presence
credit only — not auto-graded as math).

---

## Decision: buy (API), do not build in-house (ADR)

**Decision:** Use **Mathpix via the platform backend proxy** for production math handwriting
OCR. Do **not** build a custom OCR/ML engine for the blackboard in the current phase.

**Status:** Accepted

### Options considered

| Option | Summary | Verdict |
|---|---|---|
| **A. Mathpix API (proxied)** | Server-side LaTeX from handwritten math; keys on Railway only | **Chosen for production** |
| **B. Tesseract.js (client)** | Offline plain text; large WASM bundle | Optional fallback only |
| **C. Build in-house model** | Train/deploy own vision model on classroom strokes | **Rejected for now** |
| **D. Mock provider** | Random LaTeX for dev | Dev/tests only; blocked in production |

### Rationale

1. **Problem shape:** Casuya needs **handwritten equation → LaTeX**, not generic document OCR.
   That requires specialized models and large labeled datasets — outside core product scope.
2. **Constraints:** Low-end Android and 2G/3G favor **small client bundles** and **server-side
   inference**. A credible on-device math OCR model would add megabytes and still underperform
   on classroom handwriting.
3. **Time to value:** The platform proxy, auth, rate limits, Recognize UI, and fixture harness
   are already shipped. Mathpix integration is days; an in-house stack is months–years.
4. **Security:** Proxying through `apps/platform` keeps `MATHPIX_APP_ID` / `MATHPIX_APP_KEY`
   off Vercel and student devices — same pattern as audio and payments microservices.
5. **Cost:** Per-request API pricing is predictable at school scale; building and maintaining
   ML infra has higher fixed cost for a small team.

### What we are not doing

- Training or hosting a custom handwriting model in Phase 1–4.
- Sending Mathpix credentials to the browser.
- Using Tesseract for **math step auto-grading** until classroom accuracy is benchmarked.
- Enabling the `mock` OCR provider in production builds (`disallowMock`).

### Revisit criteria (when to reconsider “build”)

Re-open an in-house or fine-tuned model **only if all** of the following are true:

1. Production Mathpix cost exceeds budget at measured request volume.
2. Accuracy on Tanzanian classroom samples (Swahili/English, low-end devices) is consistently
   unacceptable after prompt/UI mitigations.
3. At least **~1,000+ labeled** student handwriting samples exist for evaluation/training.
4. A dedicated owner exists for model training, evaluation, and on-call inference.

Until then, optimize via **proxy caching**, rate limits, and optional Tesseract for **plain text**
offline — not a from-scratch OCR engine.

### Production configuration

```bash
# Railway — platform service only
OCR_PROVIDER=mathpix
MATHPIX_APP_ID=...
MATHPIX_APP_KEY=...
```

Endpoints: `GET /v1/ocr/status`, `POST /v1/ocr/handwriting` (Bearer JWT, 20 req/min per user).

---

## Providers compared

| Provider | Math LaTeX | Offline | Bundle impact | Cost | Production |
|---|---|---|---|---|---|
| **Mathpix** | Yes | No (HTTP) | None on client if proxied | Paid API | Recommended |
| **Tesseract.js** | No (plain text) | Yes (WASM) | Large (~2–8 MB) | Free | Offline fallback |
| **Mock** | Fake LaTeX | Yes | None | Free | Dev/tests only |

## Recommendation

1. **Production default:** Mathpix via a **platform backend proxy** (`POST /v1/ocr/handwriting`).
   - Keeps `MATHPIX_APP_ID` / `MATHPIX_APP_KEY` off the client.
   - Matches the audio/payments internal-key pattern.
2. **Offline fallback:** Tesseract.js for plain-text labels when the network is unavailable.
   - Do not use for auto-grading math steps until accuracy is benchmarked on classroom samples.
3. **Never enable `mock` in production builds.**

## Wiring checklist

- [x] Platform settings: `OCR_PROVIDER`, `MATHPIX_APP_ID`, `MATHPIX_APP_KEY`
- [x] Backend proxy: `GET /v1/ocr/status`, `POST /v1/ocr/handwriting` (Bearer auth, 20/min rate limit)
- [x] Blackboard embed calls OCR before grading when work is drawing-only (`blackboard-embed.js`)
- [x] `OcrBridge` `proxy` provider for full PlatformBridge integrations
- [x] Golden-image benchmark suite under `packages/blackboard/tests/evaluation/fixtures/`
- [x] On-demand **Recognize** button on platform blackboard embed (when OCR configured)

## References

- Capability matrix (CI-enforced): `packages/blackboard/src/integrations/ocr-providers.ts`
- Unit tests: `packages/blackboard/tests/OcrBridge.test.ts`
- Services plan: [`services-improvement-plan.md`](./services-improvement-plan.md)
