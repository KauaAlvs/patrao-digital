export default function DashboardHeader({ 
  title = "Meu Dashboard Pessoal", 
  subtitle = "Visão geral de metas, agendas e atividades." 
}) {
  return (
    <header style={{ marginBottom: '2rem', borderBottom: '1px solid #333', paddingBottom: '1rem' }}>
      <h1 style={{ margin: '0 0 0.5rem 0', color: '#ffffff' }}>{title}</h1>
      <p style={{ margin: 0, color: '#a0a0a0' }}>{subtitle}</p>
    </header>
  );
}