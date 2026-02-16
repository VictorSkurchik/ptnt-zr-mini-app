const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Инициализируем Socket.io с поддержкой CORS для Vercel
const io = new Server(server, {
    cors: {
        // Укажи здесь свой адрес от Vercel БЕЗ слэша в конце
        origin: "https://ptnt-zr-mini-app.vercel.app", 
        methods: ["GET", "POST"],
        credentials: true
    },
    // Добавляем для стабильности в Telegram
    transports: ['websocket', 'polling'] 
});

const lobbies = new Map();

io.on('connection', (socket) => {
    console.log('Новое подключение:', socket.id);

    // Отправляем список лобби при входе
    socket.emit('lobby_list', Array.from(lobbies.values()));

    socket.on('create_lobby', (userData) => {
        const lobbyId = Math.random().toString(36).substring(2, 7).toUpperCase();
        const newLobby = {
            id: lobbyId,
            creator: userData.name,
            players: [{ id: socket.id, name: userData.name, isReady: false }],
            maxPlayers: 4,
            status: 'waiting'
        };
        lobbies.set(lobbyId, newLobby);
        socket.join(lobbyId);
        
        io.emit('lobby_list', Array.from(lobbies.values()));
        socket.emit('lobby_created', newLobby);
    });

    socket.on('join_lobby', ({ lobbyId, userData }) => {
        const lobby = lobbies.get(lobbyId);
        if (lobby && lobby.players.length < 4) {
            lobby.players.push({ id: socket.id, name: userData.name, isReady: false });
            socket.join(lobbyId);
            io.to(lobbyId).emit('update_lobby', lobby);
            io.emit('lobby_list', Array.from(lobbies.values()));
        }
    });

    socket.on('player_ready', ({ lobbyId }) => {
        const lobby = lobbies.get(lobbyId);
        if (lobby) {
            const player = lobby.players.find(p => p.id === socket.id);
            if (player) {
                player.isReady = !player.isReady;
                
                const allReady = lobby.players.length >= 2 && lobby.players.every(p => p.isReady);
                if (allReady) {
                    lobby.status = 'playing';
                    io.to(lobbyId).emit('game_start', lobby);
                } else {
                    io.to(lobbyId).emit('update_lobby', lobby);
                }
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('Пользователь отключился');
        // Тут можно добавить логику удаления игрока из лобби при дисконнекте
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});