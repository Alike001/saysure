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
export function renderRequests(items, session, tools) {
  const host = document.getElementById('requests'); host.replaceChildren();
  if (!items.length) { host.append(element('p', 'No requests for this account.')); return; }
  for (const item of items) {
    const s = item.snapshot, id = s.request_id, base = `/api/requests/${id}`;
    const article = element('article');
    const heading = element('h3', `${item.display_amount} — ${s.merchant_name}`);
    heading.id = `heading-${id}`; article.setAttribute('aria-labelledby', heading.id);
    article.append(heading);
    article.append(element('p', 'SYNTHETIC DATA — merchant details are helper-supplied and unverified.'));
    const list = element('dl');
    for (const [label, value] of [
      ['Request', id], ['Merchant ID', s.merchant_id], ['Merchant displayed name (unverified)', s.merchant_name],
      ['Exact amount and currency', item.display_amount], ['Minor units', s.amount_minor],
      ['Description', s.description], ['Buyer account', s.buyer_id], ['Revision', String(s.revision)],
      ['Expires', new Date(s.expires_at).toLocaleString()], ['Status', item.status],
    ]) list.append(element('dt', label), element('dd', value));
    article.append(list);
    if (session.user.role === 'helper' && ['pending', 'approved'].includes(item.status)) {
      addButton(article, 'Revise request (invalidates consent)', async () => tools.edit(item), tools.perform);
    }
    if (session.user.role === 'buyer') {
      if (item.status === 'pending') {
        const label = element('label'), check = element('input'); check.type = 'checkbox';
        check.id = `review-${id}`; check.style.width = 'auto';
        label.htmlFor = check.id;
        label.append(check, document.createTextNode(' I reviewed this exact amount, currency, merchant and description. Approval records app consent only; it does not make a payment.'));
        article.append(label);
        addButton(article, 'Approve this synthetic request with my passkey', async () => {
          if (!check.checked) { check.focus(); throw new Error('Review the details and check the confirmation before using your passkey.'); }
          const options = await tools.api(`${base}/options`, { digest: item.digest });
          const response = await window.SimpleWebAuthnBrowser.startAuthentication({ optionsJSON: options.options });
          await tools.api(`${base}/approve`, { challengeId: options.challengeId, response });
          await tools.refresh(); tools.notify('Consent approved for these exact details. No payment was authorized or made.');
        }, tools.perform);
        addButton(article, 'Reject this request', async () => {
          await tools.api(`${base}/reject`, { digest: item.digest });
          await tools.refresh(); tools.notify('Request rejected. No approval or payment was made.');
        }, tools.perform);
      }
      if (item.status === 'approved') {
        article.append(element('p', 'Consent recorded. No payment has been authorized or made.'));
        addButton(article, 'Consume consent once (local test only)', async () => {
          await tools.api(`${base}/consume`, { digest: item.digest });
          await tools.refresh(); tools.notify('Consent consumed once for this local test. No payment operation occurred.');
        }, tools.perform);
        addButton(article, 'Withdraw consent', async () => {
          await tools.api(`${base}/withdraw`, { digest: item.digest });
          await tools.refresh(); tools.notify('Local consent withdrawn. It cannot be consumed.');
        }, tools.perform);
      }
      if (item.status === 'expired') article.append(element('p', 'This request expired. It cannot be approved or consumed.'));
      if (item.status === 'consumed') article.append(element('p', 'Local consent already consumed. It cannot be reused. No payment was made.'));
    }
    host.append(article);
  }
}
