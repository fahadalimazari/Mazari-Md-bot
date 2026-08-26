const { requestPairingCode, pairingCodesStore } = require('./lib/baileys-helper');
const fs = require('fs');
require('dotenv').config();

async function getCode() {
    const number = process.argv[2] || '923223602988';
    console.log("Requesting pairing code for " + number + "...");
    await requestPairingCode(number);
    
    // Wait for the code to be generated and stored
    setTimeout(() => {
        const code = pairingCodesStore.get(number);
        fs.writeFileSync('pairing_code_output.txt', code || 'NO_CODE');
        console.log("Written to file");
        process.exit(0);
    }, 8000);
}

getCode().catch(console.error);
