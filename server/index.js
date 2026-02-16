const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Конфигурация лобби
const MAX_PLAYERS = 6;
const MIN_PLAYERS = 3;
const TOTAL_ROUNDS = 6;

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
            maxPlayers: MAX_PLAYERS,
            status: 'waiting'
        };
        lobbies.set(lobbyId, newLobby);
        socket.join(lobbyId);
        
        io.emit('lobby_list', Array.from(lobbies.values()));
        socket.emit('lobby_created', newLobby);
    });

   socket.on('join_lobby', ({ lobbyId, userData }) => {
        const lobby = lobbies.get(lobbyId);
        if (!lobby) return;

        // БАГ-ФИКС: Проверяем, не зашел ли игрок уже в это лобби
        const isAlreadyIn = lobby.players.find(p => p.id === socket.id);
        
        if (!isAlreadyIn && lobby.players.length < MAX_PLAYERS && lobby.status === 'waiting') {
            const newPlayer = { id: socket.id, name: userData.name, isReady: false, photo: userData.photo };
            lobby.players.push(newPlayer);
            socket.join(lobbyId);
            
            // Подтверждаем вход конкретному игроку
            socket.emit('join_success', lobby); 
            
            // Обновляем данные для всех
            io.to(lobbyId).emit('update_lobby', lobby);
            io.emit('lobby_list', Array.from(lobbies.values()));
        }
    });

    // Логика исключения игрока
    socket.on('kick_player', ({ lobbyId, playerId }) => {
        const lobby = lobbies.get(lobbyId);
        // Только создатель (первый в списке) может кикать
        if (lobby && lobby.players[0].id === socket.id && lobby.players[0].id !== playerId) {
            const kickedSocket = io.sockets.sockets.get(playerId);
            if (kickedSocket) {
                kickedSocket.leave(lobbyId);
                kickedSocket.emit('kicked'); // Уведомляем беднягу
            }
            lobby.players = lobby.players.filter(p => p.id !== playerId);
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
                
                const allReady = lobby.players.length >= MIN_PLAYERS && lobby.players.every(p => p.isReady);
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