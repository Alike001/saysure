import { generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { ensure, random, clientData, Failure } from './core.mjs';
import { buyer } from './identity.mjs';

export function passkeyService(store, requests, config) {
  const credential = buyerId => store.get('SELECT * FROM credentials WHERE buyer_id=?', buyerId);
  function liveSession(session) {
    ensure(store.get('SELECT id FROM sessions WHERE id=? AND user_id=? AND expires>?',
      session.id, session.user_id, Date.now()), 'SESSION_EXPIRED', 401);
  }
  function saveChallenge(session, kind, challenge, row = null) {
    const id = random();
    store.atomic(() => {
      liveSession(session);
      store.run('UPDATE challenges SET used=2 WHERE session_id=? AND kind=?', session.id, kind);
      store.run(`INSERT INTO challenges(id,session_id,buyer_id,kind,request_id,digest,challenge,expires)
        VALUES(?,?,?,?,?,?,?,?)`, id, session.id, session.user_id, kind, row?.id ?? null,
      row?.digest ?? null, challenge, Math.min(Date.now() + 120_000,
        row ? JSON.parse(row.snapshot).expires_at : session.expires));
    });
    return id;
  }
  function take(session, kind, id, requestId = null) {
    buyer(session);
    ensure(typeof id === 'string' && /^[A-Za-z0-9_-]{43}$/.test(id), 'INVALID_CHALLENGE_ID', 400);
    return store.atomic(() => {
      liveSession(session);
      const c = store.get('SELECT * FROM challenges WHERE id=?', id);
      ensure(c && c.session_id === session.id && c.buyer_id === session.user_id &&
        c.kind === kind && c.request_id === requestId, 'CHALLENGE_NOT_OWNED', 403);
      ensure(c.used === 0 && c.expires > Date.now(), 'CHALLENGE_EXPIRED_OR_USED');
      store.run('UPDATE challenges SET used=1 WHERE id=? AND used=0', id);
      return c;
    });
  }
  function stillCurrent(session, c) {
    liveSession(session);
    ensure(c.expires > Date.now() && store.get('SELECT used FROM challenges WHERE id=?', c.id)?.used === 1,
      'CHALLENGE_EXPIRED_OR_SUPERSEDED');
  }
  async function registrationOptions(session) {
    buyer(session);
    ensure(!credential(session.user_id), 'BUYER_ALREADY_ENROLLED');
    const options = await generateRegistrationOptions({ rpName: 'Synthetic consent experiment', rpID: config.rpID,
      userName: session.user_id, userID: new TextEncoder().encode(session.user_id),
      attestationType: 'none', supportedAlgorithmIDs: [-7, -257], timeout: 120_000,
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' } });
    return { options, challengeId: saveChallenge(session, 'register', options.challenge) };
  }
  async function register(session, input) {
    const c = take(session, 'register', input.challengeId);
    ensure(!credential(session.user_id), 'BUYER_ALREADY_ENROLLED');
    clientData(input.response);
    let result;
    try {
      result = await verifyRegistrationResponse({ response: input.response,
        expectedChallenge: c.challenge, expectedOrigin: config.origin, expectedRPID: config.rpID,
        requireUserPresence: true, requireUserVerification: true, supportedAlgorithmIDs: [-7, -257] });
    } catch { throw new Failure('PASSKEY_REGISTRATION_FAILED', 400); }
    ensure(result.verified && result.registrationInfo.userVerified, 'PASSKEY_REGISTRATION_FAILED', 400);
    const info = result.registrationInfo, key = info.credential;
    store.atomic(() => {
      stillCurrent(session, c);
      ensure(!credential(session.user_id) && !store.get('SELECT id FROM credentials WHERE id=?', key.id),
        'BUYER_ALREADY_ENROLLED');
      store.run('INSERT INTO credentials VALUES(?,?,?,?,?,?,?)', key.id, session.user_id,
        Buffer.from(key.publicKey), key.counter, JSON.stringify(key.transports ?? []),
        info.credentialDeviceType, Number(info.credentialBackedUp));
      store.run('UPDATE challenges SET used=3 WHERE id=?', c.id);
      store.event(session.user_id, 'passkey_registered');
    });
    return { registered: true, user_verified: true };
  }
  async function approvalOptions(session, id, expectedDigest) {
    buyer(session);
    const row = requests.owned(id, session); requests.intact(row);
    ensure(row.status === 'pending', 'REQUEST_NOT_PENDING');
    ensure(row.digest === expectedDigest, 'DETAILS_CHANGED_REVIEW_AGAIN');
    const key = credential(session.user_id);
    ensure(key, 'ENROLL_BUYER_PASSKEY_FIRST');
    const options = await generateAuthenticationOptions({ rpID: config.rpID, timeout: 120_000,
      userVerification: 'required', allowCredentials: [{ id: key.id, transports: JSON.parse(key.transports) }] });
    // Recheck after the asynchronous library call, before binding the challenge.
    const current = requests.owned(id, session); requests.intact(current);
    ensure(current.status === 'pending' && current.digest === row.digest, 'DETAILS_CHANGED_REVIEW_AGAIN');
    return { options, challengeId: saveChallenge(session, 'approve', options.challenge, current), digest: current.digest };
  }
  async function approve(session, id, input) {
    const c = take(session, 'approve', input.challengeId, id);
    const row = requests.owned(id, session); requests.intact(row);
    ensure(row.status === 'pending' && row.digest === c.digest, 'DETAILS_CHANGED_REVIEW_AGAIN');
    const key = credential(session.user_id);
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
    return store.atomic(() => {
      stillCurrent(session, c);
      const current = requests.owned(id, session); requests.intact(current);
      ensure(current.status === 'pending' && current.digest === c.digest, 'DETAILS_CHANGED_REVIEW_AGAIN');
      const updated = store.run(`UPDATE requests SET status='approved',consent_digest=?
        WHERE id=? AND status='pending' AND digest=?`, c.digest, id, c.digest);
      ensure(updated.changes === 1, 'ALREADY_APPROVED_OR_MODIFIED');
      store.run('UPDATE credentials SET counter=? WHERE id=?', result.authenticationInfo.newCounter, key.id);
      store.run('UPDATE challenges SET used=3 WHERE id=?', c.id);
      store.event(session.user_id, 'consent_approved', id);
      return requests.view(store.request(id));
    });
  }
  return { credential, registrationOptions, register, approvalOptions, approve };
}
