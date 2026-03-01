'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import DashboardHeader from '../components/DashboardHeader';
import Swal from 'sweetalert2';

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

  useEffect(() => {
    fetchData();
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

    // Buscando atividades com logo_url do contexto
    const { data: actData } = await supabase
      .from('activities')
      .select(`*, contexts ( name, color_hex, type, logo_url )`)
      .order('scheduled_for', { ascending: true });

    // Buscando metas com logo_url do contexto
    const { data: goalsData } = await supabase
      .from('goals')
      .select(`*, contexts ( name, color_hex, type, logo_url )`)
      .in('status', ['in_progress', 'completed']);

    const now = new Date();

    const processedGoals = (goalsData || []).map(g => ({
      ...g,
      itemType: 'goal',
      referenceDate: getSmartDeadline(g),
      isCompleted: g.status === 'completed'
    }));

    const processedActivities = (actData || []).map(a => ({
      ...a,
      itemType: 'activity',
      referenceDate: a.scheduled_for,
      isCompleted: a.status === 'done'
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
  const startOfToday = new Date(now).setHours(0,0,0,0);
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
    return (
      <div 
        onClick={() => setManagingItem(item)}
        style={{
          backgroundColor: '#2d2d2d', borderRadius: '12px', padding: '1rem', cursor: 'pointer',
          borderLeft: `4px solid ${item.contexts?.color_hex || '#555'}`,
          borderTop: isOverdue ? '1px solid #dc3545' : '1px solid transparent',
          borderRight: isOverdue ? '1px solid #dc3545' : '1px solid transparent',
          borderBottom: isOverdue ? '1px solid #dc3545' : '1px solid transparent',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)', transition: 'all 0.1s', marginBottom: '0.8rem',
          display: 'flex', gap: '1rem', alignItems: 'center'
        }}
      >
        {/* LOGO NO CARD DO KANBAN */}
        <div style={{ width: '40px', height: '40px', backgroundColor: '#1e1e1e', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
          {item.contexts?.logo_url ? (
            <img src={item.contexts.logo_url} alt="l" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          ) : (
            <span style={{ fontSize: '1rem' }}>{item.itemType === 'goal' ? '🎯' : '📅'}</span>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
            <span style={{ fontSize: '0.6rem', padding: '1px 5px', borderRadius: '3px', fontWeight: 'bold', backgroundColor: item.itemType === 'goal' ? '#eab308' : '#0070f3', color: '#000' }}>
              {item.itemType === 'goal' ? 'META' : 'ATIV.'}
            </span>
            <span style={{ fontSize: '0.75rem', color: isOverdue ? '#ff6b6b' : '#888' }}>
              {isOverdue ? 'Atrasado' : d.toLocaleDateString('pt-BR')}
            </span>
          </div>
          <h4 style={{ margin: 0, color: '#fff', fontSize: '0.95rem', lineHeight: '1.2' }}>{item.title}</h4>
        </div>
      </div>
    );
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}><p style={{ color: '#a0a0a0' }}>Carregando QG...</p></div>;

  return (
    <div style={{ paddingBottom: '80px' }}>
      <DashboardHeader title="QG Central" subtitle="Seu panorama operacional e de entregas." />

      {overdueItems.length > 0 && (
        <div style={{ backgroundColor: 'rgba(220, 53, 69, 0.1)', borderTop: '1px solid #dc3545', borderRight: '1px solid #dc3545', borderBottom: '1px solid #dc3545', borderLeft: '1px solid #dc3545', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#ff6b6b' }}>⚠️ Alerta de Gargalo</h3>
          <p style={{ margin: 0, color: '#e0e0e0' }}>Você possui <strong>{overdueItems.length} pendências</strong> acumuladas.</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {overdueItems.length > 0 && (
          <section style={{ backgroundColor: '#1e1e1e', borderRadius: '12px', padding: '1.5rem', borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333', borderLeft: '1px solid #333' }}>
            <h3 style={{ marginTop: 0, color: '#ff6b6b', marginBottom: '1.2rem', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>🚨 Atrasados</h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>{overdueItems.map(item => <ActionCard key={item.id} item={item} isOverdue={true} />)}</div>
          </section>
        )}

        <section style={{ backgroundColor: '#1e1e1e', borderRadius: '12px', padding: '1.5rem', borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333', borderLeft: '1px solid #333' }}>
          <h3 style={{ marginTop: 0, color: '#fff', marginBottom: '1.2rem', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>⚡ Foco de Hoje</h3>
          {todayItems.length === 0 ? <p style={{ color: '#555' }}>Nada para hoje.</p> : todayItems.map(item => <ActionCard key={item.id} item={item} isOverdue={false} />)}
        </section>

        <section style={{ backgroundColor: '#1e1e1e', borderRadius: '12px', padding: '1.5rem', borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333', borderLeft: '1px solid #333' }}>
          <h3 style={{ marginTop: 0, color: '#a0a0a0', marginBottom: '1.2rem', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>🔭 No Radar</h3>
          {upcomingItems.map(item => <ActionCard key={item.id} item={item} isOverdue={false} />)}
        </section>
      </div>

      <section style={{ backgroundColor: '#1e1e1e', borderRadius: '12px', padding: '1.5rem', borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333', borderLeft: '1px solid #333', marginTop: '2rem' }}>
        <h3 style={{ marginTop: 0, color: '#fff', marginBottom: '1.5rem' }}>📊 Metas por Cliente</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {goals.filter(g => !g.isCompleted).map(goal => {
            const pct = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
            return (
              <div key={goal.id} style={{ padding: '1.2rem', backgroundColor: '#2d2d2d', borderRadius: '12px', borderLeft: `4px solid ${goal.contexts?.color_hex || '#555'}`, display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {/* LOGO NA SEÇÃO DE METAS */}
                <div style={{ width: '45px', height: '45px', backgroundColor: '#1e1e1e', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', padding: '4px' }}>
                  {goal.contexts?.logo_url ? <img src={goal.contexts.logo_url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="l" /> : <span>🎯</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#eee', fontSize: '0.95rem' }}>{goal.title}</h4>
                  <div style={{ width: '100%', backgroundColor: '#1a1a1a', borderRadius: '4px', height: '6px' }}>
                    <div style={{ width: `${pct}%`, backgroundColor: goal.contexts?.color_hex || '#0070f3', height: '100%', borderRadius: '4px' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                     <span style={{ fontSize: '0.7rem', color: '#888' }}>{goal.contexts?.name}</span>
                     <span style={{ fontSize: '0.7rem', color: goal.contexts?.color_hex || '#0070f3', fontWeight: 'bold' }}>{pct}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {managingItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#1e1e1e', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '450px', borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333', borderLeft: '1px solid #333' }}>
             <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <div style={{ width: '80px', height: '80px', margin: '0 auto 1rem', backgroundColor: '#2d2d2d', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '10px' }}>
                   {managingItem.contexts?.logo_url ? <img src={managingItem.contexts.logo_url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="l" /> : <span style={{ fontSize: '2rem' }}>{managingItem.itemType === 'goal' ? '🎯' : '📅'}</span>}
                </div>
                <h3 style={{ color: '#fff', fontSize: '1.4rem', margin: 0 }}>{managingItem.title}</h3>
                <p style={{ color: '#888', margin: '0.5rem 0 0 0' }}>{managingItem.contexts?.name}</p>
             </div>
             <button onClick={() => handleCompleteItem(managingItem)} style={{ width: '100%', padding: '1rem', backgroundColor: '#198754', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>
               {managingItem.itemType === 'goal' ? '🎯 Registrar +1' : '✅ Marcar Concluída'}
             </button>
             <button onClick={() => setManagingItem(null)} style={{ width: '100%', padding: '0.8rem', backgroundColor: 'transparent', color: '#aaa', border: '1px solid #444', borderRadius: '10px', marginTop: '0.8rem', cursor: 'pointer' }}>Voltar</button>
          </div>
        </div>
      )}
    </div>
  );
}