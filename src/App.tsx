import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// ВСТАВЬ СВОЮ ССЫЛКУ ИЗ LOCALTUNNEL ЗДЕСЬ
const LOBBY_SERVER_URL = 'https://ptnt-zr-backend.onrender.com'; 

const socket = io(LOBBY_SERVER_URL, {
  transports: ['websocket'], // Принудительно используем вебсокеты
  secure: true
});

function App() {
  const [lobby, setLobby] = useState<any>(null);
  const [screen, setScreen] = useState('MAIN');
  const [error, setError] = useState<string | null>(null);
  const tg = window.Telegram?.WebApp;

  useEffect(() => {
    socket.on('connect', () => {
      console.log('✅ Подключено к серверу!');
      setError(null);
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Ошибка сокета:', err.message);
      setError('Ошибка связи с сервером');
    });

    socket.on('lobby_created', (newLobby) => {
      setLobby(newLobby);
      setScreen('GAME_LOBBY');
    });

    socket.on('update_lobby', (updatedLobby) => {
      setLobby(updatedLobby);
    });

    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('lobby_created');
      socket.off('update_lobby');
    };
  }, []);

  const handleCreate = () => {
    const userData = { 
      name: tg?.initDataUnsafe?.user?.first_name || 'Liza' 
    };
    socket.emit('create_lobby', userData);
  };

  return (
    <div className="container">
      {error && <div className="error-badge">{error}</div>}
      
      {screen === 'MAIN' && (
        <div className="menu">
          <h1>Game Menu</h1>
          <button className="primary-btn" onClick={handleCreate}>Создать лобби</button>
        </div>
      )}

      {screen === 'GAME_LOBBY' && lobby && (
        <div className="lobby">
          <h2>Лобби: {lobby.id}</h2>
          <div className="player-list">
            {lobby.players.map((p: any) => (
              <div key={p.id} className="player-item">
                {p.name} {p.isReady ? '✅' : '⏳'}
              </div>
            ))}
          </div>
          <button onClick={() => socket.emit('player_ready', { lobbyId: lobby.id })}>
            Готов
          </button>
        </div>
      )}
    </div>
  );
}

export default App;