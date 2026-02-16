import { useEffect, useRef, useState } from "react";
import Objectpool from "./utils/Objectpool";
import { sliceSound, explosionSound, bgMusic } from "./utils/sound";

import appleSrc from "./assets/apple.png";
import pineappleSrc from "./assets/pineapple.png";
import bombSrc from "./assets/bomb.png";
import watermelonSrc from "./assets/watermelon.png";
import bananaSrc from "./assets/banana.png";

/* ================= UTILS & PRELOAD ================= */
function preloadImages(sources) {
  return Promise.all(
    sources.map(src => new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(img); // FIX: Prevent production hangs if CDN image fails
      img.src = src;
      if (img.complete) resolve(img);   // FIX: Ensure cached images in production resolve instantly
    }))
  );
}

/* ================= PARTICLE SYSTEM ================= */
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.radius = Math.random() * 5 + 2;
    this.speedX = (Math.random() - 0.5) * 12;
    this.speedY = (Math.random() - 0.5) * 12;
    this.alpha = 1;
    this.gravity = 0.3;
  }
  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.speedY += this.gravity;
    this.alpha -= 0.015;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ================= SLASH EFFECT ================= */
class SlashEffect {
  constructor(points) {
    this.points = [...points];
    this.alpha = 1;
    this.width = 8;
  }
  update() {
    this.alpha -= 0.05;
    this.width *= 0.95;
  }
  draw(ctx) {
    if (this.points.length < 2) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    
    const gradient = ctx.createLinearGradient(
      this.points[0].x, this.points[0].y,
      this.points[this.points.length - 1].x, this.points[this.points.length - 1].y
    );
    gradient.addColorStop(0, "rgba(0, 240, 255, 0.8)");
    gradient.addColorStop(0.5, "rgba(138, 43, 226, 0.8)");
    gradient.addColorStop(1, "rgba(255, 20, 147, 0.8)");
    
    ctx.strokeStyle = gradient;
    ctx.lineWidth = this.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = 20;
    ctx.shadowColor = "rgba(138, 43, 226, 0.8)";
    
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    this.points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.restore();
  }
}

/* ================= REFINED GAME OBJECT ================= */
class GameObject {
  reset(type, width, height, fruitImages, bombImage) {
    this.type = type;
    this.radius = 80;
    this.x = Math.random() * (width - 160) + 80;
    this.y = height + 100;
    this.speedX = (Math.random() - 0.5) * 6;
    this.speedY = -18 - Math.random() * 6;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = (Math.random() - 0.5) * 8;
    this.sliced = false;
    this.opacity = 1;
    this.scale = 1;

    this.image = type === "fruit"
      ? fruitImages[Math.floor(Math.random() * fruitImages.length)]
      : bombImage;
  }

  update(gravity) {
    this.speedY += gravity;
    this.x += this.speedX;
    this.y += this.speedY;
    this.rotation += this.rotationSpeed;
    
    if (this.sliced) {
      this.scale *= 0.92;
      this.opacity *= 0.88;
    }
  }

  draw(ctx) {
    if (!this.image) return;
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.scale(this.scale, this.scale);
    
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;
    
    ctx.drawImage(this.image, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
    ctx.restore();
  }
}

/* ================= COMBO SYSTEM ================= */
class ComboDisplay {
  constructor() {
    this.combo = 0;
    this.lastHitTime = 0;
    this.displayAlpha = 0;
    this.scale = 1;
  }
  
  hit() {
    const now = Date.now();
    if (now - this.lastHitTime < 1000) {
      this.combo++;
    } else {
      this.combo = 1;
    }
    this.lastHitTime = now;
    this.displayAlpha = 1;
    this.scale = 1.5;
  }
  
  update() {
    if (Date.now() - this.lastHitTime > 1000) {
      this.combo = 0;
      this.displayAlpha *= 0.9;
    }
    this.scale = Math.max(1, this.scale * 0.95);
  }
  
  draw(ctx, width, height) {
    if (this.combo > 1 && this.displayAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = this.displayAlpha;
      ctx.font = `bold ${60 * this.scale}px 'Segoe UI', Arial, sans-serif`;
      ctx.fillStyle = "#FFD700";
      ctx.strokeStyle = "#FF6B35";
      ctx.lineWidth = 3;
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(255, 107, 53, 0.8)";
      ctx.shadowBlur = 20;
      
      const text = `${this.combo}x COMBO!`;
      ctx.strokeText(text, width / 2, height / 3);
      ctx.fillText(text, width / 2, height / 3);
      ctx.restore();
    }
  }
}

/* ================= MAIN COMPONENT ================= */
export default function Game({ restart }) {
  const canvasRef = useRef(null);
  const objectsRef = useRef([]);
  const particlesRef = useRef([]);
  const slashEffectsRef = useRef([]);
  const swipeRef = useRef([]);
  const drawingRef = useRef(false);
  const animationRef = useRef(null);
  const poolRef = useRef(null);
  const livesRef = useRef(3);
  const comboRef = useRef(new ComboDisplay());
  const isGameOverRef = useRef(false); // FIX: Reliable way to track Game Over

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [highScore, setHighScore] = useState(Number(localStorage.getItem("highScore")) || 0);
  const [showGameOver, setShowGameOver] = useState(false);

  useEffect(() => {
    let fruitImgs, bombImg;
    let spawnInterval; // FIX: Hoisted so cleanup function can access it

    async function init() {
      const [apple, pineapple, bomb, watermelon, banana] = await preloadImages([appleSrc, pineappleSrc, bombSrc, watermelonSrc, bananaSrc]);
      fruitImgs = [apple, pineapple, watermelon, banana];
      bombImg = bomb;
      startGame();
    }

    function startGame() {
      const canvas = canvasRef.current;
      if (!canvas) return; // Safeguard
      const ctx = canvas.getContext("2d");
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      bgMusic.play().catch(() => {});
      poolRef.current = new Objectpool(() => new GameObject());

      const spawnObject = () => {
        if (livesRef.current <= 0) return;
        const obj = poolRef.current.get();
        obj.reset(Math.random() < 0.85 ? "fruit" : "bomb", canvas.width, canvas.height, fruitImgs, bombImg);
        objectsRef.current.push(obj);
      };

      spawnInterval = setInterval(spawnObject, 1000); // FIX: Assigned to hoisted variable

      const animate = () => {
        // FIX: Update UI safely exactly once
        if (livesRef.current <= 0 && !isGameOverRef.current) {
          isGameOverRef.current = true;
          setShowGameOver(true);
        }

        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        grad.addColorStop(0, "#0f0c29");
        grad.addColorStop(0.5, "#302b63");
        grad.addColorStop(1, "#24243e");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
        ctx.lineWidth = 1;
        const gridSize = 50;
        for (let x = 0; x < canvas.width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }
        ctx.restore();

        for (let i = slashEffectsRef.current.length - 1; i >= 0; i--) {
          const slash = slashEffectsRef.current[i];
          slash.update();
          slash.draw(ctx);
          if (slash.alpha <= 0) slashEffectsRef.current.splice(i, 1);
        }

        if (swipeRef.current.length > 1) {
          ctx.save();
          const gradient = ctx.createLinearGradient(
            swipeRef.current[0].x, swipeRef.current[0].y,
            swipeRef.current[swipeRef.current.length - 1].x, 
            swipeRef.current[swipeRef.current.length - 1].y
          );
          gradient.addColorStop(0, "rgba(0, 240, 255, 0.9)");
          gradient.addColorStop(1, "rgba(255, 20, 147, 0.9)");
          
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 6;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.shadowBlur = 25;
          ctx.shadowColor = "rgba(0, 240, 255, 0.8)";
          
          ctx.beginPath();
          ctx.moveTo(swipeRef.current[0].x, swipeRef.current[0].y);
          swipeRef.current.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.stroke();
          ctx.restore();
        }

        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
          const p = particlesRef.current[i];
          p.update();
          p.draw(ctx);
          if (p.alpha <= 0) particlesRef.current.splice(i, 1);
        }

        for (let i = objectsRef.current.length - 1; i >= 0; i--) {
          const obj = objectsRef.current[i];
          obj.update(0.25);
          obj.draw(ctx);

          for (let p of swipeRef.current) {
            const dist = Math.hypot(obj.x - p.x, obj.y - p.y);
            if (dist < obj.radius && !obj.sliced) {
              obj.sliced = true;
              
              if (obj.type === "fruit") {
                sliceSound.currentTime = 0;
                sliceSound.play();
                
                comboRef.current.hit();
                const multiplier = Math.min(comboRef.current.combo, 5);
                
                setScore(s => {
                  const newScore = s + (1 * multiplier);
                  if (newScore > highScore) {
                    setHighScore(newScore);
                    localStorage.setItem("highScore", newScore);
                  }
                  return newScore;
                });
                
                const colors = ["#FF6B6B", "#4ECDC4", "#FFE66D", "#A8E6CF", "#FF8B94"];
                for(let k=0; k<20; k++) {
                  particlesRef.current.push(
                    new Particle(obj.x, obj.y, colors[Math.floor(Math.random() * colors.length)])
                  ); 
                }
              } else {
                explosionSound.play();
                livesRef.current = 0;
                setLives(0);
                
                for(let k=0; k<40; k++) {
                  particlesRef.current.push(new Particle(obj.x, obj.y, "#FF4444"));
                }
              }
            }
          }

          if (obj.y > canvas.height + 110 || (obj.sliced && obj.opacity < 0.1)) {
            if (obj.type === "fruit" && !obj.sliced && obj.y > canvas.height + 100) {
              livesRef.current = Math.max(livesRef.current - 1, 0);
              setLives(livesRef.current);
            }
            poolRef.current.release(obj);
            objectsRef.current.splice(i, 1);
          }
        }

        comboRef.current.update();
        comboRef.current.draw(ctx, canvas.width, canvas.height);

        // FIX: Always request the next frame! This allows the explosion 
        // particles to finish animating instead of instantly freezing the screen.
        animationRef.current = requestAnimationFrame(animate); 
      };

      animate();

      const handleMove = e => {
        const x = e.clientX || e.touches?.[0]?.clientX;
        const y = e.clientY || e.touches?.[0]?.clientY;
        
        if (drawingRef.current && x && y) {
          swipeRef.current.push({ x, y });
          if (swipeRef.current.length > 15) swipeRef.current.shift();
        }
      };
      
      const startDrawing = () => drawingRef.current = true;
      const stopDrawing = () => {
        if (swipeRef.current.length > 1) {
          slashEffectsRef.current.push(new SlashEffect(swipeRef.current));
        }
        drawingRef.current = false;
        swipeRef.current = [];
      };

      canvas.addEventListener("mousedown", startDrawing);
      canvas.addEventListener("mouseup", stopDrawing);
      canvas.addEventListener("mousemove", handleMove);
      canvas.addEventListener("touchstart", startDrawing);
      canvas.addEventListener("touchend", stopDrawing);
      canvas.addEventListener("touchmove", handleMove);
    }

    init();
    
    return () => {
      // FIX: Proper cleanup sequence
      clearInterval(spawnInterval); 
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []); // FIX: Removed showGameOver. We only want to init the engine ONCE.

  return (
    <>
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          overflow: hidden;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        canvas {
          display: block;
          cursor: none;
        }
        
        .ui {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          padding: 30px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          pointer-events: none;
          z-index: 10;
        }
        
        .stats-panel {
          background: rgba(15, 12, 41, 0.6);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 20px 30px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        
        .score-display {
          font-size: 48px;
          font-weight: 800;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 5px;
          letter-spacing: -1px;
        }
        
        .score-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          text-transform: uppercase;
          letter-spacing: 2px;
          font-weight: 600;
        }
        
        .lives-container {
          display: flex;
          gap: 8px;
          margin-top: 15px;
        }
        
        .heart {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          box-shadow: 0 4px 15px rgba(245, 87, 108, 0.4);
          animation: heartbeat 1.5s ease-in-out infinite;
        }
        
        .heart.lost {
          background: rgba(255, 255, 255, 0.1);
          box-shadow: none;
          animation: none;
        }
        
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        
        .high-score {
          background: rgba(15, 12, 41, 0.6);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 15px 25px;
          text-align: right;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        
        .high-score-value {
          font-size: 32px;
          font-weight: 700;
          color: #FFD700;
          text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
        }
        
        .high-score-label {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.6);
          text-transform: uppercase;
          letter-spacing: 2px;
          margin-top: 2px;
        }
        
        .game-over {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(15, 12, 41, 0.95);
          backdrop-filter: blur(30px);
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 30px;
          padding: 60px 80px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          pointer-events: auto;
          z-index: 100; /* FIX: Added z-index to ensure it sits above the canvas */
          animation: slideIn 0.5s ease-out;
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -60%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }
        
        .game-over h1 {
          font-size: 72px;
          font-weight: 900;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 20px;
          letter-spacing: -2px;
        }
        
        .final-score {
          font-size: 24px;
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 30px;
        }
        
        .final-score span {
          font-size: 48px;
          font-weight: 700;
          color: #667eea;
          display: block;
          margin-top: 10px;
        }
        
        button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 18px 50px;
          font-size: 20px;
          font-weight: 700;
          border-radius: 50px;
          cursor: pointer;
          pointer-events: auto;
          transition: all 0.3s ease;
          text-transform: uppercase;
          letter-spacing: 1px;
          box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
        }
        
        button:hover {
          transform: translateY(-3px);
          box-shadow: 0 15px 40px rgba(102, 126, 234, 0.6);
        }
        
        button:active {
          transform: translateY(-1px);
        }
      `}</style>
      
      <div className="ui">
        <div className="stats-panel">
          <div className="score-label">Score</div>
          <div className="score-display">{score}</div>
          <div className="lives-container">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`heart ${i >= lives ? 'lost' : ''}`}>
                {i < lives ? '❤️' : '🖤'}
              </div>
            ))}
          </div>
        </div>
        
        <div className="high-score">
          <div className="high-score-value">{highScore}</div>
          <div className="high-score-label">Best Score</div>
        </div>
      </div>
      
      {showGameOver && (
        <div className="game-over">
          <h1>GAME OVER</h1>
          <div className="final-score">
            Your Score
            <span>{score}</span>
          </div>
          <button onClick={restart}>Play Again</button>
        </div>
      )}
      
      <canvas ref={canvasRef} />
    </>
  );
}