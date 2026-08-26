const { initSession, pairingCodesStore } = require('./lib/baileys-helper');

async function run() {
    console.log("Generating code for 923043514180...");
    await initSession('923043514180', { usePairingCode: true });
    
    let attempts = 0;
    const interval = setInterval(() => {
        const code = pairingCodesStore.get('923043514180');
        if (code) {
            console.log("\n=========================");
            console.log("YOUR PAIRING CODE:", code);
            console.log("=========================\n");
            clearInterval(interval);
            process.exit(0);
        }
        attempts++;
        if (attempts > 15) {
            console.log("Timed out waiting for code.");
            clearInterval(interval);
            process.exit(1);
        }
    }, 1000);
}

run();
