'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import DashboardHeader from '../../components/DashboardHeader';
import Swal from 'sweetalert2';
import PageLoader from '../../components/PageLoader'; // <-- INOVAÇÃO AQUI

const swalDark = Swal.mixin({
  background: '#1e1e1e', color: '#ffffff', confirmButtonColor: '#0070f3', cancelButtonColor: '#444',
  customClass: { popup: 'border border-gray-700 rounded-xl' }
});

export default function MetasPage() {
  const [goals, setGoals] = useState([]);
  const [contexts, setContexts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados dos Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false); 
  
  const [editingGoal, setEditingGoal] = useState(null);
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

  const openCreateModal = () => {
    setEditingGoal(null);
    setGoalType('routine');
    setFormData({ title: '', description: '', target_amount: 1, context_id: '', deadline: '', routine_type: 'weekly', specific_day: 15, start_day: 20, end_day: 30 });
    setIsModalOpen(true);
  };

  const openEditModal = (goal) => {
    setEditingGoal(goal);
    setGoalType(goal.goal_type);
    
    const isSpecific = goal.routine_type === 'specific_day';
    const isRange = goal.routine_type === 'date_range';
    
    setFormData({
      title: goal.title, description: goal.description || '', target_amount: goal.target_amount, context_id: goal.context_id || '',
      deadline: goal.deadline ? goal.deadline.split('T')[0] : '', routine_type: goal.routine_type || 'weekly',
      specific_day: isSpecific && goal.routine_config ? goal.routine_config.day : 15,
      start_day: isRange && goal.routine_config ? goal.routine_config.start_day : 20, end_day: isRange && goal.routine_config ? goal.routine_config.end_day : 30
    });
    setIsModalOpen(true);
  };

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
      title: formData.title, description: formData.description, target_amount: Number(formData.target_amount), context_id: formData.context_id || null,
      goal_type: goalType, routine_type: goalType === 'routine' ? formData.routine_type : null, routine_config: routineConfig,
      deadline: goalType === 'single' && formData.deadline ? new Date(formData.deadline).toISOString() : null, frequency: safeFrequency
    };

    let error;
    if (editingGoal) {
      const { error: updateErr } = await supabase.from('goals').update(payload).eq('id', editingGoal.id);
      error = updateErr;
    } else {
      payload.current_amount = 0;
      payload.status = 'in_progress';
      payload.last_reset_date = new Date().toISOString();
      const { error: insertErr } = await supabase.from('goals').insert([payload]);
      error = insertErr;
    }

    if (!error) {
      swalDark.fire({ title: editingGoal ? 'Meta Atualizada!' : 'Meta Lançada!', icon: 'success', timer: 1000, showConfirmButton: false });
      setIsModalOpen(false);
      fetchData();
    } else swalDark.fire('Erro', error.message, 'error');
  };

  const handleUpdateProgress = async (goal, increment) => {
    const newAmount = Math.max(0, goal.current_amount + increment);
    const isCompleted = newAmount >= goal.target_amount;
    await supabase.from('goals').update({ current_amount: newAmount, status: isCompleted ? 'completed' : 'in_progress' }).eq('id', goal.id);
    
    if (isCompleted && increment > 0) swalDark.fire('Alvo Atingido!', 'Você bateu a meta deste ciclo! 🎯', 'success');
    fetchData();
  };

  const handleDelete = async (id) => {
    const res = await swalDark.fire({ title: 'Excluir Meta?', text: 'Remover definitivamente.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sim' });
    if (res.isConfirmed) { await supabase.from('goals').delete().eq('id', id); fetchData(); }
  };

  const getRoutineRuleText = () => {
    if (formData.routine_type === 'weekly') return 'Semanal';
    if (formData.routine_type === 'monthly') return 'Mensal';
    if (formData.routine_type === 'specific_day') return `Dia ${formData.specific_day}`;
    if (formData.routine_type === 'date_range') return `Dias ${formData.start_day} a ${formData.end_day}`;
    return 'Configurar';
  };

  const getBadgeInfo = (g) => {
    if (g.goal_type === 'single') return { text: g.deadline ? `⏳ Até ${new Date(g.deadline).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}` : '🎯 Alvo Único', col: '#eab308' };
    const r = g.routine_type || g.frequency;
    if (r === 'weekly') return { text: '📅 Semanal', col: '#0070f3' };
    if (r === 'monthly') return { text: '📆 Mensal', col: '#8b5cf6' };
    if (r === 'specific_day') return { text: `📌 Todo dia ${g.routine_config?.day}`, col: '#f97316' };
    if (r === 'date_range') return { text: `⏳ Dia ${g.routine_config?.start_day} ao ${g.routine_config?.end_day}`, col: '#ec4899' };
    return { text: '🔄 Rotina', col: '#0070f3' };
  };

  // =======================================================
  // INOVAÇÃO: BLOCO DE CARREGAMENTO PREMIUM COM ANIMAÇÃO
  // =======================================================
  if (loading) return <PageLoader text="Apurando Ciclos de Metas..." icon="🎯" />;

  const activeGoals = goals.filter(g => g.status === 'in_progress');
  const cycleCompletedGoals = goals.filter(g => g.status === 'completed' && g.goal_type === 'routine'); 
  const finishedSingleGoals = goals.filter(g => g.status === 'completed' && g.goal_type === 'single'); 

  return (
    <div style={{ paddingBottom: '80px' }}>
      
      <style>{`
        .meta-input { width: 100%; padding: 1rem; background-color: #262626; color: #fff; border: 1px solid #444; border-radius: 10px; outline: none; }
        .meta-input-mini { width: 90px; padding: 1rem; background-color: #262626; color: #fff; border: 1px solid #444; border-radius: 10px; outline: none; text-align: center; }
        .row-flex { display: flex; gap: 1rem; align-items: flex-end; }
        .meta-modal-box { background-color: #1e1e1e; padding: 2.5rem; border-radius: 20px; width: 100%; max-width: 500px; border: 1px solid #333; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
        .config-modal-box { background-color: #2a2a2a; padding: 1.5rem; border-radius: 16px; width: 100%; max-width: 350px; border: 1px solid #444; box-shadow: 0 20px 40px rgba(0,0,0,0.8); }

        @media (max-width: 768px) {
          .meta-modal-box { padding: 1.5rem; max-height: 90vh; overflow-y: auto; }
          .row-flex { gap: 0.5rem; flex-wrap: wrap; }
          .meta-input-mini { width: 70px; padding: 0.8rem; }
          .meta-input { padding: 0.8rem; }
        }
      `}</style>

      <DashboardHeader title="Central de Metas" subtitle="Gerencie seus alvos únicos e rotinas cíclicas." />
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
        <button onClick={openCreateModal} style={{ padding: '0.8rem 1.5rem', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0, 112, 243, 0.4)' }}>
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
              <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => openEditModal(g)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '4px', padding: '5px' }}>✏️</button>
                <button onClick={() => handleDelete(g.id)} style={{ background: 'rgba(255,0,0,0.1)', border: 'none', color: '#ff4444', cursor: 'pointer', borderRadius: '4px', padding: '5px' }}>🗑</button>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', paddingRight: '50px' }}>
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

      {cycleCompletedGoals.length > 0 && (
        <>
          <h3 style={{ color: '#10b981', borderBottom: '1px solid #333', paddingBottom: '0.8rem', marginBottom: '1.5rem', marginTop: '2rem' }}>🏆 Rotinas Batidas (Aguardando Renovação)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
            {cycleCompletedGoals.map(g => {
              const badge = getBadgeInfo(g);
              return (
                <div key={g.id} style={{ backgroundColor: '#121212', borderRadius: '16px', padding: '1.5rem', border: '1px solid #10b981', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleUpdateProgress(g, -1)} title="Desfazer conclusão" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '4px', padding: '5px' }}>↩️</button>
                    <button onClick={() => handleDelete(g.id)} style={{ background: 'rgba(255,0,0,0.1)', border: 'none', color: '#ff4444', cursor: 'pointer', borderRadius: '4px', padding: '5px' }}>🗑</button>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '2rem' }}>🎉</span>
                    <div>
                      <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: badge.col, color: '#fff', fontWeight: 'bold' }}>{badge.text}</span>
                      <h4 style={{ margin: '0.3rem 0 0 0', color: '#10b981', fontSize: '1.1rem' }}>{g.title}</h4>
                    </div>
                  </div>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#aaa' }}>Alvo de {g.target_amount} atingido! Voltará ao ciclo na próxima renovação.</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {finishedSingleGoals.length > 0 && (
        <>
          <h3 style={{ color: '#888', borderBottom: '1px solid #333', paddingBottom: '0.8rem', marginBottom: '1.5rem', marginTop: '2rem' }}>📁 Histórico (Metas Únicas)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {finishedSingleGoals.map(g => {
              const badge = getBadgeInfo(g);
              return (
                <div key={g.id} style={{ backgroundColor: '#121212', borderRadius: '16px', padding: '1.5rem', borderTop: '1px dashed #333', borderRight: '1px dashed #333', borderBottom: '1px dashed #333', borderLeft: `6px solid #444`, opacity: 0.6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.65rem', color: '#666' }}>{badge.text}</span>
                    <button onClick={() => handleDelete(g.id)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', padding: '5px' }}>🗑</button>
                  </div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#888', textDecoration: 'line-through' }}>{g.title}</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#555' }}>Alvo alcançado e arquivado com sucesso.</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {isModalOpen && (
        <div onClick={(e) => { if(e.target === e.currentTarget) setIsModalOpen(false) }} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
          <div className="meta-modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ color: '#fff', margin: 0 }}>{editingGoal ? 'Editar Meta' : 'Nova Meta'}</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', backgroundColor: '#262626', borderRadius: '10px', padding: '0.4rem', marginBottom: '1.5rem' }}>
              <button type="button" onClick={() => setGoalType('single')} style={{ flex: 1, padding: '0.8rem', border: 'none', borderRadius: '8px', backgroundColor: goalType === 'single' ? '#0070f3' : 'transparent', color: goalType === 'single' ? '#fff' : '#888', fontWeight: 'bold', cursor: 'pointer' }}>🎯 Única</button>
              <button type="button" onClick={() => setGoalType('routine')} style={{ flex: 1, padding: '0.8rem', border: 'none', borderRadius: '8px', backgroundColor: goalType === 'routine' ? '#eab308' : 'transparent', color: goalType === 'routine' ? '#000' : '#888', fontWeight: 'bold', cursor: 'pointer' }}>🔄 Cíclica</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="text" className="meta-input" required placeholder="Ex: Fechar 3 contratos" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
              
              <textarea className="meta-input" placeholder="Instruções para a meta..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} style={{ resize: 'vertical', minHeight: '60px' }} />

              <div className="row-flex">
                <div>
                  <label style={{ color: '#aaa', fontSize: '0.75rem', display: 'block', marginBottom: '0.4rem' }}>Alvo Numérico:</label>
                  <input type="number" className="meta-input-mini" min="1" required value={formData.target_amount} onChange={(e) => setFormData({...formData, target_amount: e.target.value})} />
                </div>
                
                {goalType === 'single' ? (
                  <div style={{ flex: 1 }}>
                    <label style={{ color: '#aaa', fontSize: '0.75rem', display: 'block', marginBottom: '0.4rem' }}>Data Limite (Opcional):</label>
                    <input type="date" className="meta-input" value={formData.deadline} onChange={(e) => setFormData({...formData, deadline: e.target.value})} />
                  </div>
                ) : (
                  <div style={{ flex: 1 }}>
                    <label style={{ color: '#aaa', fontSize: '0.75rem', display: 'block', marginBottom: '0.4rem' }}>Configuração da Rotina:</label>
                    <button type="button" onClick={() => setIsConfigModalOpen(true)} style={{ width: '100%', padding: '1rem', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontWeight: 'bold' }}>
                      <span>⚙️ {getRoutineRuleText()}</span>
                      <span style={{ fontSize: '0.8rem', color: '#aaa' }}>Alterar</span>
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label style={{ color: '#aaa', fontSize: '0.75rem', display: 'block', marginBottom: '0.4rem', marginTop: '0.5rem' }}>Empresa/Cliente (Opcional):</label>
                <select className="meta-input" value={formData.context_id} onChange={(e) => setFormData({...formData, context_id: e.target.value})}>
                  <option value="">📁 Geral / Pessoal</option>
                  {contexts.map(ctx => <option key={ctx.id} value={ctx.id}>🏢 {ctx.name}</option>)}
                </select>
              </div>

              <div className="row-flex" style={{ marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '1rem', backgroundColor: 'transparent', color: '#888', border: '1px solid #444', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ flex: 2, padding: '1rem', backgroundColor: goalType === 'single' ? '#0070f3' : '#eab308', color: goalType === 'single' ? '#fff' : '#000', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>{editingGoal ? 'Salvar Alterações' : 'Gerar Meta'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isConfigModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
          <div className="config-modal-box">
            <h4 style={{ margin: '0 0 1.2rem 0', color: '#fff', textAlign: 'center' }}>⚙️ Configurar Renovação</h4>
            
            <label style={{ color: '#aaa', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>Renovar a cada:</label>
            <select className="meta-input" value={formData.routine_type} onChange={(e) => setFormData({...formData, routine_type: e.target.value})} style={{ marginBottom: '1rem' }}>
              <option value="weekly">Semana</option><option value="monthly">Mês</option><option value="specific_day">Dia Específico</option><option value="date_range">Período Customizado</option>
            </select>

            {formData.routine_type === 'specific_day' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e1e1e', padding: '1rem', borderRadius: '10px', marginBottom: '1rem' }}>
                <span style={{ color: '#fff', fontSize: '0.9rem' }}>Dia do mês:</span>
                <input type="number" className="meta-input-mini" min="1" max="31" value={formData.specific_day} onChange={(e) => setFormData({...formData, specific_day: e.target.value})} />
              </div>
            )}

            {formData.routine_type === 'date_range' && (
              <div style={{ display: 'flex', gap: '1rem', backgroundColor: '#1e1e1e', padding: '1rem', borderRadius: '10px', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  <span style={{ color: '#aaa', fontSize: '0.8rem', marginBottom: '0.3rem' }}>Início</span>
                  <input type="number" className="meta-input-mini" style={{ width: '100%' }} min="1" max="31" value={formData.start_day} onChange={(e) => setFormData({...formData, start_day: e.target.value})} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                  <span style={{ color: '#aaa', fontSize: '0.8rem', marginBottom: '0.3rem' }}>Fim</span>
                  <input type="number" className="meta-input-mini" style={{ width: '100%' }} min="1" max="31" value={formData.end_day} onChange={(e) => setFormData({...formData, end_day: e.target.value})} />
                </div>
              </div>
            )}

            <button type="button" onClick={() => setIsConfigModalOpen(false)} style={{ width: '100%', padding: '1rem', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
              Confirmar Regra
            </button>
          </div>
        </div>
      )}

    </div>
  );
}