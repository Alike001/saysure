import { validateConsumptionReceipt } from './consumption.js';
import { reviewedEvidence } from './evidence-provenance.js';
import { answer, topics } from './comprehension.js';
import { addAudio, stopAudio, exactAmount } from './presentation.js';
function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}
function addButton(parent, title, handler, perform) {
  const button = element('button', title); button.type = 'button';
  button.addEventListener('click', () => perform(button, handler)); parent.append(button);
  return button;
}
let expiryTimer;
export function renderRequests(items, session, tools) {
  clearInterval(expiryTimer);
  const expiryChecks = [];
  stopAudio();
  const host = document.getElementById('requests');
  const focused = document.activeElement;
  const previous = focused?.closest('article')?.getAttribute('aria-labelledby');
  const control = focused?.textContent;
  host.replaceChildren();
  if (!items.length) { host.append(element('p', session.user.role === 'buyer' ? 'No requests yet. Ask your Helper to prepare a request, then refresh. You keep the final decision.' : 'No requests yet. Prepare a synthetic request for a Buyer above.')); return; }
  for (const item of items) {
    const s = item.snapshot, id = s.request_id, base = `/api/requests/${id}`;
    const article = element('article');
    const heading = element('h3', `${exactAmount(s)} — ${s.merchant_name}`);
    heading.id = `heading-${id}`; article.setAttribute('aria-labelledby', heading.id);
    heading.tabIndex = -1; article.append(heading);
    const status = element('p', `Status: ${item.status}`); status.className = 'request-status';
    status.setAttribute('role', 'status'); article.append(status);
    const facts = element('dl'); facts.className = 'transaction-facts';
    for (const [label, value] of [
      ['Description', s.description], ['Expires', new Date(s.expires_at).toLocaleString()],
    ]) facts.append(element('dt', label), element('dd', value));
    article.append(facts);
    const advanced = element('details'); advanced.className = 'advanced';
    advanced.append(element('summary', 'Advanced: technical details and operator testing'));
    const explain = element('div'); explain.id = `explain-${id}`; explain.tabIndex = -1;
    if (s.kind === 'paypal') {
      const e = reviewedEvidence(item);
      article.append(element('p', e.provenance === 'mock-paypal-fixture' ? 'MOCK PayPal fixture — no real API verification.' : e.provenance === 'authenticated-sandbox-api' ? 'Recorded authenticated PayPal sandbox observation — shop identity is not independently verified.' : 'PayPal evidence provenance unavailable; verification blocked.'));
      const verification = element('p'), approval = element('p'); article.append(verification, approval);
      const paintEvidence = () => {
        const current = reviewedEvidence(item).current;
        const genuine = e.provenance === 'authenticated-sandbox-api';
        verification.textContent = `${genuine && current ? 'PayPal order verified. ' : ''}Order verification: ${!current ? 'historical or stale; re-review required' : e.provenance === 'mock-paypal-fixture' ? 'MOCK fixture only' : genuine ? 'recent authenticated server read' : 'unavailable; re-review required'}.`;
        approval.textContent = `Recorded provider status: ${s.provider.status}. PayPal buyer approval: ${genuine && current && s.provider.status === 'APPROVED' ? 'reported APPROVED by the recorded API evidence' : 'not established by current evidence'}. Payment authorization and completion: not established. This app never captures. ${genuine && current && s.provider.status === 'CREATED' ? 'PayPal buyer approval not established. Payment not captured in this CREATED order observation.' : ''}`;
      };
      paintEvidence(); expiryChecks.push(paintEvidence);
      article.append(element('p', `PayPal order ID: ${s.provider.order_id}.`));
      article.append(element('p', `Evidence read: ${e.observed_at ? new Date(e.observed_at).toLocaleString() : 'unavailable'}. App buyer identity is not proof of PayPal payer identity.`));
      for (const unit of s.provider.units) article.append(element('p', `Purchase unit ${unit.index}: ${exactAmount(unit)}`));
    } else article.append(element('p', 'SYNTHETIC DATA — helper-supplied recipient, unverified.'));
    if (session.user.role === 'buyer') {
      const link = element('a', 'Listen to details / get explanations'); link.href = `#explain-${id}`;
      link.className = 'explanation-link'; article.append(link);
      explain.append(element('h4', 'Understand this request'));
      addAudio(explain, item, tools.notify);
      const help = element('details'), title = element('summary', 'Questions about these details');
      help.append(title);
      for (const [topic, question] of Object.entries(topics)) {
        const detail = element('details');
        detail.append(element('summary', question), element('p', answer(topic, item))); help.append(detail);
      }
      explain.append(help);
      const questionLabel = element('label', 'Ask a question in your own words');
      const questionInput = element('input'); questionInput.id = `buyer-question-${id}`;
      questionInput.type = 'text'; questionInput.maxLength = 300; questionInput.autocomplete = 'off'; questionInput.placeholder = 'e.g. Does my passkey make a payment?';
      questionLabel.htmlFor = questionInput.id;
      const questionNote = element('p', 'A redacted version of your question may be sent to Groq for topic selection. No request record is attached. Avoid personal, merchant or payment details.');
      questionNote.id = `buyer-question-note-${id}`; questionInput.setAttribute('aria-describedby', questionNote.id);
      const questionResult = element('p'); questionResult.setAttribute('role', 'status');
      explain.append(questionLabel, questionInput, questionNote);
      addButton(explain, 'Ask SaySure', async () => {
        const question = questionInput.value.trim();
        if (question.length < 3) { questionInput.focus(); throw new Error('Enter a question of at least three characters.'); }
        const match = await tools.api('/api/buyer-question', { question });
        const selected = topics[match.topic] ?? topics.unknown;
        const source = match.source === 'ai' ? 'AI matched your question' : 'Local matching was used';
        questionResult.textContent = source + ': ' + selected + ' ' + answer(match.topic, item);
      }, tools.perform);
      explain.append(questionResult);
      explain.append(element('p', 'Audio may be heard by others. Your browser or OS supplies the voice.'));
    }
    const list = element('dl');
    for (const [label, value] of [
      ['Request', id], ['Merchant ID', s.merchant_id], ['Minor units', s.amount_minor],
      ['Buyer account', s.buyer_id], ['Revision', String(s.revision)],
    ]) list.append(element('dt', label), element('dd', value));
    advanced.append(list);
    if (session.user.role === 'helper' && s.kind === 'paypal' && ['pending', 'approved', 'invalidated'].includes(item.status)) {
      addButton(article, 'Re-read PayPal order (invalidates consent)', async () => {
        await tools.api(`${base}/refresh-provider`, { digest: item.digest });
        await tools.refresh(); tools.notify('PayPal order re-read. Review the new revision; prior consent was invalidated.');
      }, tools.perform);
    }
    if (session.user.role === 'helper' && s.kind !== 'paypal' && ['pending', 'approved'].includes(item.status)) {
      addButton(article, 'Revise request (invalidates consent)', async () => tools.edit(item), tools.perform);
    }
    if (session.user.role === 'buyer') {
      if (['pending', 'invalidated'].includes(item.status)) {
        const label = element('label'), check = element('input'); check.type = 'checkbox';
        check.id = `review-${id}`; check.style.width = 'auto';
        label.htmlFor = check.id;
        label.append(check, document.createTextNode(' I reviewed the amount, currency, recipient and description. I consent to these exact details. No payment is made.'));
        article.append(label);
        const prerequisite = element('p', session.enrolled ? 'Confirm your review to approve. Decline needs no passkey.' : 'Set up your own Buyer passkey below to approve. Decline needs no passkey.');
        prerequisite.className = 'prerequisite';
        if (!session.enrolled) {
          const setup = element('a', 'Set up my Buyer passkey'); setup.href = '#register';
          prerequisite.replaceChildren(setup, document.createTextNode(' to approve. Decline needs no passkey.'));
        }
        article.append(prerequisite);
        if (item.synthetic !== true && s.kind !== 'paypal') { article.append(element('p', 'Payment evidence unavailable. Approval blocked.')); host.append(article); continue; }
        const approve = addButton(article, s.kind === 'paypal' ? 'Approve using my passkey — local consent for this PayPal order' : 'Approve using my passkey — synthetic request', async () => {
          if (!check.checked) { check.focus(); throw new Error('Review the details and check the confirmation before using your passkey.'); }
          stopAudio();
          const options = await tools.api(`${base}/options`, { digest: item.digest });
          const response = await window.SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: options.options });
          await tools.api(`${base}/approve`, { challengeId: options.challengeId, response });
          await tools.refresh(); tools.notify('Consent approved for these exact details. No payment was authorized or made.');
        }, tools.perform);
        approve.className = 'primary';
        approve.setAttribute('aria-label', approve.textContent); approve.textContent = 'Approve using my passkey';
        const unavailable = s.kind === 'paypal' && item.status === 'invalidated';
        const updateApproval = () => { approve.disabled = approve.dataset.locked === 'true' || approve.dataset.busy === 'true' || !check.checked || !session.enrolled || unavailable || s.expires_at <= Date.now(); };
        approve.addEventListener('action-finished', updateApproval);
        check.addEventListener('change', updateApproval); updateApproval();
        addButton(article, 'Decline / Reject this request', async () => {
          await tools.api(`${base}/reject`, { digest: item.digest });
          await tools.refresh(); tools.notify('Request rejected. No approval or payment was made.');
        }, tools.perform);
      }
      if (item.status === 'approved') {
        article.append(element('p', 'Buyer consent approved. Consent recorded. No payment has been authorized or made.'));
        advanced.append(element('p', 'Operator / developer test: validate single-use local consent. This is not an ordinary Buyer payment action and makes no payment.'));
        const consume = addButton(advanced, 'Consume consent once (local test only)', async () => {
          consume.dataset.locked = 'true';
          const consumed = await validateConsumptionReceipt(await tools.api(`${base}/consume`, { digest: item.digest }), item);
          // Render the validated receipt immediately; a later list error must not revive this button.
          renderRequests(items.map(i => i.snapshot.request_id === id ? consumed : i), session, tools);
          try { await tools.refresh({ consumption: consumed }); }
          catch {
            tools.notify('Consent consumed once for this local test; the committed receipt was confirmed. The request list could not be refreshed consistently. Do not consume again. No payment operation occurred.');
            return;
          }
          tools.notify('Consent consumed once for this local test. No payment operation occurred.');
        }, tools.perform);
        addButton(article, 'Withdraw consent', async () => {
          await tools.api(`${base}/withdraw`, { digest: item.digest });
          await tools.refresh(); tools.notify('Local consent withdrawn. It cannot be consumed.');
        }, tools.perform);
      }
      if (item.status === 'expired') article.append(element('p', 'This request expired. It cannot be approved or consumed.'));
      if (item.status === 'consumed') article.append(element('p', 'Consent consumed. Local consent already consumed. It cannot be reused. No payment was made.'));
    }
    if (session.user.role === 'buyer') article.append(explain);
    article.append(advanced); host.append(article);
    if (s.kind === 'paypal') {
      let staleNotice = false;
      expiryChecks.push(() => {
        if (staleNotice || Date.now() - (item.paypal_evidence?.observed_at ?? 0) < 60000) return;
        staleNotice = true;
        const notice = element('p', 'PayPal evidence is older than 60 seconds. The server will re-read the order before approval or consumption. If the order has changed or cannot be verified, the action will be blocked.');
        notice.setAttribute('role', 'status');
        article.append(notice);
      });
    }
    if (['pending', 'approved', 'invalidated'].includes(item.status)) {
      let expired = false;
      const expire = () => {
        if (expired || s.expires_at > Date.now()) return;
        expired = true; stopAudio(); status.textContent = 'Status: expired — refresh requests';
        // Keep audio available for historical review; disable consent mutations only.
        for (const button of article.querySelectorAll('button')) {
          if (/Approve|Consume|Decline|Withdraw|Revise|Re-read/.test(button.textContent)) { button.disabled = true; button.dataset.locked = 'true'; }
        }
        for (const check of article.querySelectorAll('input[type=checkbox]')) { check.checked = false; check.disabled = true; }
        const notice = element('p', 'This review expired. Refresh requests. It cannot be approved or consumed.');
        notice.setAttribute('role', 'status'); article.append(notice);
        const help = explain.querySelector('details');
        if (help) for (const [i, p] of [...help.querySelectorAll('details p')].entries()) {
          p.textContent = answer(Object.keys(topics)[i], item);
        }
      };
      expire(); expiryChecks.push(expire);
    }
    if (previous === heading.id) {
      const next = [...article.querySelectorAll('button')].find(b => b.textContent === control && !b.disabled);
      (next ?? heading).focus();
    }
  }
  expiryTimer = setInterval(() => expiryChecks.forEach(check => check()), 1000);
}
