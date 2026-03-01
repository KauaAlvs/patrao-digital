'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';
import PageLoader from '../components/PageLoader'; // <-- NOVO LOADER PREMIUM AQUI

const swalDark = Swal.mixin({
  background: '#1e1e1e', color: '#ffffff', confirmButtonColor: '#0070f3', cancelButtonColor: '#444',
  customClass: { popup: 'border border-gray-700 rounded-xl' }
});

export default function Dashboard() {
  const [activities, setActivities] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overdueItems, setOverdueItems] = useState([]);
  const [managingItem, setManagingItem] = useState(null);
  const [greeting, setGreeting] = useState('Olá, Patrão!');

  useEffect(() => {
    fetchData();
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Bom dia, Kauã!');
    else if (hour < 18) setGreeting('Boa tarde, Kauã!');
    else setGreeting('Boa noite, Kauã!');
  }, []);

  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return date1.getDate() === date2.getDate() && date1.getMonth() === date2.getMonth() && date1.getFullYear() === date2.getFullYear();
  };

  const getSmartDeadline = (goal, baseDate = new Date()) => {
    const d = new Date(baseDate);
    const created = new Date(goal.created_at);
    d.setHours(23, 59, 59, 999);

    if (goal.frequency === 'once') return goal.deadline || goal.created_at;
    
    if (goal.frequency === 'weekly') {
      const day = d.getDay();
      let diffToFriday = day === 6 ? 6 : (day === 0 ? 5 : 5 - day);
      if (isSameDay(created, baseDate) && (created.getDay() === 0 || created.getDay() === 6)) diffToFriday += 7;
      d.setDate(d.getDate() + diffToFriday);
      return d.toISOString();
    }
    
    if (goal.frequency === 'monthly') {
      let lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      if (isSameDay(created, lastDay) && isSameDay(created, baseDate)) lastDay = new Date(d.getFullYear(), d.getMonth() + 2, 0);
      if (lastDay.getDay() === 6) lastDay.setDate(lastDay.getDate() - 1);
      if (lastDay.getDay() === 0) lastDay.setDate(lastDay.getDate() - 2);
      return lastDay.toISOString();
    }
  };

  async function fetchData() {
    setLoading(true);

    const { data: actData } = await supabase.from('activities').select(`*, contexts ( name, color_hex, type, logo_url )`).order('scheduled_for', { ascending: true });
    const { data: goalsData } = await supabase.from('goals').select(`*, contexts ( name, color_hex, type, logo_url )`).in('status', ['in_progress', 'completed']);

    const now = new Date();

    const processedGoals = (goalsData || []).map(g => ({
      ...g, itemType: 'goal', referenceDate: getSmartDeadline(g), isCompleted: g.status === 'completed'
    }));

    const processedActivities = (actData || []).map(a => ({
      ...a, itemType: 'activity', referenceDate: a.scheduled_for, isCompleted: a.status === 'done'
    }));

    const allItems = [...processedActivities, ...processedGoals];
    
    const overdue = allItems.filter(i => {
      if (i.isCompleted || i.status === 'canceled') return false;
      const d = new Date(i.referenceDate);
      const createdAt = new Date(i.created_at);
      if (i.itemType === 'activity') return d < now;
      return d < now && !isSameDay(createdAt, d);
    });

    setOverdueItems(overdue);
    setActivities(processedActivities);
    setGoals(processedGoals);
    setLoading(false);
  }

  async function handleCompleteItem(item) {
    if (item.itemType === 'activity') {
      await supabase.from('activities').update({ status: 'done' }).eq('id', item.id);
      swalDark.fire('Boa!', 'Atividade finalizada.', 'success');
    } else {
      const newAmount = (item.current_amount || 0) + 1;
      const isCompleted = newAmount >= item.target_amount;
      await supabase.from('goals').update({ current_amount: newAmount, status: isCompleted ? 'completed' : 'in_progress' }).eq('id', item.id);
      swalDark.fire('Boa!', isCompleted ? 'Meta atingida!' : 'Progresso registrado!', 'success');
    }
    setManagingItem(null);
    fetchData();
  }

  const now = new Date();
  const endOfToday = new Date(now).setHours(23,59,59,999);

  const todayItems = [...activities, ...goals]
    .filter(i => !i.isCompleted && isSameDay(i.referenceDate, now))
    .sort((a, b) => new Date(a.referenceDate) - new Date(b.referenceDate));

  const upcomingItems = [...activities, ...goals]
    .filter(i => !i.isCompleted && new Date(i.referenceDate) > endOfToday)
    .sort((a, b) => new Date(a.referenceDate) - new Date(b.referenceDate))
    .slice(0, 5);

  const ActionCard = ({ item, isOverdue }) => {
    const d = new Date(item.referenceDate);
    const borderColor = isOverdue ? '#ff4b4b' : (item.contexts?.color_hex || '#333');
    const badgeColor = item.itemType === 'goal' ? '#eab308' : '#0070f3';

    return (
      <div 
        onClick={() => setManagingItem(item)}
        className="action-card"
        style={{
          backgroundColor: '#1e1e1e', borderRadius: '16px', padding: '1.2rem', cursor: 'pointer',
          border: `1px solid ${isOverdue ? 'rgba(255, 75, 75, 0.3)' : '#2a2a2a'}`, borderLeft: `6px solid ${borderColor}`,
          display: 'flex', gap: '1rem', alignItems: 'center', position: 'relative', overflow: 'hidden'
        }}
      >
        <div style={{ width: '45px', height: '45px', backgroundColor: '#262626', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', padding: '5px' }}>
          {item.contexts?.logo_url ? <img src={item.contexts.logo_url} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: '1.2rem' }}>{item.itemType === 'goal' ? '🎯' : '📅'}</span>}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', backgroundColor: `${badgeColor}20`, color: badgeColor, textTransform: 'uppercase' }}>
              {item.itemType === 'goal' ? 'META' : 'ATIVIDADE'}
            </span>
            <span style={{ fontSize: '0.75rem', color: isOverdue ? '#ff4b4b' : '#888', fontWeight: isOverdue ? 'bold' : 'normal' }}>
              {isOverdue ? '⚠️ Atrasado' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </span>
          </div>
          <h4 style={{ margin: 0, color: '#fff', fontSize: '1.05rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</h4>
        </div>
      </div>
    );
  };

  // =======================================================
  // INOVAÇÃO: BLOCO DE CARREGAMENTO PREMIUM COM ANIMAÇÃO
  // =======================================================
  if (loading) return <PageLoader text="Sincronizando seu QG..." icon="🌍" />;

  return (
    <div style={{ paddingBottom: '100px' }}>
      <style>{`
        .action-card { transition: all 0.2s ease; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
        .action-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.4); border-color: #444; }
        
        .pulse-alert { animation: pulse 2s infinite; }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(255, 75, 75, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(255, 75, 75, 0); } 100% { box-shadow: 0 0 0 0 rgba(255, 75, 75, 0); } }

        @media (max-width: 768px) {
          .dash-stats-grid { grid-template-columns: 1fr 1fr !important; }
          .dash-stat-card.full-width { grid-column: span 2; }
          .action-card { padding: 1rem; }
        }
      `}</style>

      {/* HEADER PREMIUM DO DASHBOARD */}
      <div style={{ marginBottom: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <p style={{ margin: 0, color: '#0070f3', fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 style={{ margin: 0, fontSize: '2.2rem', color: '#fff' }}>{greeting}</h1>
        <p style={{ margin: 0, color: '#888', fontSize: '1rem' }}>Aqui está o resumo do seu QG hoje.</p>
      </div>

      {/* CARDS DE RESUMO (SNAPSHOTS) */}
      <div className="dash-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2.5rem' }}>
        <div className="dash-stat-card" style={{ backgroundColor: '#181818', padding: '1.5rem', borderRadius: '16px', border: '1px solid #333' }}>
          <p style={{ margin: '0 0 0.5rem 0', color: '#888', fontSize: '0.85rem', textTransform: 'uppercase' }}>Foco de Hoje</p>
          <h2 style={{ margin: 0, color: '#fff', fontSize: '2rem' }}>{todayItems.length}</h2>
        </div>
        <div className="dash-stat-card" style={{ backgroundColor: '#181818', padding: '1.5rem', borderRadius: '16px', border: '1px solid #333' }}>
          <p style={{ margin: '0 0 0.5rem 0', color: '#888', fontSize: '0.85rem', textTransform: 'uppercase' }}>Metas Ativas</p>
          <h2 style={{ margin: 0, color: '#eab308', fontSize: '2rem' }}>{goals.filter(g => !g.isCompleted).length}</h2>
        </div>
        <div className={`dash-stat-card ${overdueItems.length > 0 ? 'full-width pulse-alert' : ''}`} style={{ backgroundColor: overdueItems.length > 0 ? 'rgba(255, 75, 75, 0.1)' : '#181818', padding: '1.5rem', borderRadius: '16px', border: `1px solid ${overdueItems.length > 0 ? '#ff4b4b' : '#333'}` }}>
          <p style={{ margin: '0 0 0.5rem 0', color: overdueItems.length > 0 ? '#ff4b4b' : '#888', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: overdueItems.length > 0 ? 'bold' : 'normal' }}>Pendências Atrasadas</p>
          <h2 style={{ margin: 0, color: overdueItems.length > 0 ? '#ff4b4b' : '#fff', fontSize: '2rem' }}>{overdueItems.length}</h2>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        
        {/* COLUNA: FOCO DE HOJE E ATRASADOS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {overdueItems.length > 0 && (
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.2rem' }}>🚨</span>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>Requerem Atenção</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {overdueItems.map(item => <ActionCard key={`overdue-${item.id}`} item={item} isOverdue={true} />)}
              </div>
            </section>
          )}

          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.2rem' }}>⚡</span>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>Cronograma de Hoje</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {todayItems.length === 0 ? (
                <div style={{ padding: '2rem', backgroundColor: '#181818', borderRadius: '16px', textAlign: 'center', border: '1px dashed #333' }}>
                  <p style={{ color: '#666', margin: 0 }}>Você não tem atividades marcadas para hoje. Aproveite!</p>
                </div>
              ) : todayItems.map(item => <ActionCard key={`today-${item.id}`} item={item} isOverdue={false} />)}
            </div>
          </section>
        </div>

        {/* COLUNA: PRÓXIMOS DIAS E METAS GLOBAIS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🔭</span>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>Próximos Passos</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {upcomingItems.length === 0 ? (
                <p style={{ color: '#555' }}>Nenhum agendamento futuro.</p>
              ) : upcomingItems.map(item => <ActionCard key={`upcoming-${item.id}`} item={item} isOverdue={false} />)}
            </div>
          </section>

          <section style={{ backgroundColor: '#181818', borderRadius: '20px', padding: '1.5rem', border: '1px solid #333' }}>
            <h3 style={{ marginTop: 0, color: '#fff', marginBottom: '1.5rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>📊</span> Metas Ativas por Empresa</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {goals.filter(g => !g.isCompleted).length === 0 ? (
                <p style={{ color: '#555', textAlign: 'center' }}>Nenhuma meta em andamento.</p>
              ) : goals.filter(g => !g.isCompleted).map(goal => {
                const pct = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
                return (
                  <div key={goal.id} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ width: '40px', height: '40px', backgroundColor: '#262626', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: '4px' }}>
                      {goal.contexts?.logo_url ? <img src={goal.contexts.logo_url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="l" /> : <span>🎯</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                        <span style={{ color: '#eee', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>{goal.title}</span>
                        <span style={{ fontSize: '0.8rem', color: goal.contexts?.color_hex || '#0070f3', fontWeight: 'bold' }}>{pct}%</span>
                      </div>
                      <div style={{ width: '100%', backgroundColor: '#2a2a2a', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, backgroundColor: goal.contexts?.color_hex || '#0070f3', height: '100%', borderRadius: '6px', transition: 'width 0.5s ease-out' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

      </div>

      {/* MODAL DE CONCLUSÃO DE ITEM */}
      {managingItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#1e1e1e', borderRadius: '24px', padding: '2.5rem 2rem', width: '100%', maxWidth: '400px', border: '1px solid #333', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
             <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div style={{ width: '80px', height: '80px', margin: '0 auto 1.5rem', backgroundColor: '#262626', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '10px', boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.3)' }}>
                   {managingItem.contexts?.logo_url ? <img src={managingItem.contexts.logo_url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="l" /> : <span style={{ fontSize: '2.5rem' }}>{managingItem.itemType === 'goal' ? '🎯' : '📅'}</span>}
                </div>
                <span style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: '20px', backgroundColor: '#333', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
                  {managingItem.contexts?.name || 'Geral / Pessoal'}
                </span>
                <h3 style={{ color: '#fff', fontSize: '1.4rem', margin: '1rem 0 0 0', lineHeight: '1.3' }}>{managingItem.title}</h3>
             </div>
             
             <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               <button onClick={() => handleCompleteItem(managingItem)} style={{ width: '100%', padding: '1.2rem', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem', boxShadow: '0 4px 15px rgba(0, 112, 243, 0.4)' }}>
                 {managingItem.itemType === 'goal' ? '🎯 Registrar Progresso' : '✅ Marcar como Feito'}
               </button>
               <button onClick={() => setManagingItem(null)} style={{ width: '100%', padding: '1rem', backgroundColor: 'transparent', color: '#888', border: 'none', borderRadius: '14px', cursor: 'pointer', fontWeight: 'bold' }}>
                 Voltar para o painel
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}