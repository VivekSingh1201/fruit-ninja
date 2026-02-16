import { useState } from "react";
import Game from "./Game";

export default function App() {
  const [started, setStarted] = useState(false);
  const [gameKey, setGameKey] = useState(0);

  const handleRestart = () => {
    setGameKey(prev => prev + 1);
  };

  if (!started) {
    return (
      <div className="start-screen">
        <h1 style={{ fontSize: '4rem', marginBottom: '20px' }}>FRUIT NINJA PRO</h1>
        <button onClick={() => setStarted(true)}>Start Slicing</button>
      </div>
    );
  }

  return <Game key={gameKey} restart={handleRestart} />;
}