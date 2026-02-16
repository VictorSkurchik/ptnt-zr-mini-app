import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css';

// URL твоего бэкенда на Render
const LOBBY_SERVER_URL = 'https://ptnt-zr-mini-app.onrender.com'; 

const socket = io(LOBBY_SERVER_URL, {
  transports: ['websocket'],
  secure: true
});

function App() {
  const [lobbies, setLobbies] = useState<any[]>([]);
  const [lobby, setLobby] = useState<any>(null);
  const [screen, setScreen] = useState<'MAIN' | 'LOBBY'>('MAIN');
  const [isJoining, setIsJoining] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

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

    socket.on('game_start', () => alert('🚀 Игра начинается!'));

    return () => {
      socket.off();
    };
  }, []);

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

  const isCreator = lobby?.players[0]?.id === socket.id;

  // Фильтрация списка лобби
  const filteredLobbies = lobbies.filter(l => 
    l.id.includes(search.toUpperCase()) || l.creator.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-wrapper">
      <div className="content-centered">
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
                    disabled={isJoining || l.players.length >= 4}
                    onClick={() => handleJoin(l.id)}
                  >
                    {isJoining ? '...' : `${l.players.length}/4`}
                  </button>
                </div>
              )) : <p className="empty-text">Лобби не найдены</p>}
            </div>

            <button className="primary-btn" onClick={handleCreate} disabled={isJoining}>
              {isJoining ? 'Создание...' : 'Создать новое лобби'}
            </button>
          </div>
        ) : (
          <div className="fade-in full-height">
            <div className="lobby-header">
              <button className="back-link" onClick={() => setScreen('MAIN')}>← Назад</button>
              <h2>Лобби #{lobby?.id}</h2>
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
                  <span className="player-name">{p.name}</span>
                  
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
              {[...Array(4 - (lobby?.players.length || 0))].map((_, i) => (
                <div key={i} className="player-card empty">
                  <div className="avatar-placeholder">?</div>
                  <span className="player-name">Свободно</span>
                </div>
              ))}
            </div>

            <button 
              className={`ready-action-btn ${lobby?.players.find((p:any) => p.id === socket.id)?.isReady ? 'is-ready' : ''}`}
              onClick={() => socket.emit('player_ready', { lobbyId: lobby.id })}
            >
              {lobby?.players.find((p:any) => p.id === socket.id)?.isReady ? 'Я НЕ ГОТОВ' : 'Я ГОТОВ!'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;