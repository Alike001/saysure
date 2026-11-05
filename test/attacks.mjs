import { createPrivateKey, sign, createHash } from 'node:crypto';
import { request } from 'node:http';

// Test-only: re-sign altered assertions with the virtual authenticator's test private key.
// This isolates server field checks from generic invalid-signature rejection. Never logs keys.
export async function alterAndSign(actor, proof, attack) {
  const { credentials } = await actor.cdp.send('WebAuthn.getCredentials', { authenticatorId: actor.authenticatorId });
  const credential = credentials.find(c => Buffer.from(c.credentialId, 'base64').toString('base64url') === proof.response.id);
  const key = createPrivateKey({ key: Buffer.from(credential.privateKey, 'base64'), format: 'der', type: 'pkcs8' });
  if (['origin', 'challenge', 'type', 'crossOrigin'].includes(attack)) {
    const data = JSON.parse(Buffer.from(proof.response.response.clientDataJSON, 'base64url').toString());
    data[attack] = attack === 'origin' ? 'https://evil.example' : attack === 'type' ? 'webauthn.create' : attack === 'crossOrigin' ? true : 'incorrect';
    proof.response.response.clientDataJSON = Buffer.from(JSON.stringify(data)).toString('base64url');
  } else {
    const auth = Buffer.from(proof.response.response.authenticatorData, 'base64url');
    if (attack === 'rpHash') auth[0] ^= 1;
    if (attack === 'uv') auth[32] &= ~4;
    if (attack === 'up') auth[32] &= ~1;
    proof.response.response.authenticatorData = auth.toString('base64url');
  }
  const auth = Buffer.from(proof.response.response.authenticatorData, 'base64url');
  const clientHash = createHash('sha256').update(Buffer.from(proof.response.response.clientDataJSON, 'base64url')).digest();
  proof.response.response.signature = sign('sha256', Buffer.concat([auth, clientHash]), key).toString('base64url');
  return proof;
}
export function wrongHost(origin) {
  return new Promise((resolve, reject) => {
    const req = request(`${origin}/api/session`, { headers: { Host: 'evil.example' } }, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode));
    });
    req.on('error', reject); req.end();
  });
}
