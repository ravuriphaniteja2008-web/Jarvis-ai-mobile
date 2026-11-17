// ===== 1. API KEY (Safe: Browser Local Storage) =====
let API_KEY = localStorage.getItem('jarvis_key');
if(!API_KEY){
  API_KEY = prompt('Enter your Gemini API Key:');
  if(API_KEY) localStorage.setItem('jarvis_key', API_KEY);
}

// ===== 2. STABLE DIRECT MODEL =====
const CHAT_MODEL = "gemini-1.5-flash-latest";
const chat = document.getElementById('chat');
const input = document.getElementById('msg');
const micBtn = document.getElementById('mic-btn');

// ===== 3. GEMINI BRAIN =====
async function callGemini(p){
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + CHAT_MODEL + ":generateContent?key=" + API_KEY,
    {
      method: "POST", 
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({contents:[{parts:[{text:p}]}]})
    }
  );
  const data = await res.json();
  if(data.error){
    throw new Error(data.error.message);
  }
  if(data.candidates && data.candidates[0].content){
    return data.candidates[0].content.parts[0].text;
  }
  throw new Error("No response generated.");
}

async function askGemini(p){
  add('J.A.R.V.I.S: Thinking...', 'ai');
  try{
    const reply = await callGemini(p);
    chat.lastChild.innerText = 'J.A.R.V.I.S: ' + reply;
    speak(reply);
  }catch(e){
    chat.lastChild.innerText = 'J.A.R.V.I.S: ERROR - ' + e.message;
  }
}

// ===== 4. SPEECH RECOGNITION (STT) =====
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if(SR) {
  const rec = new SR(); 
  rec.lang = 'en-US'; 

  rec.onresult = (e) => {
    const t = e.results[0][0].transcript;
    add('YOU: ' + t, 'user');
    askGemini(t);
  };

  micBtn.onclick = () => {
    try {
      rec.start();
      micBtn.innerText = '🔴';
    } catch(err) {
      console.log(err);
    }
  };

  rec.onend = () => {
    micBtn.innerText = '🎙️';
  };
} else {
  micBtn.onclick = () => {
    alert("Speech recognition is not supported in this browser. Please use Chrome.");
  };
}

// ===== 5. TEXT-TO-SPEECH (TTS) =====
let voices = [];
function loadVoices(){ 
  if('speechSynthesis' in window) {
    voices = speechSynthesis.getVoices(); 
  }
}
loadVoices();
if('speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = loadVoices;
}

function speak(t){
  if(!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(t);
  u.rate = 1.05;
  u.pitch = 0.85;
  const v = voices.find(v => v.lang.startsWith('en'));
  if(v) u.voice = v;
  speechSynthesis.speak(u);
}

// ===== 6. TEXT SEND BUTTON =====
document.getElementById('send').onclick = () => {
  const t = input.value.trim();
  if(!t) return;
  add('YOU: ' + t, 'user');
  input.value = "";
  askGemini(t);
};

input.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('send').click();
  }
});

function add(t, w){
  const d = document.createElement('div');
  d.className = 'msg ' + w;
  d.innerText = t;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
}
