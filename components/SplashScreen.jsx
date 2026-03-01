'use client';

import { useState, useEffect } from 'react';

export default function SplashScreen() {
  const [isAppReady, setIsAppReady] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    // Verifica se você já abriu o app nesta sessão (para não irritar a cada F5)
    const hasSeenSplash = sessionStorage.getItem('patrao_splash_viewed');

    if (!hasSeenSplash) {
      setShowSplash(true);
      
      // TEMPO DE EXIBIÇÃO AUMENTADO PARA 4 SEGUNDOS (4000ms)
      const timer = setTimeout(() => {
        setShowSplash(false); // Inicia o fade-out (desaparecer)
        sessionStorage.setItem('patrao_splash_viewed', 'true');
        
        // Espera 500ms (tempo da transição CSS) antes de liberar o aplicativo
        setTimeout(() => setIsAppReady(true), 500);
      }, 4000); 

      return () => clearTimeout(timer);
    } else {
      // Se já estava com o app aberto, pula a tela de carregamento direto
      setIsAppReady(true);
    }
  }, []);

  if (isAppReady) return null;

  if (!showSplash) return <div style={{ position: 'fixed', inset: 0, backgroundColor: '#121212', zIndex: 99999 }}></div>;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: '#121212', zIndex: 99999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      opacity: showSplash ? 1 : 0, transition: 'opacity 0.5s ease-out'
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
          animation: fadeInUp 0.8s ease-out forwards;
        }
        .splash-subtitle {
          color: #0070f3; font-size: 0.9rem; margin-top: 0.5rem;
          text-transform: uppercase; letter-spacing: 3px; font-weight: bold;
          opacity: 0; 
          animation: fadeInUp 1s ease-out 0.3s forwards;
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