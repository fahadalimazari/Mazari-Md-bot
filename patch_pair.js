const fs = require('fs');
let code = fs.readFileSync('commands/pair.js', 'utf8');

const replacement1 = "`╭─〔 𝗠𝗔𝗭𝗔𝗥𝗜 𝗠𝗗 〕\\n│ 𝘗𝘢𝘪𝘳𝘪𝘯𝘨 𝘯𝘶𝘮𝘣𝘦𝘳: ${_0x17baec}\\n│ 𝘗𝘭𝘦𝘢𝘴𝘦 𝘸𝘢𝘪𝘵 𝘧𝘰𝘳 𝘤𝘰𝘥𝘦...\\n╰──────────────`";
const replacement2 = "`╭─〔 𝗠𝗔𝗭𝗔𝗥𝗜 𝗠𝗗 〕\\n│ 𝘗𝘢𝘪𝘳𝘪𝘯𝘨 𝘊𝘰𝘥𝘦: *${_0x4e2040}*\\n│ 𝘕𝘶𝘮𝘣𝘦𝘳: ${_0x17baec}\\n│\\n│ 𝘞𝘩𝘢𝘵𝘴𝘈𝘱𝘱 → 𝘚𝘦𝘵𝘵𝘪𝘯𝘨𝘴\\n│ 𝘓𝘪𝘯𝘬𝘦𝘥 𝘋𝘦𝘷𝘪𝘤𝘦𝘴 → 𝘓𝘪𝘯𝘬 𝘸𝘪𝘵𝘩 𝘗𝘩𝘰𝘯𝘦 𝘕𝘶𝘮𝘣𝘦𝘳\\n╰──────────────`";

code = code.replace(/_0x425347\(0xc3\)/g, replacement1);
code = code.replace(/_0x425347\(0xc2\)\+_0x4e2040/g, replacement2);

fs.writeFileSync('commands/pair.js', code);
console.log('Replaced successfully');
