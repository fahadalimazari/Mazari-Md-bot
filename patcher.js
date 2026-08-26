const fs = require('fs');
const path = require('path');

const filesToPatch = [
    'anticall.js', 'antidelete.js', 'autoreact.js', 'autoread.js', 
    'autostatus.js', 'autotyping.js', 'chatbot.js', 'mention.js', 
    'pmblocker.js', 'smartreply.js', 'tag.js', 'topmembers.js', 
    'viewonce.js', 'warnings.js', 'settings.js', 'help.js'
];

for (const file of filesToPatch) {
    const filePath = path.join(__dirname, 'commands', file);
    if (!fs.existsSync(filePath)) continue;
    let code = fs.readFileSync(filePath, 'utf8');

    // Add sessionManager import
    if (!code.includes('sessionManager')) {
        code = `const { getSessionId, readSessionData, writeSessionData, getSessionCache } = require('../lib/sessionManager');\n` + code;
    }

    // Common replacements for configPath
    code = code.replace(/const [a-zA-Z0-9_]+ = path\.join\(__dirname,\s*['"]\.\.\/data.*['"]\);\n?/g, '');
    code = code.replace(/const [a-zA-Z0-9_]+ = path\.join\(__dirname,\s*['"]\.\.['"],\s*['"]data['"].*\);\n?/g, '');
    
    // safeReadJson(configPath...) -> readSessionData(getSessionId(sock), 'file.json'...)
    // This is hard to regex globally because the filename is gone.
    // Instead of deleting configPath, let's just redefine configPath dynamically inside the function, or better:
    
    console.log(`Ready to manually review: ${file}`);
}
