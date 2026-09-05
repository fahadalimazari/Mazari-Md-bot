// ---------------------------------------------------------------
// MAZARI MD – Pairing Frontend Logic (vanilla JS)
// ---------------------------------------------------------------

const API_URL = 'https://mazari-bot-01.herokuapp.com/api/session/pair'; // Direct Heroku backend link

const phoneInput = document.getElementById('phone-input');
const pairBtn = document.getElementById('pair-btn');
const resultDiv = document.getElementById('result');

function showMessage(message, type = 'success') {
  resultDiv.textContent = message;
  resultDiv.className = `result ${type}`;
  resultDiv.classList.remove('hidden');
}

function clearMessage() {
  resultDiv.classList.add('hidden');
  resultDiv.textContent = '';
}

pairBtn.addEventListener('click', async () => {
  clearMessage();
  const raw = phoneInput.value.trim();
  const sanitized = raw.replace(/[^0-9]/g, '');
  if (!sanitized || sanitized.length < 8) {
    showMessage('❌ Invalid number. Provide at least 8 digits.', 'error');
    return;
  }
  pairBtn.disabled = true;
  pairBtn.textContent = 'Generating…';
  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: sanitized })
    });
    const data = await resp.json();
    if (resp.ok && data.code) {
      showMessage(`✅ Pairing Code: ${data.code}\nNumber: ${sanitized}`);
    } else {
      const err = data.error || 'Unknown error';
      showMessage(`❌ ${err}`, 'error');
    }
  } catch (e) {
    console.error(e);
    showMessage('❌ Network error – unable to contact server.', 'error');
  } finally {
    pairBtn.disabled = false;
    pairBtn.textContent = 'Generate Code';
  }
});
