const $ = (id) => document.getElementById(id);
let step = 0;
let completedStep = 0;
let answers = [];
let questions = [];
let busy = false;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const storage = {
  get(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { sessionStorage.setItem(key, value); } catch {} },
  remove(key) { try { sessionStorage.removeItem(key); } catch {} }
};
let paused = storage.get('paused') === 'true';
function motion() {
  document.body.classList.toggle('paused', paused);
  $('motion-toggle').textContent = paused ? 'Bật chuyển động' : 'Dừng chuyển động';
  $('motion-toggle').setAttribute('aria-pressed', String(paused));
}
motion();
$('motion-toggle').addEventListener('click', () => { paused = !paused; storage.set('paused', String(paused)); motion(); });

async function api(path, data) {
  const response = await fetch(path, { credentials: 'same-origin', ...(data ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}) });
  const result = await response.json();
  if (!response.ok) { const error = new Error(result.error || 'Cậu thử lại nhé.'); error.status = response.status; throw error; }
  return result;
}
function show(id, focus) {
  document.querySelectorAll('.view').forEach((view) => { view.hidden = view.id !== id; });
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (focus) $(focus).focus({ preventScroll: true });
}
function renderQuestion() {
  if (step >= questions.length) return show('ready', 'ready-title');
  const question = questions[step];
  $('progress').replaceChildren(...questions.map((_, index) => {
    const node = document.createElement('span');
    node.className = index === step ? 'current' : index < completedStep ? 'done' : '';
    return node;
  }));
  $('progress').setAttribute('aria-label', `Đã trả lời ${completedStep} trên ${questions.length} câu hỏi, đang xem câu ${step + 1}`);
  $('question-tag').textContent = question.tag;
  $('question-number').textContent = `0${step + 1} / 0${questions.length}`;
  $('question-title').textContent = question.title;
  $('question-hint').textContent = question.hint;
  $('answer').value = storage.get(`draft-${step}`) ?? answers[step] ?? '';
  $('counter').textContent = `${$('answer').value.length} / 2000`;
  $('answer-error').textContent = '';
  $('answer').removeAttribute('aria-invalid');
  $('next').innerHTML = step === questions.length - 1 ? 'Đến chiếc thư của tớ <span aria-hidden="true">♡</span>' : 'Câu tiếp theo <span aria-hidden="true">→</span>';
  $('previous').hidden = step === 0;
  $('edit-note').hidden = false;
  show('quiz', 'question-title');
  $('question-card').getAnimations().forEach((a) => a.cancel());
  if (!paused && !reduced.matches) $('question-card').animate([{ opacity: .3, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 350, easing: 'ease-out' });
}
async function init() {
  $('retry').hidden = true;
  $('connection-error').textContent = '';
  try {
    const state = await api('/api/state');
    step = state.step;
    completedStep = state.step;
    answers = state.draftAnswers || [];
    questions = state.questions;
    $('delivery-note').hidden = !state.collectsAnswers;
    $('start').disabled = false;
    $('start').innerHTML = 'Cùng tớ bắt đầu nhé <span aria-hidden="true">→</span>';
    if (step > 0) renderQuestion();
  } catch {
    $('connection-error').textContent = 'Chưa kết nối được với chiếc thư. Cậu thử lại một chút nhé.';
    $('retry').hidden = false;
  }
}
$('retry').addEventListener('click', init);
$('start').addEventListener('click', renderQuestion);
$('previous').addEventListener('click', () => {
  if (busy || step === 0) return;
  storage.set(`draft-${step}`, $('answer').value);
  step--;
  renderQuestion();
});
$('answer').addEventListener('input', () => {
  storage.set(`draft-${step}`, $('answer').value);
  $('counter').textContent = `${$('answer').value.length} / 2000`;
  $('answer-error').textContent = '';
  $('answer').removeAttribute('aria-invalid');
});
$('answer-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy) return;
  const answer = $('answer').value.trim();
  if (!answer) {
    $('answer-error').textContent = 'Cậu viết một chút rồi mình đi tiếp nhé.';
    $('answer').setAttribute('aria-invalid', 'true');
    return $('answer').focus();
  }
  busy = true;
  $('next').disabled = true;
  $('previous').disabled = true;
  $('answer').disabled = true;
  try {
    const result = await api('/api/answer', { step, answer });
    answers[step] = answer;
    storage.remove(`draft-${step}`);
    completedStep = result.step;
    step++;
    if (completedStep === questions.length) {
      answers = [];
      questions.forEach((_, index) => storage.remove(`draft-${index}`));
      step = completedStep;
    }
    renderQuestion();
  } catch (error) {
    if (error.status === 409) {
      try { const state = await api('/api/state'); step = state.step; completedStep = state.step; answers = state.draftAnswers || []; questions = state.questions; renderQuestion(); }
      catch { $('answer-error').textContent = 'Chưa kết nối được. Câu trả lời của cậu vẫn ở đây, thử lại nhé.'; }
    } else $('answer-error').textContent = error.status ? error.message : 'Chưa gửi được. Câu trả lời của cậu vẫn ở đây, thử lại nhé.';
  } finally { busy = false; $('next').disabled = false; $('previous').disabled = false; $('answer').disabled = false; }
});
$('open-letter').addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  $('open-letter').disabled = true;
  $('open-error').textContent = '';
  try {
    const letter = await api('/api/letter');
    $('letter-title').textContent = letter.greeting;
    $('letter-body').replaceChildren(...letter.paragraphs.map((text) => {
      const p = document.createElement('p');
      const emphasis = 'rất rất rất';
      const pieces = text.split(emphasis);
      pieces.forEach((piece, index) => {
        if (index > 0) { const strong = document.createElement('strong'); strong.textContent = emphasis; p.append(strong); }
        p.append(document.createTextNode(piece));
      });
      return p;
    }));
    $('letter-note').textContent = letter.note;
    $('opening-envelope').classList.add('opening');
    if (!paused && !reduced.matches) await new Promise((resolve) => setTimeout(resolve, 1000));
    show('letter-view', 'letter-title');
  } catch (error) {
    if (error.status === 403) { await init(); renderQuestion(); }
    else $('open-error').textContent = 'Chưa mở được thư. Cậu nhấn mở lại nhé.';
  } finally { busy = false; $('open-letter').disabled = false; }
});
$('back-top').addEventListener('click', () => { $('letter-title').focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: paused || reduced.matches ? 'instant' : 'smooth' }); });
init();
