const lobbies = new Map(); // Храним лобби тут

io.on('connection', (socket) => {
    // Отправляем список лобби при подключении
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
        io.emit('lobby_list', Array.from(lobbies.values())); // Обновляем список для всех
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
                
                // Проверка на автостарт
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
});
