// ---------------------------------------------------------------
// MAZARI MD – Pairing Frontend Logic (vanilla JS)
// ---------------------------------------------------------------

// Manually maintain the list of server URLs.
// Replace each 'ACTUAL_URL_HERE' with the real Heroku endpoint for that server.
const servers = [
  { name: 'Server 01', url: 'https://mazari-bot-01-f026a4cd53d1.herokuapp.com/api/pair' },
  { name: 'Server 02', url: 'https://mazari-bot-02-4229c3de13cc.herokuapp.com/api/pair' },
  { name: 'Server 03', url: 'https://mazari-bot-03-20cdc505b493.herokuapp.com/api/pair' },
  { name: 'Server 04', url: 'https://mazari-bot-04-0b8d550a00ec.herokuapp.com/api/pair' },
  { name: 'Server 05', url: 'https://mazari-bot-05-332365fee9f6.herokuapp.com/api/pair' },
  { name: 'Server 06', url: 'https://mazari-bot-06-9f991bbd2bfc.herokuapp.com/api/pair' },
  { name: 'Server 07', url: 'https://mazari-bot-07-14871007c50f.herokuapp.com/api/pair' },
  { name: 'Server 08', url: 'https://mazari-bot-08-79010111441b.herokuapp.com/api/pair' },
  { name: 'Server 09', url: 'https://mazari-bot-09-f27b1333dfb3.herokuapp.com/api/pair' },
  { name: 'Server 10', url: 'https://mazari-bot-10-036a7b753d89.herokuapp.com/api/pair' },
  { name: 'Server 11', url: 'https://mazari-bot-11-078192affcee.herokuapp.com/api/pair' },
  { name: 'Server 12', url: 'https://mazari-bot-12-9fa914f669d7.herokuapp.com/api/pair' },
  { name: 'Server 13', url: 'https://mazari-bot-13-1a8bc74269c7.herokuapp.com/api/pair' },
  { name: 'Server 14', url: 'https://mazari-bot-14-8b2687f326b2.herokuapp.com/api/pair' },
  { name: 'Server 15', url: 'https://mazari-bot-15-79177262fa07.herokuapp.com/api/pair' },
  { name: 'Server 16', url: 'https://mazari-bot-16-e495309df151.herokuapp.com/api/pair' },
  { name: 'Server 17', url: 'https://mazari-bot-17-1485e858ee28.herokuapp.com/api/pair' },
  { name: 'Server 18', url: 'https://mazari-bot-18-a17bd06b73eb.herokuapp.com/api/pair' },
  { name: 'Server 19', url: 'https://mazari-bot-19-3b7fe4df963b.herokuapp.com/api/pair' },
  { name: 'Server 20', url: 'https://mazari-bot-20-94624274e4e8.herokuapp.com/api/pair' },
  { name: 'Server 21', url: 'https://mazari-bot-21-f004519eb609.herokuapp.com/api/pair' },
  { name: 'Server 22', url: 'https://mazari-bot-22-d6a73f135972.herokuapp.com/api/pair' },
  { name: 'Server 23', url: 'https://mazari-bot-23-f5300bd8abf9.herokuapp.com/api/pair' },
  { name: 'Server 24', url: 'https://mazari-bot-24-4fa34b575d0c.herokuapp.com/api/pair' },
  { name: 'Server 25', url: 'https://mazari-bot-25-8a125d4d49cb.herokuapp.com/api/pair' },
  { name: 'Server 26', url: 'https://mazari-bot-26-dd0238e4a86e.herokuapp.com/api/pair' },
  { name: 'Server 27', url: 'https://mazari-bot-27-8c415849bd43.herokuapp.com/api/pair' },
  { name: 'Server 28', url: 'https://mazari-bot-28-eb9524a0ba52.herokuapp.com/api/pair' },
  { name: 'Server 29', url: 'https://mazari-bot-29-a0c9526522cb.herokuapp.com/api/pair' },
  { name: 'Server 30', url: 'https://mazari-bot-30-6de49455c489.herokuapp.com/api/pair' },
  { name: 'Server 31', url: 'https://mazari-bot-31-1fc44228fe32.herokuapp.com/api/pair' },
  { name: 'Server 32', url: 'https://mazari-bot-32-54cfd2ea5c04.herokuapp.com/api/pair' },
  { name: 'Server 33', url: 'https://mazari-bot-33-71332da71939.herokuapp.com/api/pair' },
  { name: 'Server 34', url: 'https://mazari-bot-34-1f12ae2ac13c.herokuapp.com/api/pair' },
  { name: 'Server 35', url: 'https://mazari-bot-35-bdadea77c5a3.herokuapp.com/api/pair' },
  { name: 'Server 36', url: 'https://mazari-bot-36-9a48c9e55954.herokuapp.com/api/pair' },
  { name: 'Server 37', url: 'https://mazari-bot-37-f1e0cdaf8658.herokuapp.com/api/pair' },
  { name: 'Server 38', url: 'https://mazari-bot-38-8379a844a0ab.herokuapp.com/api/pair' },
  { name: 'Server 39', url: 'https://mazari-bot-39-0bfa448cfb99.herokuapp.com/api/pair' },
  { name: 'Server 40', url: 'https://mazari-bot-40-8472329bcf93.herokuapp.com/api/pair' },
  { name: 'Server 41', url: 'https://mazari-bot-41-f9b8f269d161.herokuapp.com/api/pair' },
  { name: 'Server 42', url: 'https://mazari-bot-42-49094ffb596a.herokuapp.com/api/pair' },
  { name: 'Server 43', url: 'https://mazari-bot-43-16d29632211e.herokuapp.com/api/pair' },
  { name: 'Server 44', url: 'https://mazari-bot-44-3e346d98ce03.herokuapp.com/api/pair' },
  { name: 'Server 45', url: 'https://mazari-bot-45-636eb257d34c.herokuapp.com/api/pair' },
  { name: 'Server 46', url: 'https://mazari-bot-46-461000991742.herokuapp.com/api/pair' },
  { name: 'Server 47', url: 'https://mazari-bot-47-4931fe88d456.herokuapp.com/api/pair' },
  { name: 'Server 48', url: 'https://mazari-bot-48-3bdf66aa2289.herokuapp.com/api/pair' }
];


// Map to hold live server status data
const serverStatusMap = new Map();

async function fetchSingleServerStatus(server) {
  const healthUrl = server.url.replace('/api/pair', '/api/health');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  
  try {
    const res = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const current = typeof data.current_sessions === 'number' ? data.current_sessions : 0;
    const max = typeof data.max_sessions === 'number' ? data.max_sessions : 30;
    const available = typeof data.available_slots === 'number' ? data.available_slots : Math.max(0, max - current);
    const isFull = current >= max;
    
    return {
      name: server.name,
      url: server.url,
      status: isFull ? 'FULL' : 'ONLINE',
      current,
      max,
      available,
      isFull
    };
  } catch (err) {
    clearTimeout(timeoutId);
    return {
      name: server.name,
      url: server.url,
      status: 'OFFLINE',
      current: 0,
      max: 30,
      available: 0,
      isFull: false
    };
  }
}

async function loadAllServerStatuses() {
  const gridContainer = document.getElementById('servers-grid');
  const serverSelector = document.getElementById('server-selector');
  const refreshBtn = document.getElementById('refresh-servers-btn');
  
  if (refreshBtn) refreshBtn.classList.add('spinning');
  
  const results = await Promise.all(servers.map(server => fetchSingleServerStatus(server)));
  
  if (refreshBtn) refreshBtn.classList.remove('spinning');
  
  // Populate dropdown options & status grid
  if (serverSelector) {
    const selectedVal = serverSelector.value;
    serverSelector.innerHTML = '';
    
    if (gridContainer) gridContainer.innerHTML = '';
    
    results.forEach((st) => {
      serverStatusMap.set(st.url, st);
      
      // Update dropdown option
      const option = document.createElement('option');
      option.value = st.url;
      
      let statusLabel = '';
      if (st.status === 'ONLINE') {
        statusLabel = `[ONLINE - ${st.current}/${st.max} (${st.available} Available)]`;
      } else if (st.status === 'FULL') {
        statusLabel = `[FULL - ${st.current}/${st.max}]`;
      } else {
        statusLabel = `[OFFLINE]`;
      }
      
      option.textContent = `${st.name} ${statusLabel}`;
      serverSelector.appendChild(option);
      
      // Render Grid Card
      if (gridContainer) {
        const card = document.createElement('div');
        card.className = `server-card ${st.status.toLowerCase()}`;
        card.setAttribute('data-url', st.url);
        
        let badgeClass = 'badge-online';
        if (st.status === 'FULL') badgeClass = 'badge-full';
        if (st.status === 'OFFLINE') badgeClass = 'badge-offline';
        
        const pct = Math.min(100, Math.round((st.current / st.max) * 100));
        
        card.innerHTML = `
          <div class="server-card-header">
            <span class="server-name">${st.name}</span>
            <span class="server-badge ${badgeClass}">${st.status}</span>
          </div>
          <div class="server-card-body">
            <div class="capacity-stats">
              <span class="stat-counts"><i class="fas fa-robot"></i> ${st.current} / ${st.max}</span>
              <span class="stat-available">${st.status === 'FULL' ? '0 Available' : st.available + ' Available'}</span>
            </div>
            <div class="progress-bar-bg">
              <div class="progress-bar-fill ${pct >= 100 ? 'fill-full' : (pct >= 80 ? 'fill-warn' : 'fill-ok')}" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
        
        card.addEventListener('click', () => {
          if (serverSelector) {
            serverSelector.value = st.url;
            updateSelectedServerInfo();
          }
          const formCard = document.querySelector('.form-card');
          if (formCard) {
            formCard.scrollIntoView({ behavior: 'smooth' });
          }
          const phoneInputEl = document.getElementById('phone-input');
          if (phoneInputEl) phoneInputEl.focus();
        });
        
        gridContainer.appendChild(card);
      }
    });
    
    if (selectedVal && Array.from(serverSelector.options).some(o => o.value === selectedVal)) {
      serverSelector.value = selectedVal;
    }
    updateSelectedServerInfo();
  }
}

function updateSelectedServerInfo() {
  const serverSelector = document.getElementById('server-selector');
  const infoEl = document.getElementById('selected-server-info');
  if (!serverSelector || !infoEl) return;
  
  const st = serverStatusMap.get(serverSelector.value);
  if (st) {
    if (st.status === 'FULL') {
      infoEl.innerHTML = `<i class="fas fa-exclamation-triangle text-red"></i> <strong class="text-red">${st.name} is FULL (${st.current}/${st.max}).</strong> Please select another server with available capacity.`;
    } else if (st.status === 'OFFLINE') {
      infoEl.innerHTML = `<i class="fas fa-times-circle text-red"></i> <strong>${st.name} appears OFFLINE.</strong> Pairing might fail or timeout.`;
    } else {
      infoEl.innerHTML = `<i class="far fa-check-circle text-red"></i> <strong>${st.name} ONLINE:</strong> ${st.current}/${st.max} bots (${st.available} slots available)`;
    }
  } else {
    infoEl.innerHTML = `<i class="far fa-check-circle text-red"></i> Selected server handles your pairing request directly`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const serverSelector = document.getElementById('server-selector');
  if (serverSelector) {
    servers.forEach(server => {
      const option = document.createElement('option');
      option.value = server.url;
      option.textContent = `${server.name} [Loading...]`;
      serverSelector.appendChild(option);
    });
    
    serverSelector.addEventListener('change', updateSelectedServerInfo);
  }
  
  const refreshBtn = document.getElementById('refresh-servers-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadAllServerStatuses);
  }
  
  // Initial status fetch
  loadAllServerStatuses();
  // Auto refresh every 30 seconds
  setInterval(loadAllServerStatuses, 30000);
});
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
  
  const selectedUrl = document.getElementById('server-selector').value;

  try {
    const resp = await fetch(selectedUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phone: sanitized })
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
