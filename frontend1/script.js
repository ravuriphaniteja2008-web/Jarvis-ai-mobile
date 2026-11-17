// frontend/script.js - CORE BRAIN & VISION SCRIPT

// ===== 1. API KEY & WORKING MODELS =====
let API_KEY = localStorage.getItem('jarvis_key');
if (!API_KEY) {
  API_KEY = prompt('Enter your Gemini API Key:');
  if (API_KEY) {
    localStorage.setItem('jarvis_key', API_KEY.trim());
  }
}

const MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-flash-latest"
];

const SYSTEM_PROMPT = "You are J.A.R.V.I.S., Tony Stark's witty AI assistant. Address the user as Sir. Keep answers concise.\n\n";

// ===== 2. MEMORY SYSTEM =====
let MEMORY = JSON.parse(localStorage.getItem('jarvis_memory') || '[]');

function saveMemory() {
  localStorage.setItem('jarvis_memory', JSON.stringify(MEMORY));
}

const chat = document.getElementById('chat');
const input = document.getElementById('msg');
const sendBtn = document.getElementById('send');
const micBtn = document.getElementById('mic-btn');
const clearBtn = document.getElementById('clear-btn');
const camBtn = document.getElementById('cam-btn');
const imgInput = document.getElementById('img-input');

MEMORY.forEach(m => add((m.role === 'user' ? 'YOU: ' : 'J.A.R.V.I.S: ') + m.text, m.role === 'user' ? 'user' : 'ai'));

// ===== 3. GEMINI BRAIN =====
async function callGemini(p) {
  const contents = MEMORY.slice(-12).map(m => ({
    role: m.role,
    parts: [{ text: m.text }]
  }));
  contents.push({ role: 'user', parts: [{ text: SYSTEM_PROMPT + "User: " + p }] });

  let lastErr;
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY.trim()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: contents })
        }
      );

      const data = await res.json();
      
      if (data.error) {
        lastErr = new Error(data.error.message);
        if (/high demand|temporar|quota|rate|unavailable|deprecated|not found|404/i.test(data.error.message)) {
          continue;
        }
        throw lastErr;
      }

      const firstCandidate = data.candidates ? data.candidates.at(0) : null;
      const firstPart = firstCandidate && firstCandidate.content && firstCandidate.content.parts ? firstCandidate.content.parts.at(0) : null;

      if (firstPart && firstPart.text) {
        return firstPart.text;
      } else {
        lastErr = new Error("Empty response from model");
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function askGemini(p) {
  add('J.A.R.V.I.S: Thinking...', 'ai');
  try {
    const reply = await callGemini(p);
    MEMORY.push({ role: 'user', text: p });
    MEMORY.push({ role: 'model', text: reply });
    saveMemory();
    chat.lastChild.innerText = 'J.A.R.V.I.S: ' + reply;
    speak(reply);
  } catch (e) {
    chat.lastChild.innerText = 'J.A.R.V.I.S: ERROR - ' + e.message;
  }
}

// ===== 4. VISION ENGINE =====
if (camBtn && imgInput) {
  camBtn.onclick = () => imgInput.click();
  imgInput.onchange = () => {
    const file = imgInput.files ? imgInput.files.at(0) : null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',').at(1);
      const q = input.value.trim() || 'What do you see? Describe briefly.';
      add('YOU: ' + q, 'user');
      input.value = '';
      imgInput.value = ''; // Reset file input so selecting the same image triggers onchange again
      askVision(base64, file.type, q);
    };
    reader.readAsDataURL(file);
  };
}

async function askVision(base64, mime, q) {
  add('J.A.R.V.I.S: Analyzing image...', 'ai');
  let lastErr;
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY.trim()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: SYSTEM_PROMPT + q },
                { inline_data: { mime_type: mime, data: base64 } }
              ]
            }]
          })
        }
      );

      const data = await res.json();

      if (data.error) {
        lastErr = new Error(data.error.message);
        if (/high demand|temporar|quota|rate|unavailable|deprecated|not found|404/i.test(data.error.message)) {
          continue;
        }
        throw lastErr;
      }

      const firstCandidate = data.candidates ? data.candidates.at(0) : null;
      const firstPart = firstCandidate && firstCandidate.content && firstCandidate.content.parts ? firstCandidate.content.parts.at(0) : null;

      if (firstPart && firstPart.text) {
        const reply = firstPart.text;
        MEMORY.push({ role: 'user', text: `[IMAGE] ${q}` });
        MEMORY.push({ role: 'model', text: reply });
        saveMemory();
        chat.lastChild.innerText = 'J.A.R.V.I.S: ' + reply;
        speak(reply);
        return;
      } else {
        lastErr = new Error("Empty response from vision model");
      }
    } catch (e) {
      lastErr = e;
    }
  }
  chat.lastChild.innerText = 'J.A.R.V.I.S: ERROR - ' + (lastErr ? lastErr.message : "Unknown error");
}

// ===== 5. VOICE & UTILS =====
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR && micBtn) {
  const rec = new SR();
  rec.lang = 'en-US';
  rec.onresult = (e) => {
    const firstResult = e.results.item(0);
    const t = firstResult.item(0).transcript;
    add('YOU: ' + t, 'user');
    askGemini(t);
  };
  micBtn.onclick = () => {
    rec.start();
    micBtn.innerText = 'LISTENING...';
  };
  rec.onend = () => {
    micBtn.innerText = '🎙️';
  };
}

let voices = [];
function loadVoices() {
  voices = speechSynthesis.getVoices();
}
loadVoices();
speechSynthesis.onvoiceschanged = loadVoices;

function speak(t) {
  speechSynthesis.cancel(); // Stop any currently playing audio before starting new speech
  const u = new SpeechSynthesisUtterance(t);
  u.rate = 1.05;
  u.pitch = 0.85;
  const v = voices.find(v => v.lang.startsWith('en'));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

function handleSend() {
  const t = input.value.trim();
  if (!t) return;
  add('YOU: ' + t, 'user');
  input.value = '';
  askGemini(t);
}

if (sendBtn) {
  sendBtn.onclick = handleSend;
}

if (input) {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  });
}

if (clearBtn) {
  clearBtn.onclick = () => {
    MEMORY = [];
    saveMemory();
    speechSynthesis.cancel();
    chat.innerHTML = '';
    add('SYSTEM: Memory cleared.', 'ai');
  };
}

function add(t, w) {
  if (!chat) return;
  const d = document.createElement('div');
  d.className = 'msg ' + w;
  d.innerText = t;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
      }
