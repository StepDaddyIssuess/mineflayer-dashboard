const express = require('express');
const http = require('http');
const path = require('path');
const mineflayer = require('mineflayer');
const { Server } = require('socket.io');
const fs = require('fs-extra');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const ACCOUNTS_FILE = path.join(__dirname, 'accounts.json');
let accounts = [];
if (fs.existsSync(ACCOUNTS_FILE)) {
    try {
        accounts = fs.readJSONSync(ACCOUNTS_FILE);
        if (!Array.isArray(accounts)) accounts = [];
    } catch {
        accounts = [];
    }
}

// Running bots and chat history
const bots = {}; // key: username, value: bot instance
const chatHistory = {}; // key: username, value: array of {from, message}

function saveAccounts() {
    fs.writeJSONSync(ACCOUNTS_FILE, accounts, { spaces: 2 });
}

// Headless dashboard → no open
server.listen(3000, '0.0.0.0', () => {
    console.log("Dashboard running at port 3000");
});

const http = require('http');
setInterval(() => {
    http.get('https://your-dashboard.onrender.com', res => {
        console.log(`Pinged dashboard to stay awake. Status: ${res.statusCode}`);
    }).on('error', err => {
        console.log(`Ping error: ${err.message}`);
    });
}, 5 * 60 * 1000)

async function createBot({ host, port, username, version }) {
    username = username || 'microsoft';
    if (bots[username]) {
        io.emit("log", `Bot "${username}" already running.`);
        return;
    }

    io.emit("log", `Starting bot for account "${username}"...`);

    const bot = mineflayer.createBot({
        host: host || 'localhost',
        port: parseInt(port) || 25565,
        username,
        auth: 'microsoft',
        version: '1.20.1',
        onMsaCode: (codeData) => {
            const url = codeData.verification_uri || codeData.verificationUri;
            const code = codeData.user_code || codeData.userCode;
            io.emit("loginPopup", { username, url, code });
        }
    });


    bot._client.on('packet', (packet, meta) => {
        if (meta.name === 'world_particles') {
            try {
                // ignore
            } catch (e) {
                if (!(e instanceof require('protodef').PartialReadError)) throw e;
            }
        }
    });

    bots[username] = bot;
    emitRunningBots();

    // Prefix console logs per bot
    const origLog = console.log;
    console.log = (...args) => {
        origLog.apply(console, args);
        io.emit("log", `[${username}] ${args.join(' ')}`);
    };

    // Bot login
    bot.once("login", () => {
        io.emit("log", `Bot "${username}" joined as ${bot.username}`);
        if (!accounts.includes(username)) {
            accounts.push(username);
            saveAccounts();
            io.emit("accountsList", accounts);
        }
    });

    // Chat listener
    bot.on("chat", (user, message) => {
    if (!chatHistory[bot.username]) chatHistory[bot.username] = [];

    const time = new Date().toLocaleTimeString();
    const rank = bot.player?.displayName || 'Unknown'; // Replace with your rank logic
    const color = bot.player?.teamColor || '#fff'; // Replace with in-game colors if available

    const chatMsg = { from: user, message, time, rank, color };
    chatHistory[bot.username].push(chatMsg);

    if (chatHistory[bot.username].length > 100) chatHistory[bot.username].shift();
    io.emit("chat", { bot: bot.username, ...chatMsg });
});

bot.on('message', (jsonMsg) => {
    if (!chatHistory[bot.username]) chatHistory[bot.username] = [];

    const message = jsonMsg.toString() || '';
    const time = new Date().toLocaleTimeString();

    const chatMsg = { from: 'SERVER', message, time, rank: '', color: '#ff5555' }; // red for server
    chatHistory[bot.username].push(chatMsg);

    if (chatHistory[bot.username].length > 100) chatHistory[bot.username].shift();
    io.emit("chat", { bot: bot.username, ...chatMsg });
});


    bot.on("kick", reason => io.emit("log", `[${username}] Kicked: ${reason}`));
    bot.on("error", err => io.emit("log", `[${username}] Error: ${err}`));


    // AFK jump
    setInterval(() => {
        if (bot.entity) {
            bot.setControlState("jump", true);
            setTimeout(() => bot.setControlState("jump", false), 400);
        }
    }, 15000);
}

function stopBot(username) {
    const bot = bots[username];
    if (!bot) return;
    bot.quit();
    delete bots[username];
    emitRunningBots();
}

// Emit list of running bots
function emitRunningBots() {
    io.emit("runningBots", Object.keys(bots));
}

// Socket.IO
io.on("connection", socket => {
    // Send running bots and chat history on new client
    Object.keys(bots).forEach(botName => {
        socket.emit("botRunning", { username: botName });
        if (chatHistory[botName]) {
            chatHistory[botName].forEach(msg => {
                socket.emit("chat", { bot: botName, from: msg.from, message: msg.message });
            });
        }
    });

    // Stored accounts
    socket.emit("accountsList", accounts);
    socket.emit("runningBots", Object.keys(bots));

    // Start bot from dashboard
    socket.on("startBot", data => {
        createBot(data).catch(err => io.emit("log", `Error starting bot: ${err}`));
    });

    function stopBot(username) {
    const bot = bots[username];
    if (!bot) return;

    bot.quit();                // disconnect the bot
    delete bots[username];     // remove from running bots
    emitRunningBots();         // update front-end lists

    // Emit a dashboard message
    io.emit("log", `Bot "${username}" has been stopped.`);
}

    // Send chat
socket.on("sendChat", ({ bot: botName, message }) => {
    const bot = bots[botName];
    if (!bot) {
        io.emit("log", `No such bot: ${botName}`);
        return;
    }
    try {
        // Send the chat
        if (typeof bot.chat === 'function') {
            bot.chat(message);
        } else if (typeof bot.say === 'function') {
            bot.say(message);
        } else {
            io.emit("log", `Chat function not available for ${botName}`);
            return;
        }

        // Immediately emit the sent message to dashboard
        io.emit("chat", { bot: botName, from: bot.username, message });
    } catch (e) {
        io.emit("log", `Chat error for ${botName}: ${e}`);
    }
});

    socket.on("getAccounts", () => socket.emit("accountsList", accounts));
});
