export class SignatureVerifier {
  constructor(options = {}) {
    this._options = {
      algorithm: 'SHA-256',
      required: false,
      publicKeys: new Map(),
      ...options
    };
  }

  async verify(pkg) {
    if (!pkg.signature) {
      return !this._options.required;
    }
    try {
      const content = this._getContentToVerify(pkg);
      const isValid = await this._verifySignature(content, pkg.signature, pkg.signingKeyId);
      return isValid;
    } catch {
      return false;
    }
  }

  async verifyWithKey(pkg, publicKeyPem) {
    try {
      const content = this._getContentToVerify(pkg);
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const signature = this._decodeBase64(pkg.signature.value);
      const key = await crypto.subtle.importKey(
        'spki',
        this._decodePEM(publicKeyPem),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      );
      return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
    } catch {
      return false;
    }
  }

  _getContentToVerify(pkg) {
    const manifest = { ...pkg.manifest };
    delete manifest.signature;
    return JSON.stringify(manifest, Object.keys(manifest).sort());
  }

  async _verifySignature(content, signature, keyId) {
    if (this._options.publicKeys.has(keyId)) {
      const keyPem = this._options.publicKeys.get(keyId);
      return this.verifyWithKey({ manifest: JSON.parse(content), signature }, keyPem);
    }
    if (!this._options.required) return true;
    return false;
  }

  _decodePEM(pem) {
    const b64 = pem
      .replace(/-----BEGIN [A-Z ]+-----/g, '')
      .replace(/-----END [A-Z ]+-----/g, '')
      .replace(/\s/g, '');
    return this._decodeBase64(b64);
  }

  _decodeBase64(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
