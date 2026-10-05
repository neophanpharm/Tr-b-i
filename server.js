import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { questions, letter } from './content.js';
import { isEmailConfigured, sendAnswersEmail } from './email.js';

const sessions = new Map();
const lifetime = 24 * 60 * 60 * 1000;
const assets = new Map([['/', ['index.html', 'text/html']], ['/style.css', ['style.css', 'text/css']], ['/app.js', ['app.js', 'text/javascript']], ['/favicon.svg', ['favicon.svg', 'image/svg+xml']]]);
const publicDir = fileURLToPath(new URL('./public/', import.meta.url));
const cleanup = setInterval(() => { for (const [id, s] of sessions) if (Date.now() - s.created > lifetime) sessions.delete(id); }, 60000);
cleanup.unref();

function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); }
function session(req, res) {
  const id = /(?:^|;\s*)letter_session=([a-f0-9]{48})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
  let s = sessions.get(id);
  if (!s || Date.now() - s.created > lifetime) {
    if (sessions.size >= 10000) return null;
    const token = randomBytes(24).toString('hex');
    s = { created: Date.now(), step: 0, answers: [], emailId: randomBytes(16).toString('hex'), sending: false };
    sessions.set(token, s);
    const secure = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader('Set-Cookie', `letter_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${secure ? '; Secure' : ''}`);
  }
  return s;
}
async function body(req) {
  let data = '';
  for await (const chunk of req) { data += chunk; if (Buffer.byteLength(data) > 16000) throw new Error('Too large'); }
  return JSON.parse(data);
}

export function createServer({ mailEnabled = isEmailConfigured(), mailer = sendAnswersEmail } = {}) {
return http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/health' && req.method === 'GET') return json(res, 200, { ok: true });
    if (path.startsWith('/api/')) {
      if (req.method === 'POST' && req.headers.origin) {
        if (new URL(req.headers.origin).host !== req.headers.host) return json(res, 403, { error: 'Yêu cầu không hợp lệ.' });
      }
      const s = session(req, res);
      if (!s) return json(res, 503, { error: 'Trang đang bận một chút. Cậu thử lại sau nhé.' });
      if (path === '/api/state' && req.method === 'GET') return json(res, 200, { step: s.step, questions, collectsAnswers: mailEnabled });
      if (path === '/api/answer' && req.method === 'POST') {
        const { step, answer } = await body(req);
        if (!Number.isInteger(step) || step !== s.step || step >= questions.length) return json(res, 409, { error: 'Mình tải lại câu hỏi hiện tại nhé.', step: s.step });
        if (typeof answer !== 'string' || !answer.trim() || answer.length > 2000) return json(res, 400, { error: 'Cậu viết một chút nhé (tối đa 2.000 ký tự).' });
        if (s.sending) return json(res, 429, { error: 'Câu trả lời đang được gửi, cậu đợi một chút nhé.' });
        if (mailEnabled) {
          if (step === questions.length - 1) {
            s.sending = true;
            try {
              await mailer({ id: s.emailId, entries: [...s.answers, answer.trim()].map((text, index) => ({ question: questions[index].title, answer: text })) });
              s.answers = [];
            } catch {
              console.error('Email delivery failed; last answer can be retried.');
              return json(res, 503, { error: 'Chưa gửi được câu trả lời. Cậu nhấn gửi lại nhé, những câu trước vẫn được giữ.' });
            } finally { s.sending = false; }
          } else s.answers.push(answer.trim());
        }
        s.step++;
        return json(res, 200, { step: s.step });
      }
      if (path === '/api/letter' && req.method === 'GET') {
        if (s.step !== questions.length) return json(res, 403, { error: 'Còn vài câu hỏi nhỏ trước khi mở thư nhé.' });
        return json(res, 200, letter);
      }
      return json(res, 404, { error: 'Không tìm thấy.' });
    }
    const asset = assets.get(path);
    if (!asset || !['GET', 'HEAD'].includes(req.method)) return json(res, 404, { error: 'Không tìm thấy.' });
    const file = await readFile(publicDir + asset[0]);
    res.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8` });
    res.end(req.method === 'HEAD' ? undefined : file);
  } catch { json(res, 400, { error: 'Chưa gửi được. Cậu thử lại nhé.' }); }
});
}

export const server = createServer();

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 3000);
  server.listen(port, '0.0.0.0', () => console.log(`Gửi cậu: http://localhost:${port}`));
}
