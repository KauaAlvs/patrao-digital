'use client';

import DashboardHeader from '../../components/DashboardHeader';

export default function FeedPage() {
  return (
    <div>
      <DashboardHeader 
        title="Feed de Acontecimentos" 
        subtitle="Linha do tempo de todas as notas e atualizações." 
      />
      
      <div style={{ padding: '2rem', backgroundColor: '#1e1e1e', borderRadius: '12px', border: '1px solid #333' }}>
        <h2 style={{ color: '#fff', marginTop: 0 }}>Timeline</h2>
        <p style={{ color: '#a0a0a0' }}>
          Em breve: Histórico contínuo de anotações e atividades concluídas.
        </p>
      </div>
    </div>
  );
}