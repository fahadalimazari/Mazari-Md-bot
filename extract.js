const fs = require('fs');
const lines = fs.readFileSync('C:/Users/Fahad Mazari/.gemini/antigravity-ide/brain/a50d77b9-9096-45ea-a53d-6163f774000b/.system_generated/logs/transcript_full.jsonl', 'utf8').split('\n');
for(let i = 0; i < lines.length; i++) {
    if(lines[i].includes('"step_index":39') && lines[i].includes('Commands\\\\groupstatus.js')) {
        // Just print the whole line
    }
    if (lines[i].includes('groupstatus.js`\\nTotal Lines: 303')) {
        const parsed = JSON.parse(lines[i]);
        const content = parsed.content;
        fs.writeFileSync('full_groupstatus.txt', content);
        console.log("Found and wrote!");
        break;
    }
}
