// Emits a fresh valid P-256 ECDH public-key JWK string (the attacker holds the
// matching private key). Byte-identical shape to what registration stores.
const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])
const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey)
process.stdout.write(JSON.stringify(jwk))
