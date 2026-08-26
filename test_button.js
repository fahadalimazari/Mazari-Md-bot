const { generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
const realCode = 'HZGY-BBNS';
const successUI = `╭─〔 𝗠𝗔𝗭𝗔𝗥𝗜 𝗠𝗗 〕\n│ 𝘗𝘢𝘪𝘳𝘪𝘯𝘨 𝘊𝘰𝘥𝘦: *${realCode}*\n│ 𝘕𝘶𝘮𝘣𝘦𝘳: 123456\n╰──────────────`;
const msg = generateWAMessageFromContent('123@s.whatsapp.net', {
    viewOnceMessage: {
        message: {
            messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2
            },
            interactiveMessage: proto.Message.InteractiveMessage.create({
                body: proto.Message.InteractiveMessage.Body.create({
                    text: successUI
                }),
                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                    buttons: [
                        {
                            name: 'cta_copy',
                            buttonParamsJson: JSON.stringify({
                                display_text: 'Copy Code',
                                id: '123456789',
                                copy_code: realCode
                            })
                        }
                    ]
                })
            })
        }
    }
}, {});
console.log(msg.message.viewOnceMessage.message.interactiveMessage.nativeFlowMessage.buttons);
