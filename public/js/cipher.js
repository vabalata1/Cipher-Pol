// Système de chiffrement glagolitique
const cipherMap = {
  'A': 'Ⱏ', 'B': 'Ⰸ', 'C': 'Ⱃ', 'D': 'Ⰻ', 'E': 'Ⱁ', 'F': 'Ⰽ', 'G': 'Ⱌ',
  'H': 'Ⰵ', 'I': 'Ⱒ', 'J': 'Ⱅ', 'K': 'Ⰱ', 'L': 'Ⰾ', 'M': 'Ⱇ', 'N': 'Ⱋ',
  'O': 'Ⰴ', 'P': 'Ⱈ', 'Q': 'Ⰿ', 'R': 'Ⱀ', 'S': 'Ⱄ', 'T': 'Ⰳ', 'U': 'Ⱆ',
  'V': 'Ⰲ', 'W': 'Ⱂ', 'X': 'Ⰰ', 'Y': 'Ⰹ', 'Z': 'Ⱌ'
};

// Créer la carte inverse pour le décodage
const decodeMap = {};
for (const [key, value] of Object.entries(cipherMap)) {
  decodeMap[value] = key;
}

// Afficher le tableau de correspondance
function displayCipherTable() {
  const table = document.getElementById('cipherTable');
  if (!table || table.children.length) return;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const letter of alphabet) {
    const pair = document.createElement('div');
    pair.className = 'cipher-pair';
    pair.innerHTML = `${letter} = <span class="glagolitic-char">${cipherMap[letter]}</span>`;
    table.appendChild(pair);
  }
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

// Initialiser: tableau + écouteurs boutons et inputs
function initCipher() {
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
