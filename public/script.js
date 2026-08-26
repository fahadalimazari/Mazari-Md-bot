// ---------------------------------------------------------------
// MAZARI MD – Pairing Frontend Logic (vanilla JS)
// ---------------------------------------------------------------

const API_URL = '/api/session/pair'; // Adjust if your backend uses a different endpoint

const phoneInput = document.getElementById('phone-input');
const pairBtn = document.getElementById('pair-btn');
const btnText = document.getElementById('btn-text');
const resultDiv = document.getElementById('result');

// Initialize intl-tel-input
const iti = window.intlTelInput(phoneInput, {
  initialCountry: "auto",
  geoIpLookup: function(success, failure) {
    fetch("https://ipapi.co/json")
      .then(function(res) { return res.json(); })
      .then(function(data) { success(data.country_code); })
      .catch(function() { success("pk"); });
  },
  utilsScript: "https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/18.2.1/js/utils.js",
  separateDialCode: true,
  preferredCountries: ["pk", "in", "bd", "id", "br"]
});

// Smooth Scrolling for Nav Links
document.querySelectorAll('.nav-item').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    
    // Update active class
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    this.classList.add('active');
    
    // Scroll to section
    const targetId = this.getAttribute('href').substring(1);
    const targetElement = document.getElementById(targetId);
    if(targetElement) {
      window.scrollTo({
        top: targetElement.offsetTop - 100, // offset for fixed header
        behavior: 'smooth'
      });
    }
  });
});

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
  
  // Validate number using intl-tel-input built-in validation
  if (!iti.isValidNumber()) {
    showMessage('❌ Invalid phone number. Please check the country code and number.', 'error');
    return;
  }
  
  // Get full number in E.164 format (e.g., +923001234567)
  const fullNumber = iti.getNumber();
  
  // Remove the '+' sign for the backend which expects pure digits like 923001234567
  const sanitized = fullNumber.replace(/[^0-9]/g, '');
  
  pairBtn.disabled = true;
  btnText.textContent = 'GENERATING...';
  
  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: sanitized })
    });
    
    const data = await resp.json();
    
    if (resp.ok && data.code) {
      resultDiv.innerHTML = `
        <div class="pairing-result-box">
          <div class="pairing-code-content">
            <div style="font-size: 1.1em;">✅ Pairing Code: <strong style="letter-spacing: 2px; font-size: 1.2em; display: inline-block; margin-top: 5px;">${data.code}</strong></div>
            <div style="font-size: 0.85em; opacity: 0.8; margin-top: 4px;">Number: ${sanitized}</div>
          </div>
          <button id="copy-btn" class="btn-primary pairing-copy-btn">
            <i class="fas fa-copy"></i> Copy
          </button>
        </div>
      `;
      resultDiv.className = `result success`;
      resultDiv.classList.remove('hidden');

      // Add copy listener
      document.getElementById('copy-btn').addEventListener('click', async function() {
        try {
          await navigator.clipboard.writeText(data.code);
          this.innerHTML = '<i class="fas fa-check"></i> Copied ✓';
          setTimeout(() => {
            this.innerHTML = '<i class="fas fa-copy"></i> Copy';
          }, 2000);
        } catch(err) {
          console.error("Failed to copy", err);
          this.innerHTML = '<i class="fas fa-times"></i> Error';
        }
      });
      
      // Start 30-second cooldown
      let remaining = 30;
      btnText.textContent = `GENERATE AGAIN IN ${remaining}s`;
      const cooldownInterval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(cooldownInterval);
          pairBtn.disabled = false;
          btnText.textContent = 'GENERATE PAIRING CODE';
        } else {
          btnText.textContent = `GENERATE AGAIN IN ${remaining}s`;
        }
      }, 1000);
      
    } else {
      const err = data.error || 'Unknown error occurred';
      showMessage(`❌ ${err}`, 'error');
      pairBtn.disabled = false;
      btnText.textContent = 'GENERATE PAIRING CODE';
    }
  } catch (e) {
    console.error(e);
    showMessage('❌ Network error – unable to contact server.', 'error');
    pairBtn.disabled = false;
    btnText.textContent = 'GENERATE PAIRING CODE';
  }
});
