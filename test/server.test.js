import { test } from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../server.js';

test('letter stays locked until five non-empty, sequential answers', async () => {
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
