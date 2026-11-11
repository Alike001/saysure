import test from 'node:test';
import assert from 'node:assert/strict';
import { createBuyerQuestionRouter, redactBuyerQuestion } from '../src/buyer-question.mjs';

test('redacts common private and transaction identifiers before model routing', () => {
  const safe = redactBuyerQuestion('Is Example Store charging $12.50 USD? Order MOCKPAYEE123, email ali@example.com');
  assert.doesNotMatch(safe, /12\.50|MOCKPAYEE123|ali@example\.com|Example Store/);
  assert.match(safe, /redacted/);
});

test('sends only the redacted question and accepts one allowlisted topic', async () => {
  let request;
  const route = createBuyerQuestionRouter({
    apiKey: 'gsk_test_key_for_unit_test_only_1234567890',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"topic":"merchant"}' } }] }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }
  });
  const result = await route({
    actor: 'buyer-a',
    question: 'Is Example Store charging $12.50 USD? Order MOCKPAYEE123, email ali@example.com'
  });
  assert.deepEqual(result, { topic: 'merchant', source: 'ai' });
  assert.equal(request.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(request.options.headers.Authorization, 'Bearer gsk_test_key_for_unit_test_only_1234567890');
  const body = JSON.parse(request.options.body);
  assert.equal(body.messages.length, 2);
  assert.doesNotMatch(JSON.stringify(body), /12\.50|MOCKPAYEE123|ali@example\.com|Example Store/);
  assert.doesNotMatch(JSON.stringify(body), /amount_minor|order_id|merchant_id|buyer_id|passkey|consent_digest/);
});

test('uses deterministic local matching when no key or provider response is available', async () => {
  const local = createBuyerQuestionRouter();
  assert.deepEqual(await local({ question: 'Does my passkey make a payment?', actor: 'buyer-a' }),
    { topic: 'consent', source: 'local' });
  const unavailable = createBuyerQuestionRouter({
    apiKey: 'gsk_test_key_for_unit_test_only_1234567890',
    fetchImpl: async () => { throw new Error('offline'); }
  });
  assert.deepEqual(await unavailable({ question: 'What is the total amount?', actor: 'buyer-a' }),
    { topic: 'amount', source: 'local' });
});

test('rejects malformed questions and rate-limits each actor', async () => {
  const route = createBuyerQuestionRouter({ limit: 2, now: () => 60_000 });
  await assert.rejects(() => route({ question: '', actor: 'buyer-a' }), /INVALID_BUYER_QUESTION/);
  await route({ question: 'What is the amount?', actor: 'buyer-a' });
  await route({ question: 'What is the amount?', actor: 'buyer-a' });
  await assert.rejects(() => route({ question: 'What is the amount?', actor: 'buyer-a' }), /BUYER_QUESTION_RATE_LIMIT/);
});
