

require('./setting')
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeInMemoryStore, jidDecode, proto, getContentType, downloadContentFromMessage, fetchLatestWaWebVersion } = require("@adiwajshing/baileys");
const fs = require("fs");
const pino = require("pino");
const lolcatjs = require('lolcatjs')
const path = require('path')
const NodeCache = require("node-cache");
const msgRetryCounterCache = new NodeCache();
const fetch = require("node-fetch")
const FileType = require('file-type')
const _ = require('lodash')
const { Low, JSONFile } = require('./lib/lowdb')
const { Boom } = require("@hapi/boom");
const PhoneNumber = require("awesome-phonenumber");
const readline = require("readline");
const { smsg, color, getBuffer } = require("./lib/myfunc")
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { toAudio, toPTT, toVideo } = require('./lib/converter')
const store = makeInMemoryStore({ logger: pino().child({ level: "silent", stream: "store" }) });
global.db = new Low(new JSONFile(`database.json`))
global.DATABASE = global.db
global.loadDatabase = async function loadDatabase() {
  if (global.db.READ) return new Promise((resolve) => setInterval(function () { (!global.db.READ ? (clearInterval(this), resolve(global.db.data == null ? global.loadDatabase() : global.db.data)) : null) }, 1 * 1000))
  if (global.db.data !== null) return
  global.db.READ = true
  await global.db.read()
  global.db.READ = false
  global.db.data = {
    users: {},
    chats: {},
    game: {},
    settings: {},
    ...(global.db.data || {})
  }
  global.db.chain = _.chain(global.db.data)
}
loadDatabase()

if (global.db) setInterval(async () => {
   if (global.db.data) await global.db.write()
}, 30 * 1000)

function createTmpFolder() {
const folderName = "tmp";
const folderPath = path.join(__dirname, folderName);
if (!fs.existsSync(folderPath)) {
fs.mkdirSync(folderPath);
lolcatjs.fromString(`Folder '${folderName}' berhasil dibuat.`);
} else {
lolcatjs.fromString(`Folder '${folderName}' sudah ada.`);
}
}
createTmpFolder();

const usePairingCode = true
const question = (text) => {
const rl = readline.createInterface({
input: process.stdin,
output: process.stdout
});
return new Promise((resolve) => {
rl.question(text, resolve)
})
};

async function startBotz() {
const { state, saveCreds } = await useMultiFileAuthState("session")
const koy = makeWASocket({
logger: pino({ level: "silent" }),
printQRInTerminal: !usePairingCode,
auth: state,
msgRetryCounterCache,
connectTimeoutMs: 60000,
defaultQueryTimeoutMs: 0,
keepAliveIntervalMs: 10000,
emitOwnEvents: true,
fireInitQueries: true,
generateHighQualityLinkPreview: true,
syncFullHistory: true,
markOnlineOnConnect: true,
browser: ["Ubuntu", "Chrome", "20.0.04"],
});
if(usePairingCode && !koy.authState.creds.registered) {
const phoneNumber = await question('Masukan Nomer Yang Aktif Awali Dengan 62 Recode :\n');
const code = await koy.requestPairingCode(phoneNumber.trim())
console.log(`Pairing code: ${code}`)

}

store.bind(koy.ev);

// Add group-participants.update event listener
koy.ev.on('group-participants.update', async (update) => {
    try {
        if (!update || !update.participants || !Array.isArray(update.participants)) {
            console.error("Error: Tidak ada peserta yang terdeteksi dalam update.");
            return;
        }

        const metadata = await koy.groupMetadata(update.id); // Info grup
        const groupName = metadata.subject; // Nama grup
        const participants = update.participants; // ID peserta yang bergabung atau keluar
        const imagePath = './menu.jpg'; // Lokasi gambar (pastikan file ada)
        
        // URL untuk gambar stiker (gantilah dengan URL yang sesuai)
        const welcomeStickerUrl = 'https://pomf2.lain.la/f/bvyc5t8a.webp'; // Gantilah dengan URL stiker yang sesuai
        const goodbyeStickerUrl = 'https://pomf2.lain.la/f/2wlop366.webp'; // Gantilah dengan URL stiker yang sesuai

        for (const participant of participants) {
            if (update.action === 'add') { // Jika ada member baru
                if (!participant) continue; // Pastikan participant tidak undefined atau null
                let welcomeMessage = `🎉 Selamat datang di grup *${groupName}*! 🎉

📌 Patuhi aturan yang ada di deks  ya! 😊  
Berikut ini informasinya:
- Nama: @${participant.split('@')[0]}  
- Status: Bergabung 🤝  
- Total anggota sekarang: ${metadata.participants.length}  

Semoga betah di grup ini, dan jangan langgar peraturan ya📜`;

                // Mengirim pesan sambutan dengan gambar
                await koy.sendMessage(update.id, { 
                    image: { url: imagePath }, // Mengirim gambar dari path
                    caption: welcomeMessage, // Caption untuk gambar
                    mentions: [participant] // Menandai pengguna yang baru masuk 
                });

                // Mengirim stiker welcome dari URL
                const welcomeStickerBuffer = await getBuffer(welcomeStickerUrl); // Mengambil file stiker dari URL
                const stickerMessage = {
                    sticker: welcomeStickerBuffer,  // Mengirim stiker dalam bentuk buffer
                    mentions: [participant] // Menandai pengguna yang baru masuk
                };
                await koy.sendMessage(update.id, stickerMessage); // Mengirim stiker
            } else if (update.action === 'remove') { // Jika ada member keluar
                if (!participant) continue; // Pastikan participant tidak undefined atau null
                let goodbyeMessage = `👋 Selamat tinggal, @${participant.split('@')[0]}!  

Kami akan merindukan kehadiranmu. Semoga sukses dan jangan lupa mampir lagi kapan-kapan! 😊`;

                // Mengirim pesan perpisahan dengan gambar
                await koy.sendMessage(update.id, { 
                    image: { url: imagePath }, // Mengirim gambar dari path
                    caption: goodbyeMessage, // Caption untuk gambar
                    mentions: [participant] // Menandai pengguna yang keluar
                });

                // Mengirim stiker goodbye dari URL
                const goodbyeStickerBuffer = await getBuffer(goodbyeStickerUrl); // Mengambil file stiker dari URL
                const stickerMessageGoodbye = {
                    sticker: goodbyeStickerBuffer, // Mengirim stiker dalam bentuk buffer
                    mentions: [participant] // Menandai pengguna yang keluar
                };
                await koy.sendMessage(update.id, stickerMessageGoodbye); // Mengirim stiker perpisahan
            }
        }
    } catch (err) {
        console.error('Error pada group-participants.update:', err);
    }
});

koy.ev.on("messages.upsert", async (chatUpdate) => {
 try {
const mek = chatUpdate.messages[0]
if (!mek.message) return
mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
if (mek.key && mek.key.remoteJid === 'status@broadcast'){
 await koy.readMessages([mek.key]) }
if (!koy.public && !mek.key.fromMe && chatUpdate.type === 'notify') return
if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return
const m = smsg(koy, mek, store)
require("./koy")(koy, m, chatUpdate, store)
 } catch (err) {
 console.log(err)
 }
});

// Setting
koy.decodeJid = (jid) => {
if (!jid) return jid;
if (/:\d+@/gi.test(jid)) {
let decode = jidDecode(jid) || {};
return (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
} else return jid;
};

koy.ev.on("contacts.update", (update) => {
for (let contact of update) {
let id = koy.decodeJid(contact.id);
if (store && store.contacts) store.contacts[id] = { id, name: contact.notify };
}
});

koy.getName = (jid, withoutContact = false) => {
id = koy.decodeJid(jid);
withoutContact = koy.withoutContact || withoutContact;
let v;
if (id.endsWith("@g.us"))
return new Promise(async (resolve) => {
v = store.contacts[id] || {};
if (!(v.name || v.subject)) v = koy.groupMetadata(id) || {};
resolve(v.name || v.subject || PhoneNumber("+" + id.replace("@s.whatsapp.net", "")).getNumber("international"));
});
else
v =
id === "0@s.whatsapp.net"
? {
id,
name: "WhatsApp",
}
: id === koy.decodeJid(koy.user.id)
? koy.user
: store.contacts[id] || {};
return (withoutContact ? "" : v.name) || v.subject || v.verifiedName || PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber("international");
};

koy.public = true;

koy.serializeM = (m) => smsg(koy, m, store)

koy.ev.on('connection.update', async (update) => {
const {
connection,
lastDisconnect
} = update
try{
if (connection === 'close') {
let reason = new Boom(lastDisconnect?.error)?.output.statusCode
if (reason === DisconnectReason.badSession) { console.log(`Bad Session File, Please Delete Session and Verifikasi Again`); koy.logout(); }
else if (reason === DisconnectReason.connectionClosed) { console.log("Connection closed, reconnecting...."); startBotz(); }
else if (reason === DisconnectReason.connectionLost) { console.log("Connection Lost from Server, reconnecting..."); startBotz(); }
else if (reason === DisconnectReason.connectionReplaced) { console.log("Connection Replaced, Another New Session Opened, Please Close Current Session First"); koy.logout(); }
else if (reason === DisconnectReason.loggedOut) { console.log(`Device Logged Out, Please Verifikasi Again And Run.`); koy.logout(); }
else if (reason === DisconnectReason.restartRequired) { console.log("Restart Required, Restarting..."); startBotz(); }
else if (reason === DisconnectReason.timedOut) { console.log("Connection TimedOut, Reconnecting..."); startBotz(); }
else koy.end(`Unknown DisconnectReason: ${reason}|${connection}`)
} if (update.connection == "open" || update.receivedPendingNotifications == "true") {
lolcatjs.fromString('Connect, welcome owner!')
lolcatjs.fromString(`Connected to = ` + JSON.stringify(koy.user, null, 2))
}} catch (err) {
console.log('Error Di Connection.update '+err)
}
})


koy.ev.on("creds.update", saveCreds);
koy.getFile = async (PATH, returnAsFilename) => {
let res, filename
const data = Buffer.isBuffer(PATH) ? PATH : /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split`,` [1], 'base64') : /^https?:\/\//.test(PATH) ? await (res = await fetch(PATH)).buffer() : fs.existsSync(PATH) ? (filename = PATH, fs.readFileSync(PATH)) : typeof PATH === 'string' ? PATH : Buffer.alloc(0)
if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer')
const type = await FileType.fromBuffer(data) || {
mime: 'application/octet-stream',
ext: '.bin'
}
if (data && returnAsFilename && !filename)(filename = path.join(__dirname, './tmp/' + new Date * 1 + '.' + type.ext), await fs.promises.writeFile(filename, data))
return {
res,
filename,
...type,
data,
deleteFile() {
return filename && fs.promises.unlink(filename)
}
}
}

koy.downloadMediaMessage = async (message) => {
let mime = (message.msg || message).mimetype || ''
let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
const stream = await downloadContentFromMessage(message, messageType)
let buffer = Buffer.from([])
for await(const chunk of stream) {
buffer = Buffer.concat([buffer, chunk])}
return buffer} 

koy.sendFile = async (jid, path, filename = '', caption = '', quoted, ptt = false, options = {}) => {
let type = await koy.getFile(path, true)
let { res, data: file, filename: pathFile } = type
if (res && res.status !== 200 || file.length <= 65536) {
try { throw { json: JSON.parse(file.toString()) } }
catch (e) { if (e.json) throw e.json }
}
let opt = { filename }
if (quoted) opt.quoted = quoted
if (!type) options.asDocument = true
let mtype = '', mimetype = type.mime, convert
if (/webp/.test(type.mime) || (/image/.test(type.mime) && options.asSticker)) mtype = 'sticker'
else if (/image/.test(type.mime) || (/webp/.test(type.mime) && options.asImage)) mtype = 'image'
else if (/video/.test(type.mime)) mtype = 'video'
else if (/audio/.test(type.mime)) (
convert = await (ptt ? toPTT : toAudio)(file, type.ext),
file = convert.data,
pathFile = convert.filename,
mtype = 'audio',
mimetype = 'audio/ogg; codecs=opus'
)
else mtype = 'document'
if (options.asDocument) mtype = 'document'

let message = {
...options,
caption,
ptt,
[mtype]: { url: pathFile },
mimetype
}
let m
try {
m = await koy.sendMessage(jid, message, { ...opt, ...options })
} catch (e) {
console.error(e)
m = null
} finally {
if (!m) m = await koy.sendMessage(jid, { ...message, [mtype]: file }, { ...opt, ...options })
return m
}
}
koy.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
let buffer
if (options && (options.packname || options.author)) {
buffer = await writeExifVid(buff, options)
} else {
buffer = await videoToWebp(buff)
}
await koy.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted })
return buffer
}
koy.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
let quoted = message.msg ? message.msg : message
let mime = (message.msg || message).mimetype || ''
let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0]
const stream = await downloadContentFromMessage(quoted, messageType)
let buffer = Buffer.from([])
for await(const chunk of stream) {
buffer = Buffer.concat([buffer, chunk])
}
let type = await FileType.fromBuffer(buffer)
trueFileName = attachExtension ? (filename + '.' + type.ext) : filename
await fs.writeFileSync(trueFileName, buffer)
return trueFileName
}
const path = require('path');

koy.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
    let quoted = message.msg ? message.msg : message;
    let mime = (message.msg || message).mimetype || '';
    let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
    const stream = await downloadContentFromMessage(quoted, messageType);
    let buffer = Buffer.from([]);
    for await(const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    let type = await FileType.fromBuffer(buffer);
    let trueFileName = attachExtension ? (filename + '.' + type.ext) : filename;
    let savePath = path.join(__dirname, 'tmp', trueFileName); // Save to 'tmp' folder
    await fs.writeFileSync(savePath, buffer);
    return savePath;
};
koy.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
let buff = Buffer.isBuffer(path) ? path : /^data:.*?\/.*?;base64,/i.test(path) ? Buffer.from(path.split`,`[1], 'base64') : /^https?:\/\//.test(path) ? await (await getBuffer(path)) : fs.existsSync(path) ? fs.readFileSync(path) : Buffer.alloc(0)
let buffer
if (options && (options.packname || options.author)) {
buffer = await writeExifImg(buff, options)
} else {
buffer = await imageToWebp(buff)
}
await koy.sendMessage(jid, { sticker: { url: buffer }, ...options }, { quoted })
return buffer
}
koy.sendText = (jid, text, quoted = '', options) => koy.sendMessage(jid, { text: text, ...options }, { quoted })
return koy;
}

startBotz();

//batas
let file = require.resolve(__filename)
fs.watchFile(file, () => {
fs.unwatchFile(file)
console.log(`Update ${__filename}`)
delete require.cache[file]
require(file)
})
