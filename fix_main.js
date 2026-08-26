const fs = require('fs');
let content = fs.readFileSync('main.js', 'utf8');

const imports = `
const shipCommand = require('./commands/ship');
const rateCommand = require('./commands/rate');
const simpCommand = require('./commands/simp');
const roastCommand = require('./commands/roast');
const slapCommand = require('./commands/slap');
const hugCommand = require('./commands/hug');
const fightCommand = require('./commands/fight');
const truthCommand = require('./commands/truth');
const dareCommand = require('./commands/dare');
const eightballCommand = require('./commands/eightball');
const jokeCommand = require('./commands/joke');
`;

const cases = `
            case userMessage.startsWith('.ship'):
                await shipCommand(sock, chatId, message, mentionedJids);
                break;
            case userMessage.startsWith('.rate'):
                await rateCommand(sock, chatId, message, mentionedJids);
                break;
            case userMessage.startsWith('.simp'):
                await simpCommand(sock, chatId, message, mentionedJids);
                break;
            case userMessage.startsWith('.roast'):
                await roastCommand(sock, chatId, message, mentionedJids);
                break;
            case userMessage.startsWith('.slap'):
                await slapCommand(sock, chatId, message, mentionedJids);
                break;
            case userMessage.startsWith('.hug'):
                await hugCommand(sock, chatId, message, mentionedJids);
                break;
            case userMessage.startsWith('.fight'):
                await fightCommand(sock, chatId, message, mentionedJids);
                break;
            case userMessage === '.truth' || userMessage.startsWith('.truth '):
                await truthCommand(sock, chatId, message);
                break;
            case userMessage === '.dare' || userMessage.startsWith('.dare '):
                await dareCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('.8ball'):
                const ballArgs = userMessage.slice(6).trim();
                await eightballCommand(sock, chatId, message, ballArgs);
                break;
            case userMessage === '.joke' || userMessage.startsWith('.joke '):
                await jokeCommand(sock, chatId, message);
                break;
`;

if (!content.includes("const shipCommand")) {
    content = content.replace("const playstoreCommand = require('./commands/playstore');", "const playstoreCommand = require('./commands/playstore');\\n" + imports.trim());
}

if (!content.includes("case userMessage.startsWith('.ship'):")) {
    content = content.replace("case userMessage.startsWith('.playstore'):", cases.trim() + "\\n            case userMessage.startsWith('.playstore'):");
}

fs.writeFileSync('main.js', content);
console.log("Fixed main.js");
