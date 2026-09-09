// ---------------------------------------------------------------
// MAZARI MD – Pairing Frontend Logic (vanilla JS)
// ---------------------------------------------------------------

const API_URL = 'https://mazari-bot-01-f026a4cd53d1.herokuapp.com/api/session/pair'; // Direct Heroku backend link

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
  preferredCountries: ["pk", "in", "ae", "sa", "gb", "us"]
});

// Function to dynamically add the country name next to the selected flag
function updateCountryName() {
  const countryData = iti.getSelectedCountryData();
  const selectedFlagContainer = document.querySelector('.iti__selected-flag');
  
  if (!selectedFlagContainer || !countryData) return;
  
  let nameSpan = document.querySelector('.iti__custom-country-name');
  if (!nameSpan) {
    nameSpan = document.createElement('span');
    nameSpan.className = 'iti__custom-country-name';
    
    // Insert the name between the flag and the dial code
    const dialCode = selectedFlagContainer.querySelector('.iti__selected-dial-code');
    if (dialCode) {
      selectedFlagContainer.insertBefore(nameSpan, dialCode);
    } else {
      selectedFlagContainer.appendChild(nameSpan);
    }
  }
  
  // Display only the main country name (stripping out brackets if any)
  nameSpan.textContent = countryData.name.split(' (')[0] + ' ';
}

// Initial setup and listener for country changes
phoneInput.addEventListener('countrychange', updateCountryName);
// Add a small delay for initial setup to ensure DOM is ready
setTimeout(updateCountryName, 100);

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
  
  let rawInput = phoneInput.value.replace(/[\s\-]/g, '');
  const countryData = iti.getSelectedCountryData();
  
  if (rawInput && countryData) {
      const dialCode = countryData.dialCode;
      
      // Auto-fix if user pasted international format directly in input
      if (rawInput.startsWith('+')) {
          iti.setNumber(rawInput);
      } 
      // Auto-fix if user typed 923001234567 while +92 is selected
      else if (rawInput.startsWith(dialCode) && rawInput.length > 10) {
          iti.setNumber('+' + rawInput);
      } 
      // Auto-fix for PK: if user typed 03001234567 (11 digits starting with 0)
      else if (countryData.iso2 === 'pk' && rawInput.startsWith('0') && rawInput.length === 11) {
          iti.setNumber('+' + dialCode + rawInput.substring(1));
      }
      // Auto-fix for PK: if user typed 3001234567 (10 digits starting with 3)
      else if (countryData.iso2 === 'pk' && rawInput.startsWith('3') && rawInput.length === 10) {
          iti.setNumber('+' + dialCode + rawInput);
      }
  }
  
  // Validate number using intl-tel-input built-in validation
  let isValid = iti.isValidNumber();
  let fullNumber = iti.getNumber();
  
  // Custom Fallback: libphonenumber (used by intl-tel-input) is often outdated
  // and incorrectly rejects newer Pakistani mobile prefixes (like 0355, 0370, etc).
  // In Pakistan, ANY 10-digit number starting with 3 is a valid mobile number.
  if (!isValid && countryData && countryData.iso2 === 'pk') {
      if (fullNumber.match(/^\+923\d{9}$/)) {
          isValid = true;
      }
  }

  if (!isValid) {
    showMessage('❌ Invalid phone number. Please check the country code and number.', 'error');
    return;
  }
  
  if (!fullNumber || !fullNumber.startsWith('+')) {
    showMessage('❌ Could not format international number properly.', 'error');
    return;
  }
  
  // Remove the '+' sign for the backend which expects pure digits like 923001234567
  const sanitized = fullNumber.replace('+', '').trim();
  
  pairBtn.disabled = true;
  btnText.textContent = 'GENERATING...';
  
  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: sanitized })
    });
    
    let data;
    try {
      data = await resp.json();
    } catch {
      throw new Error(`Server returned HTTP ${resp.status}`);
    }
    
    if (!resp.ok) {
      throw new Error(data?.message || data?.error || `HTTP ${resp.status}`);
    }
    
    if (data.code) {
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
    // Properly distinguish between network errors and API errors
    const errMsg = e.message.includes('Failed to fetch') || e.message.includes('NetworkError')
      ? 'Network error – unable to contact server.'
      : e.message;
    showMessage(`❌ ${errMsg}`, 'error');
    pairBtn.disabled = false;
    btnText.textContent = 'GENERATE PAIRING CODE';
  }
});
