'use client';

import { useState, useEffect } from 'react';

export default function SplashScreen() {
  const [show, setShow] = useState(true);
  const [render, setRender] = useState(true);

  useEffect(() => {
    // Fica na tela por 2.5 segundos e depois começa a sumir
    const timer = setTimeout(() => {
      setShow(false);
      // Remove do código 500ms depois para liberar a memória
      setTimeout(() => setRender(false), 500);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  if (!render) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: '#121212', zIndex: 99999, // Fica por cima de TUDO
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      opacity: show ? 1 : 0, transition: 'opacity 0.5s ease-out', pointerEvents: 'none'
    }}>
      <style>{`
        .spinner {
          width: 45px; height: 45px;
          border: 4px solid rgba(0, 112, 243, 0.15);
          border-top-color: #0070f3;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-top: 2.5rem;
        }
        @keyframes spin { 
          0% { transform: rotate(0deg); } 
          100% { transform: rotate(360deg); } 
        }
        .splash-title {
          font-size: 2.2rem; color: #fff; margin: 0;
          letter-spacing: 1px; font-weight: bold;
          animation: fadeInUp 0.8s ease-out;
        }
        .splash-subtitle {
          color: #0070f3; font-size: 0.9rem; margin-top: 0.5rem;
          text-transform: uppercase; letter-spacing: 3px; font-weight: bold;
          animation: fadeInUp 1s ease-out;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      
      <h1 className="splash-title">Bem-vindo, Kauã!</h1>
      <p className="splash-subtitle">Patrão Digital</p>
      
      <div className="spinner"></div>
    </div>
  );
}