import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.js';

test('letter stays locked until five non-empty, sequential answers', async () => {
  const server = createServer({ mailEnabled: false });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const stateResponse = await fetch(`${base}/api/state`);
    const cookie = stateResponse.headers.get('set-cookie').split(';')[0];
    const state = await stateResponse.json();
    assert.equal(state.step, 0);
    assert.equal(state.questions.length, 5);
    const answer = (step, text, origin) => fetch(`${base}/api/answer`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify({ step, answer: text }) });
    assert.equal((await fetch(`${base}/api/letter`, { headers: { Cookie: cookie } })).status, 403);
    assert.equal((await answer(0, '  ')).status, 400);
    assert.equal((await answer(4, 'skip')).status, 409);
    assert.equal((await answer(0, 'a'.repeat(2001))).status, 400);
    assert.equal((await answer(0, 'hello', 'https://another-site.example')).status, 403);
    for (let step = 0; step < 5; step++) {
      const response = await answer(step, `Câu trả lời bất kỳ ${step}: <script>alert(1)</script>`);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).step, step + 1);
      if (step < 4) assert.equal((await fetch(`${base}/api/letter`, { headers: { Cookie: cookie } })).status, 403);
    }
    assert.equal((await answer(4, 'double click')).status, 409);
    const letterResponse = await fetch(`${base}/api/letter`, { headers: { Cookie: cookie } });
    assert.equal(letterResponse.status, 200);
    const letter = await letterResponse.json();
    assert.equal(letter.paragraphs.length, 2);
    assert.ok(letter.paragraphs[1].includes('hoa khôi mầm non'));
    assert.equal((await fetch(`${base}/api/state`, { headers: { Cookie: cookie } }).then(r => r.json())).step, 5);
    assert.equal((await fetch(`${base}/api/letter`)).status, 403);
    assert.equal((await fetch(`${base}/content.js`)).status, 404);
    assert.equal((await fetch(`${base}/server.js`)).status, 404);
    assert.equal((await fetch(`${base}/health`)).status, 200);
    for (const path of ['/', '/style.css', '/app.js', '/favicon.svg']) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200);
      assert.ok(!(await response.text()).includes('hoa khôi mầm non'));
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('email is sent only after five answers and failures can retry without losing answers', async () => {
  const attempts = [];
  const server = createServer({ mailEnabled: true, mailer: async (payload) => { attempts.push(payload); if (attempts.length === 1) throw new Error('Simulated service outage'); return 'accepted'; } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const stateResponse = await fetch(base + '/api/state');
    const cookie = stateResponse.headers.get('set-cookie').split(';')[0];
    assert.equal((await stateResponse.json()).collectsAnswers, true);
    const headers = { Cookie: cookie, 'Content-Type': 'application/json' };
    const answer = (step) => fetch(base + '/api/answer', { method: 'POST', headers, body: JSON.stringify({ step, answer: `Trả lời ${step + 1}` }) });
    for (let i = 0; i < 4; i++) assert.equal((await answer(i)).status, 200);
    assert.equal(attempts.length, 0);
    assert.equal((await answer(4)).status, 503);
    assert.equal((await fetch(base + '/api/letter', { headers })).status, 403);
    assert.equal((await answer(4)).status, 200);
    assert.equal(attempts.length, 2);
    assert.equal(attempts[0].id, attempts[1].id);
    assert.equal(attempts[1].entries.length, 5);
    assert.deepEqual(attempts[1].entries.map(e => e.answer), ['Trả lời 1', 'Trả lời 2', 'Trả lời 3', 'Trả lời 4', 'Trả lời 5']);
    const state = await fetch(base + '/api/state', { headers }).then(r => r.json());
    assert.equal(state.step, 5);
    assert.equal(state.answers, undefined);
    assert.equal(state.draftAnswers, undefined);
    assert.equal((await answer(4)).status, 409);
    assert.equal(attempts.length, 2);
    assert.equal((await fetch(base + '/api/letter', { headers })).status, 200);
    assert.equal((await fetch(base + '/email.js')).status, 404);
    assert.equal((await fetch(base + '/.env.example')).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('editing earlier answers preserves progress and emails only the latest version', async () => {
  const emails = [];
  const server = createServer({ mailEnabled: true, mailer: async payload => { emails.push(payload); return 'accepted'; } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(base + '/api/state');
    const cookie = response.headers.get('set-cookie').split(';')[0];
    const headers = { Cookie: cookie, 'Content-Type': 'application/json' };
    const answer = (step, text) => fetch(base + '/api/answer', { method: 'POST', headers, body: JSON.stringify({ step, answer: text }) });
    for (let i = 0; i < 4; i++) assert.equal((await answer(i, `Bản cũ ${i + 1}`)).status, 200);
    const edit = await answer(0, 'Bản mới của câu 1');
    assert.equal(edit.status, 200);
    assert.equal((await edit.json()).step, 4);
    assert.equal((await answer(-1, 'invalid')).status, 409);
    assert.equal((await answer(1, '  ')).status, 400);
    const state = await fetch(base + '/api/state', { headers }).then(r => r.json());
    assert.deepEqual(state.draftAnswers, ['Bản mới của câu 1', 'Bản cũ 2', 'Bản cũ 3', 'Bản cũ 4']);
    const otherSession = await fetch(base + '/api/state').then(r => r.json());
    assert.deepEqual(otherSession.draftAnswers, []);
    assert.equal((await fetch(base + '/api/letter', { headers })).status, 403);
    assert.equal(emails.length, 0);
    assert.equal((await answer(4, 'Câu cuối')).status, 200);
    assert.equal(emails.length, 1);
    assert.deepEqual(emails[0].entries.map(e => e.answer), ['Bản mới của câu 1', 'Bản cũ 2', 'Bản cũ 3', 'Bản cũ 4', 'Câu cuối']);
    assert.equal((await answer(0, 'Sửa sau khi gửi')).status, 409);
    assert.equal(emails.length, 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
