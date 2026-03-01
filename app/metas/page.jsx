'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import DashboardHeader from '../../components/DashboardHeader';
import Swal from 'sweetalert2';

const swalDark = Swal.mixin({
  background: '#1e1e1e', color: '#ffffff', confirmButtonColor: '#0070f3', cancelButtonColor: '#444',
  customClass: { popup: 'border border-gray-700 rounded-xl' }
});

export default function MetasPage() {
  const [goals, setGoals] = useState([]);
  const [contexts, setContexts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [goalType, setGoalType] = useState('routine');
  
  const [formData, setFormData] = useState({
    title: '', description: '', target_amount: 1, context_id: '', deadline: '',
    routine_type: 'weekly', specific_day: 15, start_day: 20, end_day: 30
  });

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
      return now >= nextMonth;
    }
    if (rType === 'specific_day' || rType === 'date_range') {
      const config = goal.routine_config || {};
      const resetDay = config.day || config.start_day || 1;
      let nextReset = new Date(lastReset.getFullYear(), lastReset.getMonth(), resetDay);
      if (lastReset.getDate() >= resetDay) nextReset.setMonth(nextReset.getMonth() + 1);
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
    const { data: ctxData } = await supabase.from('contexts').select('*').order('name');
    const { data: goalsData } = await supabase.from('goals').select(`*, contexts ( name, color_hex, logo_url )`).order('created_at', { ascending: false });

    const needsRefresh = await processAutoResets(goalsData || []);
    if (needsRefresh) {
      const { data: newGoalsData } = await supabase.from('goals').select(`*, contexts ( name, color_hex, logo_url )`).order('created_at', { ascending: false });
      setGoals(newGoalsData || []);
    } else {
      setGoals(goalsData || []);
    }
    
    setContexts(ctxData || []);
    setLoading(false);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    let routineConfig = null;
    let safeFrequency = 'once'; 

    if (goalType === 'routine') {
      if (formData.routine_type === 'specific_day') { routineConfig = { day: Number(formData.specific_day) }; safeFrequency = 'monthly'; } 
      else if (formData.routine_type === 'date_range') { routineConfig = { start_day: Number(formData.start_day), end_day: Number(formData.end_day) }; safeFrequency = 'monthly'; }
      else safeFrequency = formData.routine_type;
    }

    const payload = {
      title: formData.title, description: formData.description, target_amount: Number(formData.target_amount), current_amount: 0, context_id: formData.context_id || null, status: 'in_progress',
      goal_type: goalType, routine_type: goalType === 'routine' ? formData.routine_type : null, routine_config: routineConfig,
      deadline: goalType === 'single' && formData.deadline ? new Date(formData.deadline).toISOString() : null, last_reset_date: new Date().toISOString(), frequency: safeFrequency
    };

    const { error } = await supabase.from('goals').insert([payload]);

    if (!error) {
      swalDark.fire({ title: 'Meta Lançada!', icon: 'success', timer: 1000, showConfirmButton: false });
      setIsModalOpen(false);
      fetchData();
    } else swalDark.fire('Erro', error.message, 'error');
  };

  const handleUpdateProgress = async (goal, increment) => {
    const newAmount = Math.max(0, goal.current_amount + increment);
    const isCompleted = newAmount >= goal.target_amount;
    await supabase.from('goals').update({ current_amount: newAmount, status: isCompleted ? 'completed' : 'in_progress' }).eq('id', goal.id);
    if (isCompleted) swalDark.fire('Alvo Atingido!', 'Você bateu a meta deste ciclo! 🎯', 'success');
    fetchData();
  };

  const handleDelete = async (id) => {
    const res = await swalDark.fire({ title: 'Excluir Meta?', text: 'Remover definitivamente.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim' });
    if (res.isConfirmed) { await supabase.from('goals').delete().eq('id', id); fetchData(); }
  };

  const getBadgeInfo = (g) => {
    if (g.goal_type === 'single') return { text: g.deadline ? `⏳ Até ${new Date(g.deadline).toLocaleDateString()}` : '🎯 Alvo Único', col: '#eab308' };
    const r = g.routine_type || g.frequency;
    if (r === 'weekly') return { text: '📅 Semanal', col: '#0070f3' };
    if (r === 'monthly') return { text: '📆 Mensal', col: '#8b5cf6' };
    if (r === 'specific_day') return { text: `📌 Todo dia ${g.routine_config?.day}`, col: '#f97316' };
    if (r === 'date_range') return { text: `⏳ Dia ${g.routine_config?.start_day} ao ${g.routine_config?.end_day}`, col: '#ec4899' };
    return { text: '🔄 Rotina', col: '#0070f3' };
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}><p style={{ color: '#888' }}>Calculando ciclos...</p></div>;

  const activeGoals = goals.filter(g => g.status === 'in_progress');
  const completedGoals = goals.filter(g => g.status === 'completed');

  return (
    <div style={{ paddingBottom: '80px' }}>
      <DashboardHeader title="Central de Metas" subtitle="Gerencie seus alvos únicos e rotinas cíclicas." />
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
        <button onClick={() => { setFormData({ title: '', description: '', target_amount: 1, context_id: '', deadline: '', routine_type: 'weekly', specific_day: 15, start_day: 20, end_day: 30 }); setIsModalOpen(true); }} style={{ padding: '0.8rem 1.5rem', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0, 112, 243, 0.4)' }}>
          ➕ Estabelecer Nova Meta
        </button>
      </div>

      <h3 style={{ color: '#fff', borderBottom: '1px solid #333', paddingBottom: '0.8rem', marginBottom: '1.5rem' }}>🔥 Ciclo Atual (Em Andamento)</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        {activeGoals.length === 0 && <p style={{ color: '#666' }}>Nenhuma meta pendente neste ciclo.</p>}
        {activeGoals.map(g => {
          const badge = getBadgeInfo(g);
          const pct = Math.min(100, Math.round((g.current_amount / g.target_amount) * 100));
          return (
            <div key={g.id} style={{ backgroundColor: '#1e1e1e', borderRadius: '16px', padding: '1.5rem', borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333', borderLeft: `6px solid ${g.contexts?.color_hex || '#555'}`, position: 'relative' }}>
              <div style={{ position: 'absolute', top: '15px', right: '15px' }}><button onClick={() => handleDelete(g.id)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>🗑</button></div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                {g.contexts?.logo_url ? <img src={g.contexts.logo_url} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'contain', backgroundColor: '#262626' }} alt="" /> : <span style={{ fontSize: '2rem' }}>🎯</span>}
                <div>
                  <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: badge.col, color: '#fff', fontWeight: 'bold' }}>{badge.text}</span>
                  <h4 style={{ margin: '0.3rem 0 0 0', color: '#fff', fontSize: '1.1rem' }}>{g.title}</h4>
                </div>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#aaa', marginBottom: '0.4rem' }}><span>Progresso: {g.current_amount} de {g.target_amount}</span><span style={{ color: g.contexts?.color_hex || '#0070f3', fontWeight: 'bold' }}>{pct}%</span></div>
                <div style={{ width: '100%', backgroundColor: '#262626', height: '8px', borderRadius: '4px', overflow: 'hidden' }}><div style={{ width: `${pct}%`, backgroundColor: g.contexts?.color_hex || '#0070f3', height: '100%', transition: 'width 0.3s' }} /></div>
              </div>
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <button onClick={() => handleUpdateProgress(g, -1)} disabled={g.current_amount <= 0} style={{ padding: '0.8rem', backgroundColor: '#262626', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', flex: 1 }}>➖</button>
                <button onClick={() => handleUpdateProgress(g, 1)} style={{ padding: '0.8rem', backgroundColor: '#198754', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', flex: 3 }}>➕ Registrar</button>
              </div>
            </div>
          );
        })}
      </div>

      {completedGoals.length > 0 && (
        <>
          <h3 style={{ color: '#28a745', borderBottom: '1px solid #333', paddingBottom: '0.8rem', marginBottom: '1.5rem' }}>✅ Histórico & Aguardando Ciclo</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {completedGoals.map(g => {
              const badge = getBadgeInfo(g);
              return (
                <div key={g.id} style={{ backgroundColor: '#121212', borderRadius: '16px', padding: '1.5rem', borderTop: '1px dashed #333', borderRight: '1px dashed #333', borderBottom: '1px dashed #333', borderLeft: `6px solid #28a745`, opacity: 0.7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.65rem', color: '#888' }}>{badge.text}</span>
                    <button onClick={() => handleDelete(g.id)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer' }}>🗑</button>
                  </div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#aaa', textDecoration: 'line-through' }}>{g.title}</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>Entregue: {g.target_amount} / {g.target_amount}</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#1e1e1e', padding: '2rem', borderRadius: '20px', width: '100%', maxWidth: '500px', borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333', borderLeft: '1px solid #333' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ color: '#fff', margin: 0 }}>Nova Meta</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', backgroundColor: '#262626', borderRadius: '10px', padding: '0.4rem', marginBottom: '1.5rem' }}>
              <button type="button" onClick={() => setGoalType('single')} style={{ flex: 1, padding: '0.8rem', border: 'none', borderRadius: '8px', backgroundColor: goalType === 'single' ? '#0070f3' : 'transparent', color: goalType === 'single' ? '#fff' : '#888', fontWeight: 'bold', cursor: 'pointer' }}>🎯 Alvo Único</button>
              <button type="button" onClick={() => setGoalType('routine')} style={{ flex: 1, padding: '0.8rem', border: 'none', borderRadius: '8px', backgroundColor: goalType === 'routine' ? '#eab308' : 'transparent', color: goalType === 'routine' ? '#000' : '#888', fontWeight: 'bold', cursor: 'pointer' }}>🔄 Rotina Cíclica</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <input type="text" required placeholder="Ex: Fechar 3 novos contratos" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} style={{ width: '100%', padding: '1rem', backgroundColor: '#262626', color: '#fff', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '10px', outline: 'none' }} />
              
              <textarea placeholder="Descrição ou instruções para bater a meta..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} style={{ width: '100%', padding: '1rem', backgroundColor: '#262626', color: '#fff', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '10px', resize: 'vertical', minHeight: '80px', outline: 'none' }} />

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#aaa', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>Alvo Numérico:</label>
                  <input type="number" min="1" required value={formData.target_amount} onChange={(e) => setFormData({...formData, target_amount: e.target.value})} style={{ width: '100%', padding: '1rem', backgroundColor: '#262626', color: '#fff', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '10px', outline: 'none' }} />
                </div>
                
                {goalType === 'single' ? (
                  <div style={{ flex: 1 }}>
                    <label style={{ color: '#aaa', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>Data Limite (Opcional):</label>
                    <input type="date" value={formData.deadline} onChange={(e) => setFormData({...formData, deadline: e.target.value})} style={{ width: '100%', padding: '1rem', backgroundColor: '#262626', color: '#fff', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '10px', outline: 'none' }} />
                  </div>
                ) : (
                  <div style={{ flex: 1 }}>
                    <label style={{ color: '#aaa', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>Renovar a cada:</label>
                    <select value={formData.routine_type} onChange={(e) => setFormData({...formData, routine_type: e.target.value})} style={{ width: '100%', padding: '1rem', backgroundColor: '#262626', color: '#fff', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '10px', outline: 'none' }}>
                      <option value="weekly">Semana</option><option value="monthly">Mês</option><option value="specific_day">Dia Específico</option><option value="date_range">Período de Dias</option>
                    </select>
                  </div>
                )}
              </div>

              {goalType === 'routine' && formData.routine_type === 'specific_day' && (
                <div><label style={{ color: '#aaa', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>Dia da renovação:</label><input type="number" min="1" max="31" value={formData.specific_day} onChange={(e) => setFormData({...formData, specific_day: e.target.value})} style={{ width: '100%', padding: '1rem', backgroundColor: '#262626', color: '#fff', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '10px', outline: 'none' }} /></div>
              )}
              {goalType === 'routine' && formData.routine_type === 'date_range' && (
                <div style={{ display: 'flex', gap: '1rem' }}><input type="number" placeholder="Início (ex: 20)" min="1" max="31" value={formData.start_day} onChange={(e) => setFormData({...formData, start_day: e.target.value})} style={{ flex: 1, padding: '1rem', backgroundColor: '#262626', color: '#fff', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '10px', outline: 'none' }} /><input type="number" placeholder="Fim (ex: 30)" min="1" max="31" value={formData.end_day} onChange={(e) => setFormData({...formData, end_day: e.target.value})} style={{ flex: 1, padding: '1rem', backgroundColor: '#262626', color: '#fff', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '10px', outline: 'none' }} /></div>
              )}

              <div>
                <label style={{ color: '#aaa', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>Empresa/Cliente (Opcional):</label>
                <select value={formData.context_id} onChange={(e) => setFormData({...formData, context_id: e.target.value})} style={{ width: '100%', padding: '1rem', backgroundColor: '#262626', color: '#fff', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '10px', outline: 'none' }}>
                  <option value="">📁 Geral / Pessoal</option>
                  {contexts.map(ctx => <option key={ctx.id} value={ctx.id}>🏢 {ctx.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '1rem', backgroundColor: 'transparent', color: '#888', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '10px' }}>Cancelar</button>
                <button type="submit" style={{ flex: 2, padding: '1rem', backgroundColor: goalType === 'single' ? '#0070f3' : '#eab308', color: goalType === 'single' ? '#fff' : '#000', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>Gerar Meta</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}