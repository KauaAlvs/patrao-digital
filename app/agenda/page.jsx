'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import DashboardHeader from '../../components/DashboardHeader';
import Swal from 'sweetalert2';

const swalDark = Swal.mixin({
  background: '#1e1e1e', color: '#ffffff', confirmButtonColor: '#0070f3', cancelButtonColor: '#444',
  customClass: { popup: 'border border-gray-700 rounded-xl' }
});

export default function AgendaPage() {
  const [rawActivities, setRawActivities] = useState([]); 
  const [rawGoals, setRawGoals] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState(null); 
  const [isDayModalOpen, setIsDayModalOpen] = useState(false); 
  const [managingItem, setManagingItem] = useState(null);

  const hasShownBossAlert = useRef(false);

  useEffect(() => {
    fetchData();
  }, []);

  const shouldReset = (goal, now) => {
    if (goal.goal_type !== 'routine') return false;
    const lastReset = new Date(goal.last_reset_date || goal.created_at);
    const rType = goal.routine_type || goal.frequency;

    if (rType === 'weekly') {
      const nextMonday = new Date(lastReset);
      nextMonday.setDate(lastReset.getDate() + ((1 + 7 - lastReset.getDay()) % 7 || 7));
      nextMonday.setHours(0,0,0,0);
      return now >= nextMonday;
    }
    if (rType === 'monthly') {
      const nextMonth = new Date(lastReset.getFullYear(), lastReset.getMonth() + 1, 1);
      nextMonth.setHours(0,0,0,0);
      return now >= nextMonth;
    }
    if (rType === 'specific_day' || rType === 'date_range') {
      const config = goal.routine_config || {};
      const resetDay = config.day || config.start_day || 1;
      let nextReset = new Date(lastReset.getFullYear(), lastReset.getMonth(), resetDay);
      if (lastReset.getDate() >= resetDay) nextReset.setMonth(nextReset.getMonth() + 1);
      nextReset.setHours(0,0,0,0);
      return now >= nextReset;
    }
    return false;
  };

  const processAutoResets = async (goalsList) => {
    const now = new Date();
    let hasUpdates = false;
    for (const g of goalsList) {
      if (shouldReset(g, now)) {
        await supabase.from('goals').update({ current_amount: 0, status: 'in_progress', last_reset_date: now.toISOString() }).eq('id', g.id);
        hasUpdates = true;
      }
    }
    return hasUpdates;
  };

  async function fetchData() {
    setLoading(true);
    const { data: activitiesData } = await supabase.from('activities').select(`*, contexts ( name, color_hex, type, logo_url )`).order('scheduled_for', { ascending: true });
    let { data: goalsData } = await supabase.from('goals').select(`*, contexts ( name, color_hex, type, logo_url )`).in('status', ['in_progress', 'completed']);

    const needsRefresh = await processAutoResets(goalsData || []);
    if (needsRefresh) {
      const { data: newGoalsData } = await supabase.from('goals').select(`*, contexts ( name, color_hex, type, logo_url )`).in('status', ['in_progress', 'completed']);
      goalsData = newGoalsData;
    }

    setRawActivities(activitiesData || []);
    setRawGoals(goalsData || []);
    setLoading(false);

    if (!hasShownBossAlert.current && ((activitiesData && activitiesData.length > 0) || (goalsData && goalsData.length > 0))) {
      const now = new Date();
      const nowTime = now.getTime();
      let bossMessages = [];

      (activitiesData || []).forEach(a => {
        if (a.status === 'pending') {
          const d = new Date(a.scheduled_for);
          if (d < now && !isSameDay(d, now)) bossMessages.push(`🚨 <b>${a.title}</b> (${a.contexts?.name || 'Pessoal'}) está ATRASADA!`);
          else if (isSameDay(d, now)) bossMessages.push(`⚡ <b>${a.title}</b> vence HOJE!`);
        }
      });

      (goalsData || []).forEach(g => {
        if (g.status === 'in_progress') {
          const cycle = getCycleForDate(g, now);
          if (!cycle) return;
          const start = cycle.start.getTime();
          const end = cycle.end.getTime();
          
          if (nowTime >= start && nowTime <= end) {
            const daysPassed = Math.floor((nowTime - start) / (1000 * 60 * 60 * 24));
            const daysLeft = Math.ceil((end - nowTime) / (1000 * 60 * 60 * 24));
            const ctxName = g.contexts?.name || 'Pessoal';

            if (daysLeft === 0) bossMessages.push(`⚠️ <b>${g.title}</b> (${ctxName}) termina HOJE! Corre pra fechar.`);
            else if (daysLeft <= 3 && daysLeft > 0) bossMessages.push(`⏳ <b>${g.title}</b> (${ctxName}): Faltam APENAS ${daysLeft} dias!`);
            else if (daysPassed > 0 && start !== end) bossMessages.push(`👀 <b>${g.title}</b> (${ctxName}): Já se passaram ${daysPassed} dias. Você tem mais ${daysLeft} dias de foco.`);
          } else if (nowTime > end && (g.goal_type === 'single' || g.routine_type === 'specific_day')) {
             bossMessages.push(`🔴 <b>${g.title}</b> estourou a data limite!`);
          }
        }
      });

      if (bossMessages.length > 0) {
        hasShownBossAlert.current = true;
        const listHtml = bossMessages.slice(0, 4).map(m => `<li style="margin-bottom: 12px; border-left: 3px solid #0070f3; padding-left: 10px; text-align: left; font-size: 0.95rem; color: #ccc;">${m}</li>`).join('');
        swalDark.fire({
          title: '📋 Visão do Patrão Digital',
          html: `<p style="color: #aaa; margin-bottom: 1rem; font-size: 0.9rem;">Panorama das suas urgências:</p><ul style="list-style: none; padding: 0;">${listHtml}</ul>`,
          icon: 'info', confirmButtonText: 'Vou dar prioridade 💪', confirmButtonColor: '#0070f3'
        });
      }
    }
  }

  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    const date1 = new Date(d1); const date2 = new Date(d2);
    return date1.getDate() === date2.getDate() && date1.getMonth() === date2.getMonth() && date1.getFullYear() === date2.getFullYear();
  };

  const getCycleForDate = (g, targetDate) => {
    const t = new Date(targetDate);
    let start, end;

    if (g.goal_type === 'single') {
      if (g.deadline) {
        const d = new Date(g.deadline);
        start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        end = new Date(start);
      } else {
        const c = new Date(g.created_at);
        start = new Date(c.getFullYear(), c.getMonth(), c.getDate());
        end = new Date(start);
      }
    } else {
      const rType = g.routine_type || g.frequency;
      if (rType === 'date_range') {
        const sDay = g.routine_config?.start_day || 1;
        const eDay = g.routine_config?.end_day || 30;
        start = new Date(t.getFullYear(), t.getMonth(), sDay);
        end = new Date(t.getFullYear(), t.getMonth(), eDay);
        if (sDay > eDay) {
          if (t.getDate() <= eDay) start.setMonth(start.getMonth() - 1);
          else end.setMonth(end.getMonth() + 1);
        }
      } 
      else if (rType === 'specific_day') {
        const day = g.routine_config?.day || 1;
        start = new Date(t.getFullYear(), t.getMonth(), day);
        end = new Date(t.getFullYear(), t.getMonth(), day);
      } 
      else if (rType === 'monthly') {
        start = new Date(t.getFullYear(), t.getMonth(), 1);
        end = new Date(t.getFullYear(), t.getMonth() + 1, 0);
      } 
      else if (rType === 'weekly') {
        const day = t.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        start = new Date(t.getFullYear(), t.getMonth(), t.getDate() + diffToMonday);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
      }
    }
    
    if (!start || !end) return null;
    start.setHours(0,0,0,0); end.setHours(23,59,59,999);

    const created = new Date(g.created_at);
    created.setHours(0,0,0,0);
    if (end.getTime() < created.getTime()) return null;
    return { start, end };
  };

  // === CÉREBRO DE PROJEÇÃO CORRIGIDO ===
  const getGoalForDay = (g, targetDate) => {
    const isWeekday = targetDate.getDay() >= 1 && targetDate.getDay() <= 5;
    if (g.goal_type === 'routine' && !isWeekday) return null;

    const cycle = getCycleForDate(g, targetDate);
    if (!cycle) return null;

    const tDateVal = targetDate.getTime();
    const startVal = cycle.start.getTime();
    const endVal = cycle.end.getTime();

    if (tDateVal >= startVal && tDateVal <= endVal) {
      let isCompletedForDay = false;
      let displayAmount = g.current_amount; // Assume o valor real do banco inicialmente

      if (g.goal_type === 'single') {
        isCompletedForDay = g.status === 'completed';
      } else {
        const activeCycle = getCycleForDate(g, new Date(g.last_reset_date || g.created_at));
        if (!activeCycle) return null;

        const cStart = cycle.start.getTime();
        const aStart = activeCycle.start.getTime();

        if (cStart === aStart) {
          // Estamos no ciclo atual: reflete exatamente o banco
          isCompletedForDay = g.status === 'completed';
        } else if (cStart > aStart) {
          // PROJEÇÃO DO FUTURO: O sistema zera visualmente a rotina para os próximos ciclos
          isCompletedForDay = false;
          displayAmount = 0; 
        } else {
          return null; // Omitir ciclos passados para não poluir a agenda
        }
      }
      return { ...g, itemType: 'goal', isCompleted: isCompletedForDay, current_amount: displayAmount, cycleStart: cycle.start, cycleEnd: cycle.end };
    }
    return null;
  };

  async function handleCompleteItem(item) {
    if (item.isCompleted) return;
    swalDark.fire({ title: 'Confirmar?', text: item.itemType === 'goal' ? 'Registrar +1 no progresso?' : 'Marcar como concluída?', icon: 'question', showCancelButton: true, confirmButtonText: 'Sim!' }).then(async (result) => {
      if (result.isConfirmed) {
        if (item.itemType === 'activity') {
          await supabase.from('activities').update({ status: 'done' }).eq('id', item.id);
        } else {
          const newAmount = (item.current_amount || 0) + 1;
          const isCompleted = newAmount >= item.target_amount;
          await supabase.from('goals').update({ current_amount: newAmount, status: isCompleted ? 'completed' : 'in_progress' }).eq('id', item.id);
        }
        setManagingItem(null);
        setIsDayModalOpen(false); 
        fetchData();
        swalDark.fire('Sucesso!', '', 'success');
      }
    });
  }

  async function handleDeleteItem(item) {
    swalDark.fire({ title: 'Remover?', text: 'Ação irreversível.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc3545', confirmButtonText: 'Excluir' }).then(async (result) => {
      if (result.isConfirmed) {
        const table = item.itemType === 'activity' ? 'activities' : 'goals';
        await supabase.from(table).delete().eq('id', item.id);
        setManagingItem(null);
        setIsDayModalOpen(false);
        fetchData();
      }
    });
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const calendarDays = Array.from({ length: firstDayOfMonth + daysInMonth }, (_, i) => i < firstDayOfMonth ? null : i - firstDayOfMonth + 1);

  let generalItems = [];
  rawActivities.filter(a => a.status === 'pending').forEach(a => generalItems.push({ ...a, itemType: 'activity', referenceDate: a.scheduled_for, isCompleted: false }));
  rawGoals.filter(g => g.status === 'in_progress').forEach(g => {
    const cycle = getCycleForDate(g, new Date());
    if (cycle) generalItems.push({ ...g, itemType: 'goal', referenceDate: cycle.end, isCompleted: false, cycleStart: cycle.start, cycleEnd: cycle.end });
  });
  generalItems.sort((a, b) => new Date(a.referenceDate) - new Date(b.referenceDate));

  let selectedDayItems = [];
  if (selectedDate) {
    rawActivities.forEach(a => {
      if (isSameDay(a.scheduled_for, selectedDate) && a.status !== 'canceled') {
        selectedDayItems.push({ ...a, itemType: 'activity', referenceDate: a.scheduled_for, isCompleted: a.status === 'done' });
      }
    });
    rawGoals.forEach(g => {
      const projectedGoal = getGoalForDay(g, selectedDate);
      if (projectedGoal) selectedDayItems.push({ ...projectedGoal, referenceDate: selectedDate });
    });
    selectedDayItems.sort((a, b) => new Date(a.referenceDate) - new Date(b.referenceDate));
  }

  const renderCard = (item) => {
    const pct = item.itemType === 'goal' ? Math.min(100, Math.round((item.current_amount / item.target_amount) * 100)) : 0;
    return (
      <div key={`${item.itemType}-${item.id}`} className="feed-card" onClick={() => setManagingItem(item)} style={{ 
          display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.2rem', backgroundColor: '#262626', borderRadius: '12px', cursor: 'pointer',
          borderTop: '1px solid transparent', borderRight: '1px solid transparent', borderBottom: '1px solid transparent',
          borderLeft: `5px solid ${item.isCompleted ? '#28a745' : (item.contexts?.color_hex || '#555')}`,
          borderStyle: item.itemType === 'goal' ? 'dashed' : 'solid', borderColor: item.itemType === 'goal' ? '#444' : 'transparent',
          opacity: item.isCompleted ? 0.6 : 1
        }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{ width: '40px', height: '40px', backgroundColor: '#1e1e1e', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', padding: '4px' }}>
            {item.contexts?.logo_url ? <img src={item.contexts.logo_url} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: item.isCompleted ? 'grayscale(100%)' : 'none' }} /> : <span style={{ fontSize: '1.2rem' }}>{item.itemType === 'goal' ? '🎯' : '📅'}</span>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', backgroundColor: item.isCompleted ? '#28a745' : (item.itemType === 'goal' ? '#eab308' : '#0070f3'), color: item.isCompleted ? '#fff' : '#000' }}>
                {item.isCompleted ? '✅ CONCLUÍDO' : (item.itemType === 'goal' ? 'META' : 'ATIVIDADE')}
              </span>
              <h4 style={{ margin: 0, color: '#fff', fontSize: '1rem', lineHeight: '1.2', textDecoration: item.isCompleted ? 'line-through' : 'none' }}>{item.title}</h4>
            </div>
            <p style={{ margin: 0, color: '#888', fontSize: '0.8rem' }}>{item.contexts?.name || 'Geral / Pessoal'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid #333' }}>
          <span style={{ fontSize: '0.75rem', color: '#aaa', backgroundColor: '#1a1a1a', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
            {item.itemType === 'activity' ? new Date(item.referenceDate).toLocaleDateString('pt-BR') : 
             item.goal_type === 'single' ? `⏳ Até ${new Date(item.cycleEnd).toLocaleDateString('pt-BR')}` :
             item.routine_type === 'specific_day' ? `📌 Todo dia ${new Date(item.cycleStart).getDate()}` :
             `🔄 ${new Date(item.cycleStart).getDate()}/${new Date(item.cycleStart).getMonth()+1} - ${new Date(item.cycleEnd).getDate()}/${new Date(item.cycleEnd).getMonth()+1}`
            }
          </span>
          {item.itemType === 'goal' && (
             <span style={{ fontSize: '0.8rem', color: item.isCompleted ? '#28a745' : '#eab308', fontWeight: 'bold' }}>
               {item.isCompleted ? 'Finalizada' : `${item.current_amount} / ${item.target_amount}`}
             </span>
          )}
        </div>
        {item.itemType === 'goal' && !item.isCompleted && (
          <div style={{ width: '100%', backgroundColor: '#1e1e1e', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, backgroundColor: item.contexts?.color_hex || '#eab308', height: '100%', transition: 'width 0.3s' }} />
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}><p style={{ color: '#a0a0a0' }}>Sincronizando Agenda...</p></div>;

  return (
    <div>
      <style>{`
        @keyframes pulse-animation { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(1.1); } 100% { opacity: 1; transform: scale(1); } }
        .pulsing-indicator { animation: pulse-animation 1.5s infinite; }
        .feed-card:hover { transform: translateY(-3px); box-shadow: 0 8px 15px rgba(0,0,0,0.4); border-color: #666 !important; }
        .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }
      `}</style>
      
      <DashboardHeader title="Minha Agenda" subtitle="Controle visual de compromissos. Clique nos dias para gerenciar." />
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        <section style={{ backgroundColor: '#1e1e1e', borderRadius: '12px', padding: '1.5rem', borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333', borderLeft: '1px solid #333' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>◀</button>
            <h2 style={{ color: '#fff', margin: 0, textTransform: 'capitalize' }}>{currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
            <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>▶</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', textAlign: 'center', marginBottom: '0.5rem', fontWeight: 'bold', color: '#888', fontSize: '0.9rem' }}>
            <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
            {calendarDays.map((day, index) => {
              if (day === null) return <div key={`empty-${index}`} style={{ padding: '1rem' }}></div>;
              const thisDate = new Date(year, month, day);
              const isToday = isSameDay(thisDate, new Date());
              
              const dayItems = [];
              rawActivities.forEach(a => { if (isSameDay(a.scheduled_for, thisDate) && a.status !== 'canceled') dayItems.push({ ...a, itemType: 'activity', isCompleted: a.status === 'done' }); });
              
              rawGoals.forEach(g => {
                const projectedGoal = getGoalForDay(g, thisDate);
                if (projectedGoal) dayItems.push(projectedGoal);
              });

              return (
                <div key={day} onClick={() => { setSelectedDate(thisDate); setIsDayModalOpen(true); }} style={{ 
                    backgroundColor: '#2d2d2d', borderRadius: '12px', padding: '0.5rem', minHeight: '85px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer',
                    borderTop: isToday ? '2px solid #0070f3' : '1px solid transparent',
                    borderRight: isToday ? '2px solid #0070f3' : '1px solid transparent',
                    borderBottom: isToday ? '2px solid #0070f3' : '1px solid transparent',
                    borderLeft: isToday ? '2px solid #0070f3' : '1px solid transparent',
                    transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#3d3d3d'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2d2d2d'}
                >
                  <span style={{ color: isToday ? '#0070f3' : '#fff', fontWeight: isToday ? 'bold' : 'normal', marginBottom: 'auto' }}>{day}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', marginTop: '4px' }}>
                    {dayItems.slice(0, 5).map(item => (
                      <div key={`${item.itemType}-${item.id}`} className={item.itemType === 'goal' && !item.isCompleted ? 'pulsing-indicator' : ''} style={{ 
                        width: item.itemType === 'goal' ? '14px' : '8px', height: item.itemType === 'goal' ? '4px' : '8px', borderRadius: item.itemType === 'goal' ? '2px' : '50%', 
                        backgroundColor: item.isCompleted ? '#28a745' : (item.contexts?.color_hex || (item.itemType === 'goal' ? '#eab308' : '#a0a0a0')), 
                        boxShadow: item.itemType === 'goal' && !item.isCompleted ? `0 0 6px ${item.contexts?.color_hex || '#eab308'}` : 'none' 
                      }} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section style={{ backgroundColor: '#1e1e1e', borderRadius: '16px', padding: '2rem', borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333', borderLeft: '1px solid #333' }}>
          <h3 style={{ color: '#fff', marginTop: 0, marginBottom: '1.5rem', borderBottom: '1px solid #333', paddingBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🌍 Visão Geral das Pendências
          </h3>
          <div className="cards-grid">
            {generalItems.map(renderCard)}
            {generalItems.length === 0 && <p style={{ color: '#555', gridColumn: '1 / -1', textAlign: 'center' }}>Tudo limpo! Nenhuma pendência correndo no fundo.</p>}
          </div>
        </section>
      </div>

      {isDayModalOpen && selectedDate && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#1e1e1e', borderRadius: '20px', padding: '2rem', width: '100%', maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto', borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333', borderLeft: '1px solid #333', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #333', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ color: '#fff', margin: 0, fontSize: '1.4rem' }}>📅 Foco do Dia</h3>
                <p style={{ color: '#0070f3', margin: '0.3rem 0 0 0', fontWeight: 'bold' }}>{selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
              <button onClick={() => setIsDayModalOpen(false)} style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {selectedDayItems.length > 0 ? selectedDayItems.map(renderCard) : (
                <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: '#262626', borderRadius: '12px', border: '2px dashed #444' }}>
                  <span style={{ fontSize: '3rem' }}>🏖️</span>
                  <p style={{ color: '#aaa', margin: '1rem 0 0 0', fontSize: '1.1rem' }}>Nenhuma meta ou atividade.</p>
                  <p style={{ color: '#666', fontSize: '0.9rem', margin: '0.5rem 0 0 0' }}>Sua agenda está livre neste dia.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {managingItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#1e1e1e', borderRadius: '20px', padding: '2.5rem', width: '100%', maxWidth: '550px', borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333', borderLeft: '1px solid #333' }}>
            
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: '80px', height: '80px', margin: '0 auto 1rem', backgroundColor: '#2d2d2d', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '10px' }}>
                {managingItem.contexts?.logo_url ? <img src={managingItem.contexts.logo_url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="logo" /> : <span style={{ fontSize: '2.2rem' }}>{managingItem.itemType === 'goal' ? '🎯' : '📅'}</span>}
              </div>
              <h3 style={{ color: '#fff', fontSize: '1.5rem', margin: 0, lineHeight: '1.3' }}>{managingItem.title}</h3>
              <p style={{ color: managingItem.contexts?.color_hex || '#888', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.8rem', marginTop: '0.5rem' }}>{managingItem.contexts?.name || 'Geral / Pessoal'}</p>
            </div>

            <div style={{ backgroundColor: '#262626', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', textAlign: 'left' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem', borderBottom: '1px solid #333', paddingBottom: '1rem' }}>
                <div>
                  <span style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase' }}>Status Atual</span>
                  <p style={{ color: managingItem.isCompleted ? '#28a745' : '#eab308', margin: '0.2rem 0 0 0', fontWeight: 'bold', fontSize: '0.9rem' }}>
                    {managingItem.isCompleted ? '✅ Concluído' : '⏳ Pendente'}
                  </p>
                </div>
                <div>
                  <span style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase' }}>Criado em</span>
                  <p style={{ color: '#fff', margin: '0.2rem 0 0 0', fontSize: '0.9rem' }}>
                    {new Date(managingItem.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                {managingItem.itemType === 'goal' && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase' }}>Tipo de Ciclo</span>
                    <p style={{ color: '#fff', margin: '0.2rem 0 0 0', fontSize: '0.9rem' }}>
                      {managingItem.goal_type === 'single' ? '🎯 Alvo Único' : '🔄 Rotina Recorrente'}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <span style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase' }}>Descrição / Detalhes</span>
                <p style={{ color: '#ccc', fontSize: '0.95rem', margin: '0.4rem 0 0 0', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                  {managingItem.description || 'Nenhum detalhe adicional foi informado.'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* TRAVA DO TEMPO: Bloqueia registro em rotinas futuras */}
              {!managingItem.isCompleted && (
                managingItem.itemType === 'goal' && managingItem.goal_type === 'routine' && managingItem.cycleStart && managingItem.cycleStart.getTime() > new Date().getTime() ? (
                  <div style={{ padding: '1rem', backgroundColor: '#333', color: '#aaa', borderRadius: '12px', textAlign: 'center', fontSize: '0.9rem' }}>
                    ⏳ Esta rotina só poderá ser preenchida quando seu ciclo iniciar.
                  </div>
                ) : (
                  <button onClick={() => handleCompleteItem(managingItem)} style={{ padding: '1.2rem', backgroundColor: '#198754', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem' }}>
                    {managingItem.itemType === 'goal' ? '🎯 Registrar Progresso' : '✅ Marcar Concluída'}
                  </button>
                )
              )}

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => setManagingItem(null)} style={{ flex: 1, padding: '1rem', backgroundColor: 'transparent', color: '#aaa', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Voltar</button>
                <button onClick={() => handleDeleteItem(managingItem)} style={{ flex: 1, padding: '1rem', backgroundColor: 'transparent', color: '#dc3545', borderTop: '1px solid #dc3545', borderRight: '1px solid #dc3545', borderBottom: '1px solid #dc3545', borderLeft: '1px solid #dc3545', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>🗑 Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}