// frontend/script.js - CORE BRAIN & VISION SCRIPT

// ===== 1. API KEY & SMART MODELS =====
let API_KEY = localStorage.getItem('jarvis_key');
if (!API_KEY) {
  API_KEY = prompt('Enter your Gemini API Key:');
  if (API_KEY) {
    localStorage.setItem('jarvis_key', API_KEY.trim());
  }
}

const MODELS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-flash-latest"
];

// ===== 2. MEMORY SYSTEM & DOM ELEMENTS =====
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

// Load previous conversation history into UI
MEMORY.forEach(m => {
  const prefix = m.role === 'user' ? 'YOU: ' : 'J.A.R.V.I.S: ';
  const senderClass = m.role === 'user' ? 'user' : 'ai';
  add(prefix + m.text, senderClass);
});

// ===== 3. GEMINI BRAIN (MEMORY INTEGRATED) =====
async function callGemini(promptText) {
  const contents = MEMORY.slice(-12).map(m => ({
    role: m.role,
    parts: [{ text: m.text }]
  }));
  
  contents.push({
    role: 'user',
    parts: [{ text: promptText }]
  });

  let lastErr;
  for (const model of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents })
      });

      const data = await res.json();

      if (data.error) {
        lastErr = new Error(data.error.message);
        if (/high demand|temporar|quota|rate|unavailable|deprecated|not found|404/i.test(data.error.message)) {
          continue;
        }
        throw lastErr;
      }

      return data.candidates[0].content.parts[0].text;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function askGemini(promptText) {
  add('J.A.R.V.I.S: Thinking...', 'ai');
  try {
    const reply = await callGemini(promptText);
    MEMORY.push({ role: 'user', text: promptText });
    MEMORY.push({ role: 'model', text: reply });
    saveMemory();

    chat.lastChild.innerText = 'J.A.R.V.I.S: ' + reply;
    speak(reply);
  } catch (e) {
    chat.lastChild.innerText = 'J.A.R.V.I.S: ERROR - ' + e.message;
  }
}

// ===== 4. VISION ENGINE (EYES) =====
if (camBtn && imgInput) {
  camBtn.onclick = () => imgInput.click();

  imgInput.onchange = () => {
    const file = imgInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      const question = input.value.trim() || 'What do you see? Describe briefly.';
      
      add('YOU: [IMAGE] ' + question, 'user');
      input.value = '';
      imgInput.value = ''; // Reset file input so selecting the same image again works
      
      askVision(base64, file.type, question);
    };
    reader.readAsDataURL(file);
  };
}

async function askVision(base64, mimeType, question) {
  add('J.A.R.V.I.S: Analyzing image...', 'ai');
  let lastErr;

  for (const model of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: question },
              { inline_data: { mime_type: mimeType, data: base64 } }
            ]
          }]
        })
      });

      const data = await res.json();

      if (data.error) {
        lastErr = new Error(data.error.message);
        if (/high demand|temporar|quota|rate|unavailable|deprecated|not found|404/i.test(data.error.message)) {
          continue;
        }
        throw lastErr;
      }

      const reply = data.candidates[0].content.parts[0].text;
      MEMORY.push({ role: 'user', text: `[IMAGE] ${question}` });
      MEMORY.push({ role: 'model', text: reply });
      saveMemory();

      chat.lastChild.innerText = 'J.A.R.V.I.S: ' + reply;
      speak(reply);
      return;
    } catch (e) {
      lastErr = e;
    }
  }

  chat.lastChild.innerText = 'J.A.R.V.I.S: ERROR - ' + lastErr.message;
}

// ===== 5. VOICE & UTILS =====
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR && micBtn) {
  const rec = new SR();
  rec.lang = 'en-US';

  rec.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    add('YOU: ' + transcript, 'user');
    askGemini(transcript);
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

function speak(text) {
  speechSynthesis.cancel(); // Stop any currently playing speech first
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  utterance.pitch = 0.85;
  
  const enVoice = voices.find(v => v.lang.startsWith('en'));
  if (enVoice) utterance.voice = enVoice;
  
  speechSynthesis.speak(utterance);
}

// Send message handler
function handleSend() {
  const text = input.value.trim();
  if (!text) return;
  add('YOU: ' + text, 'user');
  input.value = '';
  askGemini(text);
}

if (sendBtn) {
  sendBtn.onclick = handleSend;
}

if (input) {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSend();
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

function add(text, senderClass) {
  if (!chat) return;
  const div = document.createElement('div');
  div.className = 'msg ' + senderClass;
  div.innerText = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
