const fs = require('fs');
let code = fs.readFileSync('commands/pair.js', 'utf8');

const errUI2 = "`╭─〔 𝗠𝗔𝗭𝗔𝗥𝗜 𝗠𝗗 〕\\n│ ❌ 𝘐𝘯𝘷𝘢𝘭𝘪𝘥 𝘯𝘶𝘮𝘣𝘦𝘳 𝘧𝘰𝘳𝘮𝘢𝘵.\\n╰──────────────`";
const notRegUI = "`╭─〔 𝗠𝗔𝗭𝗔𝗥𝗜 𝗠𝗗 〕\\n│ ❌ 𝘛𝘩𝘢𝘵 𝘯𝘶𝘮𝘣𝘦𝘳 𝘪𝘴 𝘯𝘰𝘵 𝘳𝘦𝘨𝘪𝘴𝘵𝘦𝘳𝘦𝘥 𝘰𝘯 𝘞𝘩𝘢𝘵𝘴𝘈𝘱𝘱.\\n╰──────────────`";

code = code.replace(/_0x425347\(0xc1\)/g, errUI2);
code = code.replace(/_0x425347\(0xd2\)/g, notRegUI);

fs.writeFileSync('commands/pair.js', code);
console.log('Replaced successfully');
