const socket = io();

// Elements
const startBotBtn = document.getElementById('startBotBtn');
const hostInput = document.getElementById('host');
const portInput = document.getElementById('port');
const usernameInput = document.getElementById('username');
const logOutput = document.getElementById('logOutput');
const chatOutput = document.getElementById('chatOutput');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const botSelect = document.getElementById('botSelect');
const accountsListDiv = document.getElementById('accountsList');
const runningBotsDiv = document.getElementById('runningBotsDiv');

const loginModal = document.getElementById('loginModal');
const loginMessage = document.getElementById('loginMessage');
const overlay = document.getElementById('overlay');

// Start bot
startBotBtn.addEventListener('click', () => {
    const host = hostInput.value;
    const port = portInput.value || 25565;
    const username = usernameInput.value || 'microsoft';
    socket.emit('startBot', { host, port, username });
});

// Display logs
socket.on('log', msg => {
    logOutput.textContent += msg + '\n';
    logOutput.scrollTop = logOutput.scrollHeight;
});

// Display chat
socket.on('chat', ({ bot, from, message, time, rank, color }) => {
    const msgEl = document.createElement('div');

    // Fallbacks if undefined
    const displayTime = time || '';
    const displayRank = rank || '';
    const displayColor = color || '#ffffff';

    msgEl.innerHTML = `<span style="color:${displayColor}">[${bot}]</span> <strong>${from}</strong> ${displayRank ? `(${displayRank})` : ''} ${displayTime ? `[${displayTime}]` : ''}: ${message}`;
    chatOutput.appendChild(msgEl);
    chatOutput.scrollTop = chatOutput.scrollHeight;
});

// Show Microsoft login popup
socket.on('loginPopup', ({ username, url, code }) => {
    loginMessage.innerHTML = `<a href="${url}" target="_blank">${url}</a>\nCode: ${code}`;
    loginModal.style.display = 'block';
    overlay.style.display = 'block';
});

// Copy code
function copyCode() {
    navigator.clipboard.writeText(loginMessage.textContent).then(() => alert('Copied!'));
}

// Close modal
function closeModal() {
    loginModal.style.display = 'none';
    overlay.style.display = 'none';
}

// Send chat
sendChatBtn.addEventListener('click', () => {
    const botName = botSelect.value;
    const msg = chatInput.value.trim();
    if (!msg || !botName) return;
    socket.emit('sendChat', { bot: botName, message: msg });
    chatInput.value = '';
});

// Enter key for chat
chatInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') sendChatBtn.click();
});

// Update accounts list
function updateAccountsList(accounts) {
    accountsListDiv.innerHTML = '';
    accounts.forEach(username => {
        const btn = document.createElement('button');
        btn.textContent = username;
        btn.className = 'account-btn';
        btn.onclick = () => {
            const host = prompt(`Enter server IP for "${username}":`, 'localhost');
            const port = prompt(`Enter server port for "${username}":`, '25565');
            socket.emit('startBot', { username, host, port });
        };
        accountsListDiv.appendChild(btn);
    });
}

// Update running bots list
socket.on('runningBots', bots => {
    runningBotsDiv.innerHTML = '';
    botSelect.innerHTML = '';
    chatOutput.innerHTML = ''; // Clear chat when bots change

    bots.forEach(username => {
        const btn = document.createElement('button');
        btn.textContent = `Stop ${username}`;
        btn.className = 'account-btn';
        btn.onclick = () => {
            socket.emit('stopBot', username);
            // Optional: clear chat for this bot immediately
            chatOutput.innerHTML = '';
        };
        runningBotsDiv.appendChild(btn);

        const option = document.createElement('option');
        option.value = username;
        option.textContent = username;
        botSelect.appendChild(option);
    });
});

// Receive accounts list
socket.on('accountsList', updateAccountsList);
