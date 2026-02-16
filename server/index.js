const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Конфигурация лобби
const MAX_PLAYERS = 6;
const MIN_PLAYERS = 3;
const TOTAL_ROUNDS = 6;

// Профессии и вирусы
const ASSETS_BASE_URL = '/assets/images/scans/';

const PROFESSIONS = [
    {
        name: 'Капитан',
        fakeSymptomChance: 0.40,
        affectedPart: 'eyes',
        // Капитан имитирует симптомы Межгалактического Гриппа (красные/неоновые глаза)
        mimicsVirusId: 'v3', 
        traitDescription: 'Красные глаза от лопнувших сосудов из-за бессонных смен.'
    },
    {
        name: 'Врач',
        fakeSymptomChance: 0.30,
        affectedPart: 'hands',
        // Врач имитирует Пустотный Шепот (бледные/прозрачные руки)
        mimicsVirusId: 'v6',
        traitDescription: 'Кожа рук полупрозрачная от постоянного контакта со спиртом.'
    },
    {
        name: 'Ученый',
        fakeSymptomChance: 0.50,
        affectedPart: 'eyes',
        // Ученый имитирует Кибер-Чуму (странные зрачки)
        mimicsVirusId: 'v5',
        traitDescription: 'Разный размер зрачков из-за работы с линзами.'
    },
    {
        name: 'Инженер',
        fakeSymptomChance: 0.60,
        affectedPart: 'hands',
        // Инженер имитирует Вирус-Забываку (непонятная форма пальцев/грязь)
        mimicsVirusId: 'v4',
        traitDescription: 'Глубоко въевшаяся мазута и деформация пальцев.'
    },
    {
        name: 'Повар',
        fakeSymptomChance: 0.45,
        affectedPart: 'mouth',
        // Повар имитирует Звездную Чесотку (цветной язык от специй)
        mimicsVirusId: 'v1',
        traitDescription: 'Зубы и язык окрашены инопланетными приправами.'
    },
    {
        name: 'Солдат',
        fakeSymptomChance: 0.35,
        affectedPart: 'mouth',
        // Солдат имитирует Синдром Перфекциониста (оскал/белые зубы)
        mimicsVirusId: 'v2',
        traitDescription: 'Стиснутые челюсти и сколы на эмали от стресса.'
    }
];

const VIRUSES = [
    {
        id: 'v1',
        name: 'Звездная Чесотка',
        infectivity: 25,
        incubationPeriod: 1,
        images: {
                mouth: `${ASSETS_BASE_URL}mouth/virus_mouth_v1.png`,
                eyes: `${ASSETS_BASE_URL}eyes/virus_eyes_v1.png`,
                hands: `${ASSETS_BASE_URL}hands/virus_hands_v1.png`
            }
    },
    {
        id: 'v2',
        name: 'Синдром Перфекциониста',
        infectivity: 30,
        incubationPeriod: 2,
        images: {
                mouth: `${ASSETS_BASE_URL}mouth/virus_mouth_v2.png`,
                eyes: `${ASSETS_BASE_URL}eyes/virus_eyes_v2.png`,
                hands: `${ASSETS_BASE_URL}hands/virus_hands_v2.png`
            }
    },
    {
        id: 'v3',
        name: 'Межгалактический Грипп',
        infectivity: 35,
        incubationPeriod: 1,
        images: {
                mouth: `${ASSETS_BASE_URL}mouth/virus_mouth_v3.png`,
                eyes: `${ASSETS_BASE_URL}eyes/virus_eyes_v3.png`,
                hands: `${ASSETS_BASE_URL}hands/virus_hands_v3.png`
            }
    },
    {
        id: 'v4',
        name: 'Вирус-Забывака',
        infectivity: 40,
        incubationPeriod: 0,
        images: {
                mouth: `${ASSETS_BASE_URL}mouth/virus_mouth_v4.png`,
                eyes: `${ASSETS_BASE_URL}eyes/virus_eyes_v4.png`,
                hands: `${ASSETS_BASE_URL}hands/virus_hands_v4.png`
            }
    },
    {
        id: 'v5',
        name: 'Кибер-Чума',
        infectivity: 45,
        incubationPeriod: 1,
        images: {
                mouth: `${ASSETS_BASE_URL}mouth/virus_mouth_v5.png`,
                eyes: `${ASSETS_BASE_URL}eyes/virus_eyes_v5.png`,
                hands: `${ASSETS_BASE_URL}hands/virus_hands_v5.png`
            }
    },
    {
        id: 'v6',
        name: 'Пустотный Шепот',
        infectivity: 55,
        incubationPeriod: 2,
        images: {
                mouth: `${ASSETS_BASE_URL}mouth/virus_mouth_v6.png`,
                eyes: `${ASSETS_BASE_URL}eyes/virus_eyes_v6.png`,
                hands: `${ASSETS_BASE_URL}hands/virus_hands_v6.png`
            }
    }
];

const COMMON_IMAGES = {
    mouth: `${ASSETS_BASE_URL}mouth/common_mouth.png`,
    eyes: `${ASSETS_BASE_URL}eyes/common_eyes.png`,
    hands: `${ASSETS_BASE_URL}hands/common_hands.png`
};

const GAME_PHASES = ['day', 'voting', 'night'];
const PHASE_DURATION = 30000; // 30 секунд на фазу для тестирования

// Функция перемешивания массива (Fisher-Yates)
function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Функция распределения профессий и выбора зараженного
function startGame(lobby) {
    const shuffledProfessions = shuffle(PROFESSIONS).slice(0, lobby.players.length);
    const shuffledViruses = shuffle(VIRUSES);
    const infectedIndex = Math.floor(Math.random() * lobby.players.length);
    const selectedVirus = shuffledViruses[0];
    
    lobby.currentRound = 1;
    lobby.currentPhase = 'day';
    lobby.phaseStartTime = Date.now();
    lobby.votes = {};
    lobby.quarantinedPlayers = [];
    
    lobby.players.forEach((player, index) => {
        player.profession = shuffledProfessions[index];
        player.isInfected = index === infectedIndex;
        player.virus = index === infectedIndex ? selectedVirus : null;
        player.virusLevel = index === infectedIndex ? 1 : 0;
        player.actionUsed = false;
        player.isQuarantined = false;
        player.interactedWith = [];
    });
    
    lobby.status = 'playing';
    return lobby;
}

// Функция смены фазы игры
function nextPhase(lobby) {
    const phases = GAME_PHASES;
    const currentPhaseIndex = phases.indexOf(lobby.currentPhase);
    const nextPhaseIndex = (currentPhaseIndex + 1) % phases.length;
    
    // Если переходим с ночи на день - начинается новый раунд
    if (lobby.currentPhase === 'night') {
        lobby.currentRound++;
        if (lobby.currentRound > TOTAL_ROUNDS) {
            return 'game_end';
        }
    }
    
    lobby.currentPhase = phases[nextPhaseIndex];
    lobby.phaseStartTime = Date.now();
    
    if (lobby.currentPhase === 'voting') {
        // Очищаем голоса в начале фазы голосования
        lobby.votes = {};
    } else if (lobby.currentPhase === 'day') {
        // Выход из карантина
        lobby.quarantinedPlayers = [];
        lobby.players.forEach(p => {
            p.actionUsed = false;
        });
    }
    
    return lobby.currentPhase;
}

// Функция обработки ночной фазы
function processNightPhase(lobby) {
    const infectedPlayer = lobby.players.find(p => p.isInfected);
    if (!infectedPlayer) return;
    
    // Увеличиваем уровень вируса
    infectedPlayer.virusLevel++;
    
    // Заражаем контактировавших с зараженным
    infectedPlayer.interactedWith.forEach(playerId => {
        const contactedPlayer = lobby.players.find(p => p.id === playerId);
        if (contactedPlayer && !contactedPlayer.isInfected) {
            const infectivityChance = infectedPlayer.virus.infectivity;
            const roll = Math.random() * 100;
            if (roll < infectivityChance) {
                contactedPlayer.isInfected = true;
                contactedPlayer.virus = infectedPlayer.virus;
                contactedPlayer.virusLevel = 1;
            }
        }
    });
    
    // Очищаем список контактов для следующего раунда
    infectedPlayer.interactedWith = [];
}

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
                    startGame(lobby);
                    lobby.players.forEach((p) => {
                        const playerSocket = io.sockets.sockets.get(p.id);
                        if (playerSocket) {
                            playerSocket.emit('game_start', { 
                                profession: p.profession,
                                currentPhase: lobby.currentPhase,
                                currentRound: lobby.currentRound,
                                lobby: { ...lobby, players: lobby.players.map(pl => ({ ...pl, isInfected: undefined, virus: undefined })) }
                            });
                        }
                    });
                    
                    // Запуск цикла фаз
                    startPhaseTimer(lobbyId, io, lobbies);
                } else {
                    io.to(lobbyId).emit('update_lobby', lobby);
                }
            }
        }
    });

    // Логика распуска лобби создателем
    socket.on('disband_lobby', ({ lobbyId }) => {
        const lobby = lobbies.get(lobbyId);
        if (lobby && lobby.players[0].id === socket.id) {
            // Уведомляем всех игроков, что лобби распущено
            io.to(lobbyId).emit('lobby_disbanded');
            // Удаляем лобби из списка
            lobbies.delete(lobbyId);
            // Отправляем обновленный список всем
            io.emit('lobby_list', Array.from(lobbies.values()));
        }
    });

    socket.on('disconnect', () => {
        console.log('Пользователь отключился');
        // Тут можно добавить логику удаления игрока из лобби при дисконнекте
    });

    // Голосование (фаза voting)
    socket.on('vote', ({ lobbyId, votedPlayerId }) => {
        const lobby = lobbies.get(lobbyId);
        if (!lobby || lobby.currentPhase !== 'voting') return;
        
        lobby.votes[socket.id] = votedPlayerId;
    });

    // Использование способности днем
    socket.on('use_ability', ({ lobbyId, targetPlayerId, abilityType }) => {
        const lobby = lobbies.get(lobbyId);
        if (!lobby || lobby.currentPhase !== 'day') return;
        
        const player = lobby.players.find(p => p.id === socket.id);
        if (!player || player.isQuarantined || player.actionUsed) return;
        
        player.actionUsed = true;
        player.interactedWith.push(targetPlayerId);
        
        io.to(lobbyId).emit('ability_used', {
            fromPlayerId: socket.id,
            targetPlayerId: targetPlayerId,
            abilityType: abilityType
        });
    });
});

// Функция управления таймером фаз
function startPhaseTimer(lobbyId, io, lobbies) {
    const phaseInterval = setInterval(() => {
        const lobby = lobbies.get(lobbyId);
        if (!lobby || lobby.status !== 'playing') {
            clearInterval(phaseInterval);
            return;
        }
        
        const nextPhaseOrEnd = nextPhase(lobby);
        
        if (nextPhaseOrEnd === 'game_end') {
            clearInterval(phaseInterval);
            // По окончанию всех раундов решаем победителя: если есть зараженные не на карантине - выигрывают зараженные
            const infected = lobby.players.filter(p => p.isInfected);
            const infectedNotQuarantined = infected.filter(p => !p.isQuarantined);
            const result = (infected.length > 0 && infectedNotQuarantined.length > 0) ? 'infected_win' : 'crew_win';
            const infectedPlayer = lobby.players.find(p => p.isInfected);
            const virus = infectedPlayer?.virus || null;
            io.to(lobbyId).emit('game_end', { result, virus });
            return;
        }

        // Если это переход в ночь - сначала применяем результаты голосования (карантин), затем обрабатываем ночь
        if (lobby.currentPhase === 'night') {
            if (lobby.votes && Object.keys(lobby.votes).length > 0) {
                const voteResults = {};
                Object.values(lobby.votes).forEach(votedId => {
                    voteResults[votedId] = (voteResults[votedId] || 0) + 1;
                });

                // Находим максимум голосов
                let maxVotes = 0;
                Object.values(voteResults).forEach(v => { if (v > maxVotes) maxVotes = v; });

                // Все игроки с количеством голосов === maxVotes идут в карантин (может быть несколько)
                const quarantinedIds = Object.entries(voteResults)
                    .filter(([id, v]) => v === maxVotes)
                    .map(([id]) => id);

                quarantinedIds.forEach(quId => {
                    const quarantinedPlayer = lobby.players.find(p => p.id === quId);
                    if (quarantinedPlayer && !quarantinedPlayer.isQuarantined) {
                        quarantinedPlayer.isQuarantined = true;
                        lobby.quarantinedPlayers.push(quId);
                    }
                });

                // После карантина — проверяем, не отправили ли в карантин всех зараженных
                const infectedPlayers = lobby.players.filter(p => p.isInfected);
                const infectedNotQuarantined = infectedPlayers.filter(p => !p.isQuarantined);
                if (infectedPlayers.length > 0 && infectedNotQuarantined.length === 0) {
                    clearInterval(phaseInterval);
                    lobby.status = 'finished';
                    const infectedPlayer = lobby.players.find(p => p.isInfected);
                    const virus = infectedPlayer?.virus || null;
                    io.to(lobbyId).emit('game_end', { result: 'crew_win', virus });
                    return;
                }
            }

            // Теперь ночная обработка вируса и заражений
            processNightPhase(lobby);

            // После ночи — если все игроки заражены, зараженные выигрывают
            if (lobby.players.every(p => p.isInfected)) {
                clearInterval(phaseInterval);
                lobby.status = 'finished';
                const infectedPlayer = lobby.players.find(p => p.isInfected);
                const virus = infectedPlayer?.virus || null;
                io.to(lobbyId).emit('game_end', { result: 'infected_win', virus });
                return;
            }
        }
        
        // Отправляем обновление фазы всем игрокам
        io.to(lobbyId).emit('phase_update', {
            currentPhase: lobby.currentPhase,
            currentRound: lobby.currentRound,
            players: lobby.players.map(pl => ({
                id: pl.id,
                name: pl.name,
                isQuarantined: pl.isQuarantined,
                virusLevel: pl.virusLevel
            }))
        });
    }, PHASE_DURATION);
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});