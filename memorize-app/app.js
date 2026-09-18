/* Memorize — lightweight, no-build memorization coach.
   Persists to localStorage. No backend, no dependencies. */

const LS_TEXTS = 'memorize_texts_v1';
const LS_SETTINGS = 'memorize_settings_v1';

const STYLES = {
  visual:      { label: 'Visual',        icon: '👁️', cls: 'style-visual' },
  auditory:    { label: 'Auditory',      icon: '🔊', cls: 'style-auditory' },
  readwrite:   { label: 'Read & Write',  icon: '✍️', cls: 'style-readwrite' },
  kinesthetic: { label: 'Kinesthetic',   icon: '🕺', cls: 'style-kinesthetic' },
};

const EMBODIMENT_TIPS = [
  'Take a step forward as you say this line.',
  'Use a hand gesture to emphasize the key word.',
  'Stand up and say it out loud with energy.',
  'Walk in place while you recite this chunk.',
  'Point to something that matches the meaning.',
  'Clap once on the most important word.',
  'Move to a different spot in the room as you say it.',
  'Act out the feeling of the line with your posture.',
];

const QUIZ = [
  {
    q: 'When learning something new, you prefer to...',
    opts: [
      { t: 'See diagrams, pictures, or written examples', s: 'visual' },
      { t: 'Listen to someone explain or talk it through', s: 'auditory' },
      { t: 'Read about it and take detailed notes', s: 'readwrite' },
      { t: 'Jump in and try it hands-on right away', s: 'kinesthetic' },
    ],
  },
  {
    q: 'To remember a phone number, you would most likely...',
    opts: [
      { t: 'Picture the digits in your mind', s: 'visual' },
      { t: 'Say it out loud a few times', s: 'auditory' },
      { t: 'Write it down repeatedly', s: 'readwrite' },
      { t: 'Tap it out like dialing while saying it', s: 'kinesthetic' },
    ],
  },
  {
    q: 'In a presentation, you get the most out of...',
    opts: [
      { t: 'Slides with charts and color-coded text', s: 'visual' },
      { t: 'The speaker’s tone, stories, and Q&A', s: 'auditory' },
      { t: 'A handout you can annotate', s: 'readwrite' },
      { t: 'An interactive, hands-on workshop', s: 'kinesthetic' },
    ],
  },
  {
    q: 'To memorize a long passage, what sounds most appealing?',
    opts: [
      { t: 'Flashcards with key words highlighted', s: 'visual' },
      { t: 'Listening to it and repeating it aloud', s: 'auditory' },
      { t: 'Progressively filling in blanks as you recall it', s: 'readwrite' },
      { t: 'Moving or gesturing while reciting it', s: 'kinesthetic' },
    ],
  },
];

// ---------- storage ----------

function loadTexts() {
  try { return JSON.parse(localStorage.getItem(LS_TEXTS)) || []; }
  catch { return []; }
}
function saveTexts(texts) { localStorage.setItem(LS_TEXTS, JSON.stringify(texts)); }

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(LS_SETTINGS)) || {}; }
  catch { return {}; }
}
function saveSettings(s) { localStorage.setItem(LS_SETTINGS, JSON.stringify(s)); }

// ---------- utils ----------

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

function normalizeWord(w) { return w.toLowerCase().replace(/[^\w']/g, ''); }

// ---------- chunking ----------

function splitIntoSentences(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const parts = clean.match(/[^.!?]+[.!?]*(\s|$)/g) || [clean];
  return parts.map(s => s.trim()).filter(Boolean);
}

function chunkLongSentence(s, maxWords = 22) {
  const words = s.split(' ');
  if (words.length <= maxWords) return [s];
  const mid = Math.floor(words.length / 2);
  let splitIdx = -1;
  for (let off = 0; off < words.length / 2; off++) {
    if (words[mid + off] && /,$/.test(words[mid + off])) { splitIdx = mid + off; break; }
    if (words[mid - off] && /,$/.test(words[mid - off])) { splitIdx = mid - off; break; }
  }
  if (splitIdx === -1) splitIdx = mid - 1;
  const first = words.slice(0, splitIdx + 1).join(' ');
  const rest = words.slice(splitIdx + 1).join(' ');
  if (!rest) return [first];
  return [...chunkLongSentence(first, maxWords), ...chunkLongSentence(rest, maxWords)];
}

function chunkByLines(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean);
}

function newChunk(text) {
  return { id: uid(), text, interval: 0, ease: 2.5, dueAt: new Date().toISOString(), reviews: 0, lastRating: null };
}

function buildChunks(text, chunkBy) {
  const raw = chunkBy === 'line'
    ? chunkByLines(text)
    : splitIntoSentences(text).flatMap(s => chunkLongSentence(s));
  return raw.map(newChunk);
}

// ---------- spaced repetition (simplified SM-2) ----------

function scheduleChunk(chunk, rating) {
  if (rating === 'again') {
    chunk.ease = Math.max(1.3, chunk.ease - 0.2);
    chunk.interval = 0;
  } else if (rating === 'hard') {
    chunk.ease = Math.max(1.3, chunk.ease - 0.15);
    chunk.interval = Math.max(1, Math.round((chunk.interval || 1) * 1.2));
  } else if (rating === 'good') {
    chunk.interval = chunk.interval === 0 ? 1 : Math.round(chunk.interval * chunk.ease);
  } else if (rating === 'easy') {
    chunk.ease = chunk.ease + 0.15;
    chunk.interval = chunk.interval === 0 ? 2 : Math.round(chunk.interval * chunk.ease * 1.3);
  }
  chunk.reviews++;
  chunk.lastRating = rating;
  const due = new Date();
  due.setDate(due.getDate() + chunk.interval);
  if (rating === 'again') due.setMinutes(due.getMinutes() + 1);
  chunk.dueAt = due.toISOString();
}

function masteryLevel(chunk) {
  if (chunk.reviews === 0) return 0;
  if (chunk.interval >= 21) return 5;
  if (chunk.interval >= 10) return 4;
  if (chunk.interval >= 4) return 3;
  if (chunk.interval >= 1) return 2;
  return 1;
}

function textProgress(text) {
  if (!text.chunks.length) return 0;
  const mastered = text.chunks.filter(c => masteryLevel(c) >= 3).length;
  return Math.round((mastered / text.chunks.length) * 100);
}

function dueChunks(text) {
  const now = Date.now();
  return text.chunks.filter(c => new Date(c.dueAt).getTime() <= now);
}

function effectiveStyle(text) {
  return text.styleOverride || loadSettings().learningStyle || 'readwrite';
}

// ---------- global state ----------

let state = { route: 'home', textId: null, session: null, quizAnswers: {}, toast: null };

function nav(route, extra = {}) {
  state = { ...state, route, ...extra, toast: null };
  render();
}

// ---------- rendering ----------

function render() {
  if (state.route === 'study' && (!state.session || state.session.idx >= state.session.queue.length)) {
    state.route = state.session ? 'summary' : 'home';
  }
  const app = document.getElementById('app');
  if (state.route === 'home') app.innerHTML = renderHome();
  else if (state.route === 'newText') app.innerHTML = renderNewText();
  else if (state.route === 'textDetail') app.innerHTML = renderTextDetail(state.textId);
  else if (state.route === 'quiz') app.innerHTML = renderQuiz();
  else if (state.route === 'study') app.innerHTML = renderStudy();
  else if (state.route === 'summary') app.innerHTML = renderSummary();
  window.scrollTo(0, 0);
}

function renderToast() {
  if (!state.toast) return '';
  return `<div class="card" style="border-color:#cfe3d8;background:#f3faf6;">${escapeHtml(state.toast)}</div>`;
}

function renderHome() {
  const texts = loadTexts().sort((a, b) => b.createdAt - a.createdAt);
  const settings = loadSettings();
  const streak = settings.streak || { count: 0 };

  const streakBanner = streak.count > 0
    ? `<div class="streak-banner">
         <div><strong>Keep it going!</strong><div style="color:var(--muted);font-size:13px;">Daily practice streak</div></div>
         <div class="num">🔥 ${streak.count}</div>
       </div>`
    : '';

  const styleLine = settings.learningStyle
    ? `<span class="style-chip ${STYLES[settings.learningStyle].cls}">${STYLES[settings.learningStyle].icon} ${STYLES[settings.learningStyle].label}</span>
       <button class="btn ghost" onclick="nav('quiz')">Retake style quiz</button>`
    : `<button class="btn secondary" onclick="nav('quiz')">🧭 Discover your learning style</button>`;

  const list = texts.length
    ? texts.map(t => {
        const due = dueChunks(t).length;
        const pct = textProgress(t);
        const style = STYLES[effectiveStyle(t)];
        return `<div class="text-list-item" onclick="nav('textDetail', {textId:'${t.id}'})">
          <div>
            <div class="title">${escapeHtml(t.title)}</div>
            <div class="meta">
              <span class="style-chip ${style.cls}">${style.icon} ${style.label}</span>
              <span>${escapeHtml(t.category)}</span>
              ${due ? `<span>· ${due} due</span>` : ''}
            </div>
            <div class="progress-bar" style="width:180px;"><div style="width:${pct}%"></div></div>
          </div>
          <div style="color:var(--muted);">${pct}%</div>
        </div>`;
      }).join('')
    : `<div class="empty-state"><div class="big">📖</div><p>Paste a speech, script, or scripture and start memorizing it your way.</p></div>`;

  return `
    <div class="header">
      <div class="brand"><span class="logo">🧠</span><h1>Memorize</h1></div>
      <button class="btn" onclick="nav('newText')">+ New</button>
    </div>
    ${renderToast()}
    ${streakBanner}
    <div class="card" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
      ${styleLine}
    </div>
    <div class="card">${list}</div>
    <div class="footer-note">Everything is stored only on this device.</div>
  `;
}

function renderNewText() {
  return `
    <div class="top-nav"><span class="back" onclick="nav('home')">←</span><h2>New text</h2></div>
    <div class="card">
      <div class="field">
        <label>Title</label>
        <input type="text" id="f-title" placeholder="e.g. Wedding toast, Psalm 23, Keynote intro" />
      </div>
      <div class="field">
        <label>Category</label>
        <select id="f-category">
          <option>Speech / Presentation</option>
          <option>Bible Scripture</option>
          <option>Script / Lines</option>
          <option>Poem</option>
          <option>Other</option>
        </select>
      </div>
      <div class="field">
        <label>Text to memorize</label>
        <textarea id="f-text" placeholder="Paste your text here..."></textarea>
        <div class="hint">Long text is automatically broken into bite-sized chunks.</div>
      </div>
      <div class="field">
        <label>Break it into chunks by</label>
        <div class="pill-row">
          <div class="pill active" id="chunk-sentence" onclick="setChunkMode('sentence')">Sentences (default)</div>
          <div class="pill" id="chunk-line" onclick="setChunkMode('line')">Lines / verses (one per line)</div>
        </div>
      </div>
      <button class="btn block" onclick="createText()">Create & preview chunks</button>
    </div>
  `;
}

function setChunkMode(mode) {
  window.__chunkMode = mode;
  document.getElementById('chunk-sentence').classList.toggle('active', mode === 'sentence');
  document.getElementById('chunk-line').classList.toggle('active', mode === 'line');
}

function createText() {
  const title = document.getElementById('f-title').value.trim();
  const category = document.getElementById('f-category').value;
  const text = document.getElementById('f-text').value.trim();
  const chunkBy = window.__chunkMode === 'line' ? 'line' : 'sentence';
  if (!text) { alert('Paste some text first.'); return; }

  const chunks = buildChunks(text, chunkBy);
  const newText = {
    id: uid(),
    title: title || 'Untitled',
    category,
    chunkBy,
    styleOverride: null,
    chunks,
    createdAt: Date.now(),
  };
  const texts = loadTexts();
  texts.push(newText);
  saveTexts(texts);
  window.__chunkMode = null;
  nav('textDetail', { textId: newText.id });
}

function renderTextDetail(textId) {
  const texts = loadTexts();
  const text = texts.find(t => t.id === textId);
  if (!text) return `<p>Not found. <a href="#" onclick="nav('home')">Go home</a></p>`;

  const pct = textProgress(text);
  const due = dueChunks(text).length;
  const style = effectiveStyle(text);
  const settings = loadSettings();

  const overrideRow = ['visual', 'auditory', 'readwrite', 'kinesthetic'].map(k => {
    const active = (text.styleOverride || settings.learningStyle || 'readwrite') === k;
    return `<div class="pill ${active ? 'active' : ''}" onclick="setStyleOverride('${text.id}','${k}')">${STYLES[k].icon} ${STYLES[k].label}</div>`;
  }).join('');

  const chunkRows = text.chunks.map((c, i) => {
    const lvl = masteryLevel(c);
    const stars = '★'.repeat(lvl) + '☆'.repeat(5 - lvl);
    const preview = c.text.length > 70 ? c.text.slice(0, 70) + '…' : c.text;
    return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);font-size:14px;">
      <span style="color:var(--muted);">${i + 1}. ${escapeHtml(preview)}</span>
      <span style="color:var(--accent);letter-spacing:1px;">${stars}</span>
    </div>`;
  }).join('');

  return `
    <div class="top-nav"><span class="back" onclick="nav('home')">←</span><h2>${escapeHtml(text.title)}</h2></div>
    <div class="card">
      <div class="meta" style="margin-bottom:10px;">${escapeHtml(text.category)} · ${text.chunks.length} chunks</div>
      <div class="progress-bar"><div style="width:${pct}%"></div></div>
      <div style="color:var(--muted);font-size:13px;margin-bottom:14px;">${pct}% mastered ${due ? `· ${due} due for review` : '· nothing due right now'}</div>

      <label style="display:block;font-weight:600;font-size:13px;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.03em;">Study mode</label>
      <div class="pill-row" style="margin-bottom:18px;">${overrideRow}</div>

      <button class="btn block ${text.chunks.length === 0 ? 'disabled' : ''}" ${text.chunks.length === 0 ? 'disabled' : ''} onclick="startStudy('${text.id}')">
        ▶ Study now${due ? ` (${due} due)` : ' (practice all)'}
      </button>
    </div>
    <div class="card">
      <h3>Chunks</h3>
      ${chunkRows}
    </div>
    <button class="btn ghost" onclick="deleteText('${text.id}')">🗑 Delete this text</button>
  `;
}

function setStyleOverride(textId, style) {
  const texts = loadTexts();
  const text = texts.find(t => t.id === textId);
  text.styleOverride = style;
  saveTexts(texts);
  render();
}

function deleteText(textId) {
  if (!confirm('Delete this text and all its progress? This cannot be undone.')) return;
  saveTexts(loadTexts().filter(t => t.id !== textId));
  nav('home');
}

// ---------- quiz ----------

function renderQuiz() {
  const questions = QUIZ.map((q, qi) => {
    const opts = q.opts.map((o, oi) => {
      const selected = state.quizAnswers[qi] === o.s;
      return `<div class="quiz-opt ${selected ? 'selected' : ''}" onclick="answerQuiz(${qi}, '${o.s}')">${escapeHtml(o.t)}</div>`;
    }).join('');
    return `<div class="quiz-q"><div class="qtext">${qi + 1}. ${escapeHtml(q.q)}</div>${opts}</div>`;
  }).join('');

  const allAnswered = Object.keys(state.quizAnswers).length === QUIZ.length;

  return `
    <div class="top-nav"><span class="back" onclick="nav('home')">←</span><h2>What's your learning style?</h2></div>
    <div class="card">
      <p style="color:var(--muted);">Answer honestly — we'll tailor how each text is broken down for you.</p>
      ${questions}
      <button class="btn block" ${allAnswered ? '' : 'disabled'} onclick="finishQuiz()">See my result</button>
    </div>
  `;
}

function answerQuiz(qIndex, styleKey) {
  state.quizAnswers[qIndex] = styleKey;
  render();
}

function finishQuiz() {
  const counts = { visual: 0, auditory: 0, readwrite: 0, kinesthetic: 0 };
  Object.values(state.quizAnswers).forEach(s => counts[s]++);
  const winner = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const settings = loadSettings();
  settings.learningStyle = winner;
  saveSettings(settings);
  state.quizAnswers = {};
  nav('home', { toast: `You learn best through ${STYLES[winner].label} techniques. Every new text will use this by default.` });
}

// ---------- study session ----------

function startStudy(textId) {
  const texts = loadTexts();
  const text = texts.find(t => t.id === textId);
  let due = dueChunks(text).map(c => c.id);
  if (due.length === 0) due = text.chunks.map(c => c.id); // nothing due: practice everything
  state.session = {
    textId,
    mode: effectiveStyle(text),
    queue: due,
    idx: 0,
    requeued: new Set(),
    results: { again: 0, hard: 0, good: 0, easy: 0 },
  };
  nav('study');
}

function currentSessionChunk() {
  const texts = loadTexts();
  const text = texts.find(t => t.id === state.session.textId);
  const chunkId = state.session.queue[state.session.idx];
  const chunk = text.chunks.find(c => c.id === chunkId);
  return { text, chunk };
}

function renderStudy() {
  const s = state.session;
  const { text, chunk } = currentSessionChunk();
  const mode = s.mode;
  const style = STYLES[mode];

  const modeTabs = ['visual', 'auditory', 'readwrite', 'kinesthetic'].map(k =>
    `<div class="mode-tab ${STYLES[k].cls} ${k === mode ? 'active' : ''}" onclick="switchStudyMode('${k}')">${STYLES[k].icon} ${STYLES[k].label}</div>`
  ).join('');

  let body = '';
  if (mode === 'visual') body = renderVisualMode(chunk, style);
  else if (mode === 'auditory') body = renderAuditoryMode(chunk, style);
  else if (mode === 'kinesthetic') body = renderKinestheticMode(chunk, style);
  else body = renderReadWriteMode(chunk, style);

  return `
    <div class="top-nav"><span class="back" onclick="exitStudy()">×</span><h2>${escapeHtml(text.title)}</h2></div>
    <div style="color:var(--muted);font-size:13px;margin-bottom:10px;">Chunk ${s.idx + 1} of ${s.queue.length}</div>
    <div class="progress-bar"><div style="width:${Math.round((s.idx / s.queue.length) * 100)}%"></div></div>
    <div class="mode-tabs" style="margin-top:16px;">${modeTabs}</div>
    <div class="${style.cls}">${body}</div>
  `;
}

function switchStudyMode(mode) {
  state.session.mode = mode;
  render();
}

function exitStudy() {
  const textId = state.session ? state.session.textId : state.textId;
  state.session = null;
  nav('textDetail', { textId });
}

function rateRowHtml() {
  return `
    <div class="rate-row" id="rateRow" style="display:none;">
      <button class="rate-btn rate-again" onclick="rateChunk('again')">Again</button>
      <button class="rate-btn rate-hard" onclick="rateChunk('hard')">Hard</button>
      <button class="rate-btn rate-good" onclick="rateChunk('good')">Good</button>
      <button class="rate-btn rate-easy" onclick="rateChunk('easy')">Easy</button>
    </div>`;
}

function showRateRow() {
  const el = document.getElementById('rateRow');
  if (el) el.style.display = 'flex';
}

// --- Visual mode: cue letters -> tap to reveal, highlight keywords ---

function cueString(text) {
  return text.split(' ').map(w => {
    const m = w.match(/^(\W*)(\w)(\w*)(\W*)$/);
    if (!m) return escapeHtml(w);
    return `${escapeHtml(m[1])}<span class="cue-letter">${escapeHtml(m[2])}</span>${'_'.repeat(m[3].length)}${escapeHtml(m[4])}`;
  }).join(' ');
}

function highlightKeywords(text) {
  return text.split(' ').map((w, i) => {
    const bare = w.replace(/[^\w']/g, '');
    const isKeyword = bare.length >= 6 || (i > 0 && /^[A-Z]/.test(bare));
    return isKeyword ? `<strong>${escapeHtml(w)}</strong>` : escapeHtml(w);
  }).join(' ');
}

function renderVisualMode(chunk) {
  return `
    <div class="chunk-display" id="visualCard" onclick="revealVisual()">${cueString(chunk.text)}</div>
    <div class="hint" style="text-align:center;color:var(--muted);margin-bottom:14px;">Tap the card to reveal, then rate your recall.</div>
    ${rateRowHtml()}
  `;
}
function revealVisual() {
  const el = document.getElementById('visualCard');
  const { chunk } = currentSessionChunk();
  el.innerHTML = highlightKeywords(chunk.text);
  el.onclick = null;
  showRateRow();
}

// --- Auditory mode: TTS listen, then reveal ---

function renderAuditoryMode(chunk) {
  const supported = 'speechSynthesis' in window;
  return `
    <div class="chunk-display" id="audioCard" onclick="revealAudio()">${cueString(chunk.text)}</div>
    <div class="speed-row">
      <span style="font-size:13px;color:var(--muted);">Slow</span>
      <input type="range" id="rateSlider" min="0.6" max="1.3" step="0.1" value="0.9" />
      <span style="font-size:13px;color:var(--muted);">Fast</span>
    </div>
    <div class="controls-row">
      <button class="btn secondary" ${supported ? '' : 'disabled'} onclick="playChunkAudio()">🔊 Listen</button>
      <button class="btn secondary" onclick="revealAudio()">Reveal text</button>
    </div>
    ${supported ? '' : '<div class="hint" style="text-align:center;">Text-to-speech isn’t supported in this browser — just read it aloud yourself.</div>'}
    ${rateRowHtml()}
  `;
}
function playChunkAudio() {
  const { chunk } = currentSessionChunk();
  if (!('speechSynthesis' in window)) return;
  const rate = parseFloat(document.getElementById('rateSlider').value || '0.9');
  const utter = new SpeechSynthesisUtterance(chunk.text);
  utter.rate = rate;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}
function revealAudio() {
  const el = document.getElementById('audioCard');
  const { chunk } = currentSessionChunk();
  el.innerHTML = highlightKeywords(chunk.text);
  el.onclick = null;
  showRateRow();
}

// --- Read & Write mode: progressive cloze deletion ---

function renderReadWriteMode(chunk) {
  const words = chunk.text.split(' ');
  const fractions = [0.2, 0.4, 0.6, 0.8, 1.0];
  const hideFraction = fractions[Math.min(chunk.reviews, fractions.length - 1)];
  const seed = hashStr(chunk.id + chunk.reviews);
  const hideCount = Math.max(1, Math.round(words.length * hideFraction));

  // deterministic pseudo-random selection of indices to hide
  const indices = words.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = (hashStr(seed + '-' + i)) % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const hideSet = new Set(indices.slice(0, hideCount));

  const html = words.map((w, i) => {
    if (!hideSet.has(i)) return escapeHtml(w);
    const bare = normalizeWord(w);
    const size = Math.max(3, w.length + 1);
    return `<input class="blank-input" data-answer="${escapeHtml(bare)}" size="${size}" autocomplete="off" autocapitalize="off" spellcheck="false" />`;
  }).join(' ');

  return `
    <div class="chunk-display" style="cursor:default;">${html}</div>
    <div class="hint" style="text-align:center;color:var(--muted);margin-bottom:14px;">${Math.round(hideFraction * 100)}% hidden — fill in the blanks from memory.</div>
    <div class="controls-row"><button class="btn" onclick="checkClozeAnswers()">Check</button></div>
    ${rateRowHtml()}
  `;
}

function checkClozeAnswers() {
  const inputs = document.querySelectorAll('.blank-input');
  let allCorrect = true;
  inputs.forEach(input => {
    const ok = normalizeWord(input.value) === input.dataset.answer;
    input.classList.remove('correct', 'wrong');
    input.classList.add(ok ? 'correct' : 'wrong');
    input.disabled = true;
    if (!ok) allCorrect = false;
  });
  showRateRow();
  if (!allCorrect) {
    const again = document.querySelector('.rate-again');
    if (again) again.style.outline = '2px solid #000';
  }
}

// --- Kinesthetic mode: tap-to-reveal word by word + movement prompt ---

function renderKinestheticMode(chunk) {
  const words = chunk.text.split(' ');
  const spans = words.map((w, i) => {
    const bare = w.replace(/[^\w']/g, '');
    const placeholder = '_'.repeat(Math.max(2, bare.length));
    return `<span class="word-tap hidden-word" id="kw-${i}" data-word="${escapeHtml(w)}" onclick="revealKineWord(${i}, ${words.length})">${placeholder}</span>`;
  }).join(' ');

  const tip = EMBODIMENT_TIPS[hashStr(chunk.id) % EMBODIMENT_TIPS.length];

  return `
    <div class="embodiment-tip">🕺 ${escapeHtml(tip)}</div>
    <div class="chunk-display" style="cursor:default;">${spans}</div>
    <div class="hint" style="text-align:center;color:var(--muted);margin-bottom:14px;">Tap each word to reveal it as you recall and say it aloud.</div>
    <div class="controls-row"><button class="btn secondary" onclick="revealAllKine(${words.length})">Reveal all</button></div>
    ${rateRowHtml()}
  `;
}
function revealKineWord(i, total) {
  const el = document.getElementById('kw-' + i);
  el.textContent = el.dataset.word;
  el.classList.remove('hidden-word');
  el.classList.add('revealed');
  const revealedCount = document.querySelectorAll('.word-tap.revealed').length;
  if (revealedCount >= total) showRateRow();
}
function revealAllKine(total) {
  for (let i = 0; i < total; i++) revealKineWord(i, total);
}

// --- rating & advancing ---

function rateChunk(rating) {
  const s = state.session;
  const { text, chunk } = currentSessionChunk();
  scheduleChunk(chunk, rating);
  s.results[rating]++;

  const texts = loadTexts();
  const tIdx = texts.findIndex(t => t.id === text.id);
  texts[tIdx] = text;
  saveTexts(texts);

  if (rating === 'again' && !s.requeued.has(chunk.id)) {
    s.requeued.add(chunk.id);
    s.queue.push(chunk.id);
  }

  recordStudyToday();
  s.idx++;
  render();
}

function recordStudyToday() {
  const settings = loadSettings();
  const today = todayStr();
  const streak = settings.streak || { count: 0, lastDate: null };
  if (streak.lastDate === today) {
    // already counted today
  } else {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    streak.count = streak.lastDate === yesterday ? streak.count + 1 : 1;
    streak.lastDate = today;
  }
  settings.streak = streak;
  saveSettings(settings);
}

function renderSummary() {
  const s = state.session;
  const texts = loadTexts();
  const text = texts.find(t => t.id === s.textId);
  const pct = textProgress(text);
  const total = Object.values(s.results).reduce((a, b) => a + b, 0);
  const positive = s.results.good + s.results.easy;
  const message = total === 0
    ? 'No chunks were due — you\'re all caught up!'
    : positive / total >= 0.7
      ? '🔥 Great recall! You\'re locking this in.'
      : 'Nice work — the tricky chunks get easier every pass.';
  const settings = loadSettings();
  const streak = settings.streak || { count: 0 };

  return `
    <div class="card session-summary">
      <div class="big-num">${total}</div>
      <p>chunks reviewed</p>
      <p>${message}</p>
      <div class="progress-bar"><div style="width:${pct}%"></div></div>
      <p style="color:var(--muted);font-size:14px;">${pct}% of "${escapeHtml(text.title)}" mastered</p>
      ${streak.count > 0 ? `<p>🔥 ${streak.count}-day streak</p>` : ''}
      <div class="controls-row" style="margin-top:16px;">
        <button class="btn" onclick="startStudy('${text.id}')">Study again</button>
        <button class="btn secondary" onclick="nav('textDetail', {textId:'${text.id}'})">Back to text</button>
        <button class="btn ghost" onclick="nav('home')">Home</button>
      </div>
    </div>
  `;
}

// expose functions used by inline handlers
Object.assign(window, {
  nav, setChunkMode, createText, setStyleOverride, deleteText,
  answerQuiz, finishQuiz, startStudy, switchStudyMode, exitStudy,
  revealVisual, playChunkAudio, revealAudio, checkClozeAnswers,
  revealKineWord, revealAllKine, rateChunk,
});

render();
