'use client';

export default function PageLoader({ text = "Carregando dados...", icon = "⏳" }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <style>{`
        .premium-loader-container { width: 240px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        .premium-loader-icon { font-size: 2.8rem; animation: float 3s ease-in-out infinite; margin-bottom: 0.5rem; }
        .premium-loader-text { color: #fff; font-size: 1.1rem; font-weight: 500; letter-spacing: 0.5px; animation: pulse-text 1.5s infinite; margin: 0; }
        
        .premium-progress-bg { width: 100%; height: 6px; background-color: #262626; border-radius: 10px; overflow: hidden; position: relative; box-shadow: inset 0 1px 3px rgba(0,0,0,0.5); }
        .premium-progress-bar { 
          position: absolute; top: 0; left: 0; height: 100%; width: 50%; 
          background: linear-gradient(90deg, transparent, #0070f3, transparent); 
          border-radius: 10px; animation: sweep 1.5s infinite ease-in-out; 
        }
        
        @keyframes sweep { 0% { left: -50%; } 100% { left: 100%; } }
        @keyframes pulse-text { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      `}</style>
      
      <div className="premium-loader-container">
        <div className="premium-loader-icon">{icon}</div>
        <h3 className="premium-loader-text">{text}</h3>
        <div className="premium-progress-bg">
          <div className="premium-progress-bar"></div>
        </div>
      </div>
    </div>
  );
}