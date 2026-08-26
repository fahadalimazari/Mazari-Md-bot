const fs = require('fs');
const path = require('path');

const commandsDir = path.join(__dirname, 'commands');
const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));

for (const file of files) {
    const filePath = path.join(commandsDir, file);
    let code = fs.readFileSync(filePath, 'utf8');
    if (code.includes('path.join(__dirname, ') && code.includes('data')) {
        console.log(`Needs manual review: ${file}`);
    }
}
