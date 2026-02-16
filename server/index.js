const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" } // В продакшене укажи свой URL от Vercel/Ngrok
});

// Хранилище лобби в памяти сервера
let lobbies = {}; 

io.on('connection', (socket) => {
    console.log('Пользователь подключился:', socket.id);

    // 1. Создание лобби
    socket.on('create_lobby', (userData) => {
        const lobbyId = Math.random().toString(36).substring(7);
        lobbies[lobbyId] = {
            id: lobbyId,
            players: [{ ...userData, id: socket.id, isReady: false }]
        };
        socket.join(lobbyId);
        socket.emit('lobby_created', lobbies[lobbyId]);
    });

    // 2. Вход в лобби
    socket.on('join_lobby', ({ lobbyId, userData }) => {
        if (lobbies[lobbyId]) {
            lobbies[lobbyId].players.push({ ...userData, id: socket.id, isReady: false });
            socket.join(lobbyId);
            io.to(lobbyId).emit('update_lobby', lobbies[lobbyId]);
        }
    });

    // 3. Статус "Готов"
    socket.on('player_ready', ({ lobbyId }) => {
        const lobby = lobbies[lobbyId];
        if (lobby) {
            const player = lobby.players.find(p => p.id === socket.id);
            if (player) player.isReady = !player.isReady;

            io.to(lobbyId).emit('update_lobby', lobby);

            // Проверка: все ли готовы?
            if (lobby.players.length >= 2 && lobby.players.every(p => p.isReady)) {
                io.to(lobbyId).emit('game_start');
            }
        }
    });

    socket.on('disconnect', () => {
        // Логика удаления игрока из лобби при выходе
        console.log('Отключился:', socket.id);
    });
});

server.listen(3001, () => console.log('Сервер запущен на порту 3001'));