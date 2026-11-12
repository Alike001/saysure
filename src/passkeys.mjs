import { generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { ensure, random, clientData, Failure } from './core.mjs';
import { buyer } from './identity.mjs';

export function passkeyService(store, requests, config, paypal) {
  const credential = buyerId => store.get('SELECT * FROM credentials WHERE buyer_id=?', buyerId);
  async function liveSession(session, executor = store) {
    ensure(await executor.get('SELECT id FROM sessions WHERE id=? AND user_id=? AND expires>?',
      session.id, session.user_id, Date.now()), 'SESSION_EXPIRED', 401);
  }
  async function saveChallenge(session, kind, challenge, row = null) {
    const id = random();
    await store.transaction(async tx => {
      await liveSession(session, tx);
      await tx.run('UPDATE challenges SET used=2 WHERE session_id=? AND kind=?', session.id, kind);
      await tx.run(`INSERT INTO challenges(id,session_id,buyer_id,kind,request_id,digest,challenge,expires)
        VALUES(?,?,?,?,?,?,?,?)`, id, session.id, session.user_id, kind, row?.id ?? null,
      row?.digest ?? null, challenge, Math.min(Date.now() + 120_000,
        row ? JSON.parse(row.snapshot).expires_at : session.expires));
    });
    return id;
  }
  async function take(session, kind, id, requestId = null) {
    buyer(session);
    ensure(typeof id === 'string' && /^[A-Za-z0-9_-]{43}$/.test(id), 'INVALID_CHALLENGE_ID', 400);
    return store.transaction(async tx => {
      await liveSession(session, tx);
      const c = await tx.get('SELECT * FROM challenges WHERE id=?', id);
      ensure(c && c.session_id === session.id && c.buyer_id === session.user_id &&
        c.kind === kind && c.request_id === requestId, 'CHALLENGE_NOT_OWNED', 403);
      ensure(c.used === 0 && c.expires > Date.now(), 'CHALLENGE_EXPIRED_OR_USED');
      const updated = await tx.run('UPDATE challenges SET used=1 WHERE id=? AND used=0', id);
      ensure(updated.changes === 1, 'CHALLENGE_EXPIRED_OR_USED');
      return c;
    });
  }
  async function stillCurrent(session, c, executor = store) {
    await liveSession(session, executor);
    ensure(c.expires > Date.now() && (await executor.get('SELECT used FROM challenges WHERE id=?', c.id))?.used === 1,
      'CHALLENGE_EXPIRED_OR_SUPERSEDED');
  }
  async function registrationOptions(session) {
    buyer(session);
    ensure(!await credential(session.user_id), 'BUYER_ALREADY_ENROLLED');
    const options = await generateRegistrationOptions({ rpName: 'SaySure', rpID: config.rpID,
      userName: session.user_id, userID: new TextEncoder().encode(session.user_id),
      attestationType: 'none', supportedAlgorithmIDs: [-7, -257], timeout: 120_000,
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' } });
    return { options, challengeId: await saveChallenge(session, 'register', options.challenge) };
  }
  async function register(session, input) {
    const c = await take(session, 'register', input.challengeId);
    ensure(!await credential(session.user_id), 'BUYER_ALREADY_ENROLLED');
    clientData(input.response);
    let result;
    try {
      result = await verifyRegistrationResponse({ response: input.response,
        expectedChallenge: c.challenge, expectedOrigin: config.origin, expectedRPID: config.rpID,
        requireUserPresence: true, requireUserVerification: true, supportedAlgorithmIDs: [-7, -257] });
    } catch { throw new Failure('PASSKEY_REGISTRATION_FAILED', 400); }
    ensure(result.verified && result.registrationInfo.userVerified, 'PASSKEY_REGISTRATION_FAILED', 400);
    const info = result.registrationInfo, key = info.credential;
    await store.transaction(async tx => {
      await stillCurrent(session, c, tx);
      ensure(!await tx.get('SELECT id FROM credentials WHERE buyer_id=? OR id=?', session.user_id, key.id),
        'BUYER_ALREADY_ENROLLED');
      await tx.run('INSERT INTO credentials VALUES(?,?,?,?,?,?,?)', key.id, session.user_id,
        Buffer.from(key.publicKey), key.counter, JSON.stringify(key.transports ?? []),
        info.credentialDeviceType, Number(info.credentialBackedUp));
      await tx.run('UPDATE challenges SET used=3 WHERE id=?', c.id);
      await tx.event(session.user_id, 'passkey_registered');
    });
    return { registered: true, user_verified: true };
  }
  async function approvalOptions(session, id, expectedDigest) {
    buyer(session);
    const row = await requests.owned(id, session); requests.intact(row);
    ensure(row.status === 'pending', 'REQUEST_NOT_PENDING');
    ensure(row.digest === expectedDigest, 'DETAILS_CHANGED_REVIEW_AGAIN');
    const key = await credential(session.user_id);
    ensure(key, 'ENROLL_BUYER_PASSKEY_FIRST');
    const proof = await paypal?.revalidate(session, id);
    const options = await generateAuthenticationOptions({ rpID: config.rpID, timeout: 120_000,
      userVerification: 'required', allowCredentials: [{ id: key.id, transports: JSON.parse(key.transports) }] });
    const current = await requests.owned(id, session); requests.intact(current);
    ensure(current.status === 'pending' && current.digest === row.digest, 'DETAILS_CHANGED_REVIEW_AGAIN');
    await requests.assertEvidence(current, proof);
    return { options, challengeId: await saveChallenge(session, 'approve', options.challenge, current), digest: current.digest };
  }
  async function approve(session, id, input) {
    const c = await take(session, 'approve', input.challengeId, id);
    const row = await requests.owned(id, session); requests.intact(row);
    ensure(row.status === 'pending' && row.digest === c.digest, 'DETAILS_CHANGED_REVIEW_AGAIN');
    const key = await credential(session.user_id);
    ensure(key && input.response?.id === key.id, 'WRONG_BUYER_CREDENTIAL', 403);
    clientData(input.response);
    const handle = input.response.response.userHandle;
    ensure(!handle || handle === Buffer.from(session.user_id).toString('base64url'), 'WRONG_USER_HANDLE', 403);
    let result;
    try {
      result = await verifyAuthenticationResponse({ response: input.response,
        expectedChallenge: c.challenge, expectedOrigin: config.origin, expectedRPID: config.rpID,
        requireUserVerification: true,
        credential: { id: key.id, publicKey: new Uint8Array(key.public_key), counter: key.counter,
          transports: JSON.parse(key.transports) } });
    } catch { throw new Failure('PASSKEY_AUTHENTICATION_FAILED', 400); }
    ensure(result.verified && result.authenticationInfo.userVerified, 'PASSKEY_AUTHENTICATION_FAILED', 400);
    const proof = await paypal?.revalidate(session, id);
    return store.transaction(async tx => {
      await stillCurrent(session, c, tx);
      const current = await requests.owned(id, session, { executor: tx }); requests.intact(current);
      ensure(current.status === 'pending' && current.digest === c.digest, 'DETAILS_CHANGED_REVIEW_AGAIN');
      await requests.assertEvidence(current, proof, tx);
      const updated = await tx.run(`UPDATE requests SET status='approved',consent_digest=?
        WHERE id=? AND status='pending' AND digest=?`, c.digest, id, c.digest);
      ensure(updated.changes === 1, 'ALREADY_APPROVED_OR_MODIFIED');
      await tx.run('UPDATE credentials SET counter=? WHERE id=?', result.authenticationInfo.newCounter, key.id);
      await tx.run('UPDATE challenges SET used=3 WHERE id=?', c.id);
      await tx.event(session.user_id, 'consent_approved', id);
      return requests.view(await tx.request(id), tx);
    });
  }
  return { credential, registrationOptions, register, approvalOptions, approve };
}
