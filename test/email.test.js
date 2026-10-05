import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendAnswersEmail } from '../email.js';

test('email uses fixed recipient, plain text, all answers and stable idempotency key', async () => {
  let request;
  const payload = { id: 'test-session', entries: Array.from({ length: 5 }, (_, i) => ({ question: `Câu ${i + 1}`, answer: `<script>câu trả lời ${i + 1}</script>` })) };
  const id = await sendAnswersEmail(payload, {
    apiKey: 'test-key', to: 'receiver@example.com', from: 'sender@example.com',
    fetchImpl: async (url, options) => { request = { url, ...options }; return { ok: true, json: async () => ({ id: 'email-123' }) }; }
  });
  assert.equal(id, 'email-123');
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.headers['Idempotency-Key'], 'letter-answers/test-session');
  const data = JSON.parse(request.body);
  assert.deepEqual(data.to, ['receiver@example.com']);
  assert.equal(data.html, undefined);
  assert.ok(data.text.includes('5. Câu 5'));
  assert.ok(data.text.includes('<script>câu trả lời 5</script>'));
  await assert.rejects(sendAnswersEmail(payload, { apiKey: 'test-key', to: 'receiver@example.com', fetchImpl: async () => ({ ok: false, status: 429 }) }), /429/);
  await assert.rejects(sendAnswersEmail(payload, { apiKey: '', to: 'receiver@example.com' }), /configuration/);
});
