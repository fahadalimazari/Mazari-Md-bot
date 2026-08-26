const fs = require('fs');
let c = fs.readFileSync('main.js', 'utf8');

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

c = c.replace("const playstoreCommand = require('./commands/playstore');", "const playstoreCommand = require('./commands/playstore');\\n" + imports);
fs.writeFileSync('main.js', c);
