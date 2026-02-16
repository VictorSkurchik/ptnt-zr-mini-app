import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

// Конфигурация лобби
const MAX_PLAYERS = 6;
const MIN_PLAYERS = 3;

// URL твоего бэкенда на Render
const LOBBY_SERVER_URL = 'https://ptnt-zr-mini-app.onrender.com'; 

const socket = io(LOBBY_SERVER_URL, {
  transports: ['websocket'],
  secure: true
});

function App() {
  const [lobbies, setLobbies] = useState<any[]>([]);
  const [lobby, setLobby] = useState<any>(null);
  const [screen, setScreen] = useState<'MAIN' | 'LOBBY' | 'GAME'>('MAIN');
  const [isJoining, setIsJoining] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [playerProfession, setPlayerProfession] = useState<any>(null);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState<number>(1);
  const [result, setResult] = useState<string | null>(null);
  const [resultVirus, setResultVirus] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState<number>(0);
  const [checkingCrew, setCheckingCrew] = useState<boolean>(false);
  const [selectedCrewMember, setSelectedCrewMember] = useState<string | null>(null);
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<{ imagePath: string } | null>(null);
  const [hasSkipped, setHasSkipped] = useState<boolean>(false);
  const [votedPlayerId, setVotedPlayerId] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [isQuarantined, setIsQuarantined] = useState<boolean>(false);
  const [infectionWarning, setInfectionWarning] = useState<string | null>(null);
  const loadingMessages = [
    'Заливаем топливо в бак...',
    'Достаем реагенты...',
    'Калибруем датчики...',
    'Инициализируем атмосферные фильтры...',
    'Проверяем связь с модулем навигации...',
    'Подключаем силовые контуры...'
  ];

  const tg = window.Telegram?.WebApp;
  const user = tg?.initDataUnsafe?.user;

  // Данные игрока для отправки на сервер
  const userData = { 
    name: user?.first_name || 'Игрок',
    photo: user?.photo_url || null 
  };

  useEffect(() => {
    tg?.expand(); // Раскрываем приложение в TG

    socket.on('connect', () => setError(null));
    // при подключении скрываем экран загрузки (прогресс завершится раньше)
    socket.on('connect', () => {
      setProgress(100);
      setTimeout(() => setLoading(false), 600);
    });
    socket.on('connect_error', () => setError('Нет связи с сервером'));

    // Слушаем список всех доступных лобби
    socket.on('lobby_list', (list) => setLobbies(list));

    // Успешный вход или создание
    socket.on('join_success', (data) => {
      setLobby(data);
      setScreen('LOBBY');
      setIsJoining(false);
    });

    socket.on('lobby_created', (data) => {
      setLobby(data);
      setScreen('LOBBY');
      setIsJoining(false);
    });

    socket.on('update_lobby', (updated) => setLobby(updated));

    socket.on('kicked', () => {
      setScreen('MAIN');
      setLobby(null);
      alert('Вас исключили из лобби');
    });

    socket.on('lobby_disbanded', () => {
      setScreen('MAIN');
      setLobby(null);
      setPlayerProfession(null);
    });

    socket.on('game_start', (data: any) => {
      setLoading(false);
      setPlayerProfession(data.profession);
      setCurrentPhase(data.currentPhase);
      setCurrentRound(data.currentRound);
      setLobby(data.lobby);
      setScreen('GAME');
      setIsQuarantined(false);
      alert(`🚀 Игра начинается!\nТвоя профессия: ${data.profession.name}`);
    });

    // fake loading progress: запускаем при монтировании
    let progressInterval: any = null;
    let messageInterval: any = null;
    if (loading) {
      setProgress(0);
      const totalSeconds = 60; // ~1 minute
      const step = 100 / totalSeconds; // percent per second
      progressInterval = setInterval(() => {
        setProgress(prev => {
          const val = Math.min(100, +(prev + step).toFixed(2));
          if (val >= 100) {
            clearInterval(progressInterval);
            setTimeout(() => setLoading(false), 600);
          }
          return val;
        });
      }, 1000);

      // rotate messages every ~8 seconds
      messageInterval = setInterval(() => {
        setLoadingMessageIndex(i => (i + 1) % loadingMessages.length);
      }, 8000);
    }

    socket.on('phase_update', (data: any) => {
      setCurrentPhase(data.currentPhase);
      setCurrentRound(data.currentRound);
      const currentPlayer = data.players.find((p: any) => p.id === socket.id);
      setIsQuarantined(currentPlayer?.isQuarantined || false);
      setLobby((prevLobby: any) => ({
        ...prevLobby,
        players: prevLobby.players.map((p: any) => {
          const updated = data.players.find((u: any) => u.id === p.id);
          return updated ? { ...p, ...updated } : p;
        })
      }));
    });

    socket.on('game_end', (data: any) => {
      setResult(data.result);
      setResultVirus(data.virus);
      setScreen('RESULT' as any);
    });

    socket.on('check_crew_result', (data: any) => {
      setCheckResult(data);
      if (data.wasInfected) {
        setInfectionWarning('⚠️ Вы заразились при проверке!');
        setTimeout(() => setInfectionWarning(null), 5000);
      }
    });

    return () => {
      socket.off();
      if (progressInterval) clearInterval(progressInterval);
      if (messageInterval) clearInterval(messageInterval);
    };
  }, []);

  useEffect(() => {
    if (selectedBodyPart && selectedCrewMember && lobby?.id) {
      socket.emit('check_crew', {
        lobbyId: lobby.id,
        crewMemberId: selectedCrewMember,
        bodyPart: selectedBodyPart
      });
      setSelectedBodyPart(null);
    }
  }, [selectedBodyPart, selectedCrewMember, lobby?.id]);

  useEffect(() => {
    // Обнуляем состояние проверки при смене фазы
    if (currentPhase !== 'day') {
      setCheckingCrew(false);
      setSelectedCrewMember(null);
      setSelectedBodyPart(null);
      setCheckResult(null);
      setHasSkipped(false);
      setInfectionWarning(null);
    }
    // Обнуляем состояние голосования при смене фазы
    if (currentPhase !== 'voting') {
      setVotedPlayerId(null);
      setHasVoted(false);
    }
  }, [currentPhase]);

  const handleCreate = () => {
    if (isJoining) return;
    setIsJoining(true);
    socket.emit('create_lobby', userData);
  };

  const handleJoin = (lobbyId: string) => {
    if (isJoining) return;
    setIsJoining(true);
    socket.emit('join_lobby', { lobbyId, userData });
  };

  const handleBack = () => {
    if (isCreator && lobby?.id) {
      socket.emit('disband_lobby', { lobbyId: lobby.id });
    }
    setScreen('MAIN');
    setLobby(null);
  };

  const isCreator = lobby?.players[0]?.id === socket.id;

  // Фильтрация списка лобби
  const filteredLobbies = lobbies.filter(l => 
    l.id.includes(search.toUpperCase()) || l.creator.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-wrapper">
      <div className="content-centered">
        {loading && (
          <div className="loading-screen">
            <div className="loading-box">
              <div className="loading-title">mini-app загружается</div>
              <div className="loading-message">{loadingMessages[loadingMessageIndex]}</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="progress-percent">{Math.round(progress)}%</div>
            </div>
          </div>
        )}
        {error && <div className="error-badge">{error}</div>}

        {screen === 'MAIN' ? (
          <div className="fade-in">
            <h1 className="title">Доступные игры</h1>
            
            <input 
              type="text" 
              className="search-input"
              placeholder="Поиск по коду или имени..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="lobby-list">
              {filteredLobbies.length > 0 ? filteredLobbies.map(l => (
                <div key={l.id} className="lobby-card">
                  <div className="lobby-info">
                    <span className="lobby-id">#{l.id}</span>
                    <span className="lobby-creator">от {l.creator}</span>
                  </div>
                  <button 
                    className="join-btn"
                    disabled={isJoining || l.players.length >= MAX_PLAYERS}
                    onClick={() => handleJoin(l.id)}
                  >
                    {isJoining ? '...' : `${l.players.length}/${MAX_PLAYERS}`}
                  </button>
                </div>
              )) : <p className="empty-text">Лобби не найдены</p>}
            </div>

            <button className="primary-btn" onClick={handleCreate} disabled={isJoining}>
              {isJoining ? 'Создание...' : 'Создать новое лобби'}
            </button>
          </div>
        ) : screen === 'LOBBY' ? (
          <div className="fade-in full-height">
            <div className="lobby-header">
              <button className="back-link" onClick={() => handleBack()}>← Назад</button>
              <div className="header-info">
                <h2>Лобби #{lobby?.id}</h2>
                <span className="players-count">{lobby?.players.length}/{MAX_PLAYERS} игроков</span>
              </div>
            </div>

            <div className="players-grid">
              {lobby?.players.map((p: any) => (
                <div key={p.id} className={`player-card ${p.isReady ? 'ready' : ''}`}>
                  <div className="avatar-container">
                    {p.photo ? (
                      <img src={p.photo} alt="ava" className="avatar-img" />
                    ) : (
                      <div className="avatar-placeholder">{p.name[0]}</div>
                    )}
                    {p.isReady && <div className="ready-badge">✓</div>}
                  </div>
                  <span className="player-name">👨‍🚀 {p.name}</span>
                  
                  {isCreator && p.id !== socket.id && (
                    <button 
                      className="kick-btn" 
                      onClick={() => socket.emit('kick_player', { lobbyId: lobby.id, playerId: p.id })}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {/* Пустые слоты */}
              {[...Array(MAX_PLAYERS - (lobby?.players.length || 0))].map((_, i) => (
                <div key={i} className="player-card empty">
                </div>
              ))}
            </div>

            <div className="start-info">
              {lobby.players.length < MIN_PLAYERS ? (
                <p className="min-players-info">Нужно минимум {MIN_PLAYERS} игрока для старта (сейчас {lobby.players.length})</p>
              ) : null}
            </div>

            <button 
              className={`ready-action-btn ${lobby?.players.find((p:any) => p.id === socket.id)?.isReady ? 'is-ready' : ''}`}
              onClick={() => socket.emit('player_ready', { lobbyId: lobby.id })}
            >
              {lobby?.players.find((p:any) => p.id === socket.id)?.isReady ? 'Я НЕ ГОТОВ' : 'Я ГОТОВ!'}
            </button>
          </div>
        ) : screen === 'GAME' ? (
          <div className="fade-in full-height game-container">
            <div className="game-header">
              <h1 className="game-title">⚡ ФАЗА: {currentPhase === 'day' ? '☀️ ДЕНЬ' : currentPhase === 'voting' ? '🗳️ ГОЛОСОВАНИЕ' : '🌙 НОЧЬ'}</h1>
              <div className="game-meta">
                <span className="round-info">Раунд {currentRound}/6</span>
              </div>
            </div>

            {infectionWarning && (
              <div className="infection-warning">
                {infectionWarning}
              </div>
            )}

            <div className="profession-card">
              <div className="profession-label">Твоя профессия:</div>
              <div className="profession-name">{playerProfession?.name}</div>
            </div>

            {currentPhase === 'day' && (
              <div className="phase-action">
                {isQuarantined && (
                  <div className="quarantine-notice">
                    🚫 Вы находитесь в карантине. Вернетесь в игру на следующий день.
                  </div>
                )}
                <p className="phase-description">☀️ День - проверьте экипаж или пропустите</p>
                
                {isQuarantined ? (
                  <div className="quarantine-waiting">
                    <p>Ожидайте завершения раунда...</p>
                  </div>
                ) : !checkingCrew && !checkResult && !selectedCrewMember && (
                  <div className="day-actions">
                    <button 
                      className="primary-btn"
                      disabled={hasSkipped}
                      onClick={() => {
                        setHasSkipped(true);
                        socket.emit('skip_day', { lobbyId: lobby.id });
                      }}
                    >
                      {hasSkipped ? 'Вы пропустили день' : 'Пропустить день'}
                    </button>
                    <button 
                      className="secondary-btn"
                      onClick={() => setCheckingCrew(true)}
                    >
                      Проверить экипаж
                    </button>
                  </div>
                )}

                {checkingCrew && !selectedCrewMember && !checkResult && (
                  <div className="crew-selection">
                    <p className="selection-title">Выберите члена экипажа для проверки:</p>
                    <div className="crew-list">
                      {lobby?.players.filter((p: any) => p.id !== socket.id).map((p: any) => (
                        <button
                          key={p.id}
                          className="crew-btn"
                          onClick={() => setSelectedCrewMember(p.id)}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                    <button
                      className="cancel-btn"
                      onClick={() => {
                        setCheckingCrew(false);
                        setSelectedCrewMember(null);
                      }}
                    >
                      Отмена
                    </button>
                  </div>
                )}

                {selectedCrewMember && !checkResult && (
                  <div className="body-part-selection">
                    <p className="selection-title">Выберите часть тела для проверки:</p>
                    <div className="body-parts">
                      <button
                        className="part-btn"
                        onClick={() => setSelectedBodyPart('eyes')}
                      >
                        👁️ Глаза
                      </button>
                      <button
                        className="part-btn"
                        onClick={() => setSelectedBodyPart('hands')}
                      >
                        🖐️ Руки
                      </button>
                      <button
                        className="part-btn"
                        onClick={() => setSelectedBodyPart('mouth')}
                      >
                        👄 Рот
                      </button>
                    </div>
                    <button
                      className="cancel-btn"
                      onClick={() => {
                        setSelectedCrewMember(null);
                        setCheckingCrew(false);
                      }}
                    >
                      Назад
                    </button>
                  </div>
                )}

                {checkResult && (
                  <div className="check-result">
                    <p className="result-title">Результат сканирования:</p>
                    <img src={checkResult.imagePath} alt="scan" className="scan-image" />
                    <button
                      className="primary-btn"
                      onClick={() => {
                        setCheckResult(null);
                        setSelectedCrewMember(null);
                        setSelectedBodyPart(null);
                        setCheckingCrew(false);
                      }}
                    >
                      Закрыть
                    </button>
                  </div>
                )}
              </div>
            )}

            {currentPhase === 'voting' && (
              <div className="phase-action">
                <p className="phase-description">🗳️ Голосование - отправьте членов экипажа на карантин</p>
                {isQuarantined ? (
                  <div className="quarantine-notice">
                    🚫 Вы находитесь в карантине и не можете голосовать.
                  </div>
                ) : (
                  <>
                    <div className="vote-list">
                      {lobby?.players.filter((p: any) => p.id !== socket.id).map((p: any) => (
                        <button 
                          key={p.id}
                          className={`vote-btn ${votedPlayerId === p.id ? 'selected' : ''}`}
                          onClick={() => {
                            setVotedPlayerId(p.id);
                            socket.emit('vote', { lobbyId: lobby.id, votedPlayerId: p.id });
                            setHasVoted(true);
                          }}
                        >
                          {p.name}
                          {votedPlayerId === p.id && ' ✓'}
                        </button>
                      ))}
                    </div>
                    <button
                      className={`abstain-btn ${hasVoted && votedPlayerId === null ? 'selected' : ''}`}
                      onClick={() => {
                        setVotedPlayerId(null);
                        socket.emit('vote', { lobbyId: lobby.id, votedPlayerId: null });
                        setHasVoted(true);
                      }}
                    >
                      Воздержаться {hasVoted && votedPlayerId === null && '✓'}
                    </button>
                  </>
                )}
              </div>
            )}

            {currentPhase === 'night' && (
              <div className="phase-action">
                <p className="phase-description">🌙 Ночь - вирус развивается...</p>
                <p className="hint">Ждите начала нового дня</p>
              </div>
            )}

            <div className="game-info">
              <p>Игроков в игре: {lobby?.players.length}</p>
            </div>

            <button 
              className="secondary-btn"
              onClick={() => {
                setScreen('MAIN');
                setLobby(null);
                setPlayerProfession(null);
                setCurrentPhase(null);
              }}
            >
              Вернуться в главное меню
            </button>
          </div>
        ) : screen === 'RESULT' ? (
          <div className="fade-in full-height">
            <div className="lobby-header">
              <h2>{result === 'crew_win' ? 'Победа экипажа 🎉' : 'Поражение — вирус победил 💀'}</h2>
              <div className="header-info">
                <span className="players-count">Раунд {currentRound}/{6}</span>
              </div>
            </div>
            <div className="phase-action">
              <p className="phase-description">{result === 'crew_win' ? 'Все зараженные заключены в карантин — экипаж победил.' : 'Все зараженные остались на корабле — зараженным удалось победить.'}</p>
            </div>

            {resultVirus && (
              <div className="virus-report">
                <div className="virus-title">📋 Отчет о вирусе</div>
                <div className="virus-info">
                  <div className="virus-name">🦠 {resultVirus.name}</div>
                  <div className="virus-stat">
                    <span className="stat-label">Инфекционность:</span>
                    <span className="stat-value">{resultVirus.infectivity}%</span>
                  </div>
                  <div className="virus-stat">
                    <span className="stat-label">Период инкубации:</span>
                    <span className="stat-value">{resultVirus.incubationPeriod} дней</span>
                  </div>
                </div>
              </div>
            )}

            <button
              className="primary-btn"
              onClick={() => {
                setScreen('MAIN');
                setLobby(null);
                setPlayerProfession(null);
                setCurrentPhase(null);
                setResult(null);
                setResultVirus(null);
              }}
            >
              Вернуться в главное меню
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default App;