# Security

## Signature verification

Packages built by `casuya-core` are signed with HMAC-SHA256 over the body +
manifest, using a shared secret. `security/signatures.js` verifies this
using the Web Crypto API (`crypto.subtle`):

```js
import { verifyOrThrow } from 'casuya-bridge';
await verifyOrThrow(bodyHtml + manifestJson, signatureHex, sharedSigningKey);
```

## Content-hash integrity

Independent of signing, each manifest carries a `content_hash` (SHA-256 of
the compiled body). `security/integrity.js` re-hashes cached content and
compares, catching silent corruption in IndexedDB or during transfer.

## Structural validation

`security/validation.js` checks that a decoded package contains the
required `body.html` and valid-JSON `manifest.json` before anything is
handed to the renderer.

## Sanitization

`security/sanitization.js` is a conservative stripping utility for the rare
cases where lesson content is shown *outside* the iframe/shadow-DOM sandbox
(e.g. a plain-text search snippet) — it is not a substitute for the
sandbox itself, which is what protects the host page from lesson script.
