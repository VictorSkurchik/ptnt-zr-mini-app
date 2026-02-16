import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './App.css'; // Добавим стили ниже

// ВСТАВЬ СВОЮ ССЫЛКУ ИЗ LOCALTUNNEL ЗДЕСЬ
const LOBBY_SERVER_URL = 'https://ptnt-zr-mini-app.onrender.com'; 

const socket = io(LOBBY_SERVER_URL, {
  transports: ['websocket'], // Принудительно используем вебсокеты
  secure: true
});

function App() {
  const [lobbies, setLobbies] = useState<any[]>([]);
  const [lobby, setLobby] = useState<any>(null);
  const [screen, setScreen] = useState<'LIST' | 'LOBBY'>('LIST');
  const [search, setSearch] = useState('');
  const tg = window.Telegram?.WebApp;

  useEffect(() => {
    tg?.expand(); // Раскрываем на весь экран
    socket.on('lobby_list', (list) => setLobbies(list));
    socket.on('lobby_created', (data) => { setLobby(data); setScreen('LOBBY'); });
    socket.on('update_lobby', (data) => setLobby(data));
    socket.on('game_start', () => alert('🚀 ПОЕХАЛИ! Игра началась!'));

    return () => { socket.off(); };
  }, []);

  const userData = { name: tg?.initDataUnsafe?.user?.first_name || 'Игрок' };

  const filteredLobbies = lobbies.filter(l => 
    l.id.includes(search.toUpperCase()) || l.creator.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-container">
      {screen === 'LIST' ? (
        <div className="fade-in">
          <header>
            <h1>Игровые лобби</h1>
            <input 
              type="text" 
              placeholder="Поиск по коду или автору..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </header>

          <div className="lobby-list">
            {filteredLobbies.map(l => (
              <div key={l.id} className="lobby-card">
                <div>
                  <strong>#{l.id}</strong>
                  <p>Создатель: {l.creator}</p>
                </div>
                <div className="lobby-info">
                  <span>👤 {l.players.length}/4</span>
                  <button 
                    disabled={l.players.length >= 4}
                    onClick={() => socket.emit('join_lobby', { lobbyId: l.id, userData })}
                  >
                    Вход
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button className="main-button" onClick={() => socket.emit('create_lobby', userData)}>
            Создать новое лобби
          </button>
        </div>
      ) : (
        <div className="lobby-view fade-in">
          <button className="back-btn" onClick={() => setScreen('LIST')}>← Выйти</button>
          <h2>Лобби #{lobby?.id}</h2>
          
          <div className="players-grid">
            {lobby?.players.map((p: any) => (
              <div key={p.id} className={`player-slot ${p.isReady ? 'ready' : ''}`}>
                <div className="avatar">{p.name[0]}</div>
                <span>{p.name}</span>
                {p.isReady && <div className="ready-badge">ГОТОВ</div>}
              </div>
            ))}
            {[...Array(4 - (lobby?.players.length || 0))].map((_, i) => (
              <div key={i} className="player-slot empty">Свободно</div>
            ))}
          </div>

          <button className={`ready-btn ${lobby?.players.find((p:any) => p.id === socket.id)?.isReady ? 'is-ready' : ''}`}
            onClick={() => socket.emit('player_ready', { lobbyId: lobby.id })}>
            {lobby?.players.find((p:any) => p.id === socket.id)?.isReady ? 'Отменить готовность' : 'Я готов!'}
          </button>
        </div>
      )}
    </div>
  );
}

export default App;