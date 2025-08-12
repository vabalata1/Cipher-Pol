// Système de chiffrement glagolitique
let cipherMap = {
  'A': 'Ⱏ', 'B': 'Ⰸ', 'C': 'Ⱃ', 'D': 'Ⰻ', 'E': 'Ⱁ', 'F': 'Ⰽ', 'G': 'Ⱌ',
  'H': 'Ⰵ', 'I': 'Ⱒ', 'J': 'Ⱅ', 'K': 'Ⰱ', 'L': 'Ⰾ', 'M': 'Ⱇ', 'N': 'Ⱋ',
  'O': 'Ⰴ', 'P': 'Ⱈ', 'Q': 'Ⰿ', 'R': 'Ⱀ', 'S': 'Ⱄ', 'T': 'Ⰳ', 'U': 'Ⱆ',
  'V': 'Ⰲ', 'W': 'Ⱂ', 'X': 'Ⰰ', 'Y': 'Ⰹ', 'Z': 'Ⱌ'
};

let decodeMap = {};
function rebuildDecodeMap() {
  decodeMap = {};
  for (const [key, value] of Object.entries(cipherMap)) {
    decodeMap[value] = key;
  }
}
rebuildDecodeMap();

// Afficher le tableau de correspondance
function displayCipherTable() {
  const table = document.getElementById('cipherTable');
  if (!table) return;
  table.innerHTML = '';
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const letter of alphabet) {
    const pair = document.createElement('div');
    pair.className = 'cipher-pair';
    pair.innerHTML = `${letter} = <span class="glagolitic-char">${cipherMap[letter]}</span>`;
    table.appendChild(pair);
  }
}

// Mélanger aléatoirement la correspondance
function shuffleMapping() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const symbols = letters.map(l => cipherMap[l]);
  for (let i = symbols.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [symbols[i], symbols[j]] = [symbols[j], symbols[i]];
  }
  const newMap = {};
  letters.forEach((l, idx) => { newMap[l] = symbols[idx]; });
  cipherMap = newMap;
  rebuildDecodeMap();
  displayCipherTable();
}

// Fonction d'encodage
function encode() {
  const plainEl = document.getElementById('plainText');
  const cipherEl = document.getElementById('cipherText');
  if (!plainEl || !cipherEl) return;
  const input = (plainEl.value || '').toUpperCase();
  let result = '';
  for (const char of input) {
    result += cipherMap[char] ? cipherMap[char] : char;
  }
  cipherEl.value = result;
}

// Fonction de décodage
function decode() {
  const plainEl = document.getElementById('plainText');
  const cipherEl = document.getElementById('cipherText');
  if (!plainEl || !cipherEl) return;
  const input = cipherEl.value || '';
  let result = '';
  for (const char of input) {
    result += decodeMap[char] ? decodeMap[char] : char;
  }
  plainEl.value = result;
}

// Fonctions d'effacement
function clearPlain() {
  const plainEl = document.getElementById('plainText');
  const cipherEl = document.getElementById('cipherText');
  if (plainEl) plainEl.value = '';
  if (cipherEl) cipherEl.value = '';
}

function clearCipher() {
  const plainEl = document.getElementById('plainText');
  const cipherEl = document.getElementById('cipherText');
  if (cipherEl) cipherEl.value = '';
  if (plainEl) plainEl.value = '';
}

// Exposer (optionnel) pour debug dans la console
window.encode = encode;
window.decode = decode;
window.clearPlain = clearPlain;
window.clearCipher = clearCipher;
window.shuffleMapping = shuffleMapping;

async function loadSavedMap() {
  try {
    const resp = await fetch('/cipher/map', { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) return;
    const data = await resp.json();
    if (data && typeof data === 'object') {
      cipherMap = data;
      rebuildDecodeMap();
    }
  } catch {}
}

// Initialiser: tableau + écouteurs boutons et inputs
async function initCipher() {
  // Attempt to load saved mapping from server
  await loadSavedMap();
  // Fallback: load from data attribute if present and nothing loaded
  try {
    const tableEl = document.getElementById('cipherTable');
    const hasServer = Object.keys(cipherMap||{}).length > 0;
    if (!hasServer && tableEl) {
      const data = tableEl.getAttribute('data-map') || '';
      if (data) {
        const obj = JSON.parse(data);
        if (obj && typeof obj === 'object') {
          cipherMap = obj;
          rebuildDecodeMap();
        }
      }
    }
  } catch {}
  displayCipherTable();

  const plain = document.getElementById('plainText');
  const cipher = document.getElementById('cipherText');

  const encodeBtn = document.getElementById('encodeBtn');
  if (encodeBtn) encodeBtn.addEventListener('click', encode);
  const clearPlainBtn = document.getElementById('clearPlainBtn');
  if (clearPlainBtn) clearPlainBtn.addEventListener('click', clearPlain);
  const decodeBtn = document.getElementById('decodeBtn');
  if (decodeBtn) decodeBtn.addEventListener('click', decode);
  const clearCipherBtn = document.getElementById('clearCipherBtn');
  if (clearCipherBtn) clearCipherBtn.addEventListener('click', clearCipher);

  const shuffleBtn = document.getElementById('shuffleBtn');
  if (shuffleBtn) shuffleBtn.addEventListener('click', async function() {
    shuffleMapping();
    try {
      await fetch('/cipher/shuffle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping: cipherMap })
      });
    } catch {}
  });

  const saveBtn = document.getElementById('saveMapBtn');
  if (saveBtn) saveBtn.addEventListener('click', async function() {
    try {
      await fetch('/cipher/shuffle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping: cipherMap })
      });
    } catch {}
  });

  if (plain) {
    plain.addEventListener('input', function () {
      if (this.value.trim()) {
        encode();
      } else if (cipher) {
        cipher.value = '';
      }
    });
  }

  if (cipher) {
    cipher.addEventListener('input', function () {
      if (this.value.trim()) {
        decode();
      } else if (plain) {
        plain.value = '';
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCipher);
} else {
  initCipher();
}
