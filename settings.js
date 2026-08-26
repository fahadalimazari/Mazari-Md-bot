const settings = {
  packname: process.env.BOT_PACKNAME || 'MAZARI MD',
  author: process.env.BOT_AUTHOR || 'MAZARI HACKER',
  botName: process.env.BOT_NAME || "MAZARI MD",
  botOwner: process.env.BOT_OWNER || 'MAZARI HACKER',
  ownerNumber: process.env.OWNER_NUMBER || '923043514180', // Pakistan number format without + symbol
  ownerNumbers: (process.env.OWNER_NUMBERS || '923043514180').split(','), // Multiple owners array (comma separated, e.g., '923232391033,923232391034')
  giphyApiKey: process.env.GIPHY_API_KEY || 'qnl7ssQChTdPjsKta2Ax2LMaGXz303tq',
  commandMode: process.env.BOT_MODE || "public",
  maxStoreMessages: parseInt(process.env.MAX_STORE_MESSAGES || '20'),
  storeWriteInterval: parseInt(process.env.STORE_WRITE_INTERVAL || '10000'),
  description: "Professional WhatsApp bot for managing groups and automating tasks.",
  version: "1.0.0",
  logicUrl: process.env.LOGIC_URL || "", // Add your remote bin direct download link here
  updateZipUrl: "",
  channelLink: "https://whatsapp.com/channel/0029Vb6GUj8BPzjOWNfnhm1B",
  channelLink2: "https://whatsapp.com/channel/0029Vb6GUj8BPzjOWNfnhm1B",
  newsletterJid: "120363408484963246@newsletter",
  // ========================================
  // AUTO FOLLOW CHANNELS
  // EXISTING SYSTEM — DO NOT MODIFY
  // ========================================
  newsletters: [
    '120363408484963246@newsletter'
  ],

  // ========================================
  // AUTO REACT CHANNELS
  // NEW SYSTEM
  // ========================================
  autoReactChannels: [
    '120363408484963246@newsletter'
  ],
  autoReactEmojis: [
    "❤️", "🩷", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎",
    "💕", "💞", "💓", "💗", "💖", "💝", "💘", "💟", "🫶", "🫰",
    "💋", "🥰", "😍", "😘", "🔥", "⚡", "💥", "✨", "💫", "🌟",
    "⭐", "💯", "💪", "👍", "👌", "🤝", "👏", "🙌", "🙏", "🫡",
    "😎", "😏", "😈", "👑", "💎", "🏆", "🚀", "🌹", "🦋", "🌸"
  ]
};

module.exports = settings;
