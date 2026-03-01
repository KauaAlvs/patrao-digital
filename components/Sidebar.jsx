'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Swal from 'sweetalert2';

const swalDark = Swal.mixin({
  background: '#1e1e1e', color: '#ffffff', confirmButtonColor: '#0070f3', cancelButtonColor: '#444',
  customClass: { popup: 'border border-gray-700 rounded-xl' }
});

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('activity'); 
  const [goalType, setGoalType] = useState('routine');
  const [contexts, setContexts] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: '', description: '', date: '', context_id: '', target_amount: 1, 
    routine_type: 'weekly', specific_day: 15, start_day: 20, end_day: 30, deadline: ''
  });

  useEffect(() => {
    async function fetchContexts() {
      const { data } = await supabase.from('contexts').select('*').order('name');
      if (data) setContexts(data);
    }
    fetchContexts();
  }, []);

  const handleOpenModal = () => {
    setFormData({ title: '', description: '', date: '', context_id: '', target_amount: 1, routine_type: 'weekly', specific_day: 15, start_day: 20, end_day: 30, deadline: '' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    setIsSubmitting(true);

    const validContextId = formData.context_id !== "" ? formData.context_id : null;
    let error = null;

    if (activeTab === 'activity') {
      const { error: err } = await supabase.from('activities').insert([{ title: formData.title, description: formData.description, scheduled_for: formData.date || new Date().toISOString(), context_id: validContextId, status: 'pending' }]);
      error = err;
    } 
    else if (activeTab === 'goal') {
      let routineConfig = null;
      let safeFrequency = 'once';
      if (goalType === 'routine') {
        if (formData.routine_type === 'specific_day') { routineConfig = { day: Number(formData.specific_day) }; safeFrequency = 'monthly'; } 
        else if (formData.routine_type === 'date_range') { routineConfig = { start_day: Number(formData.start_day), end_day: Number(formData.end_day) }; safeFrequency = 'monthly'; }
        else { safeFrequency = formData.routine_type; }
      }
      const { error: err } = await supabase.from('goals').insert([{
        title: formData.title, description: formData.description, target_amount: Number(formData.target_amount), current_amount: 0, context_id: validContextId, status: 'in_progress',
        goal_type: goalType, routine_type: goalType === 'routine' ? formData.routine_type : null, routine_config: routineConfig,
        deadline: goalType === 'single' && formData.deadline ? new Date(formData.deadline).toISOString() : null, last_reset_date: new Date().toISOString(), frequency: safeFrequency
      }]);
      error = err;
    } 
    else if (activeTab === 'note') {
      const { error: err } = await supabase.from('notes').insert([{ title: formData.title, content: formData.description, context_id: validContextId, updated_at: new Date().toISOString() }]);
      error = err;
    }

    setIsSubmitting(false);

    if (error) {
      swalDark.fire('Erro', error.message, 'error');
    } else {
      setIsModalOpen(false);
      await swalDark.fire({ title: 'Lançado com Sucesso!', icon: 'success', timer: 1000, showConfirmButton: false });
      window.location.reload(); 
    }
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: '🏠' }, { name: 'Minha Agenda', path: '/agenda', icon: '📅' },
    { name: 'Metas', path: '/metas', icon: '🎯' }, { name: 'Corporativo', path: '/corporativo', icon: '🏢' },
    { name: 'Bloco de Notas', path: '/notas', icon: '📝' }
  ];

  return (
    <>
      <aside style={{ width: isCollapsed ? '80px' : '260px', backgroundColor: '#121212', height: '100vh', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', borderRight: '1px solid #333', transition: 'width 0.3s ease', overflowX: 'hidden', position: 'relative' }}>
        <button onClick={() => setIsCollapsed(!isCollapsed)} style={{ position: 'absolute', top: '1.5rem', right: isCollapsed ? '0' : '1rem', left: isCollapsed ? '0' : 'auto', margin: isCollapsed ? '0 auto' : '0', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem', zIndex: 10, width: '30px', textAlign: 'center' }} title={isCollapsed ? "Expandir menu" : "Recolher menu"}>{isCollapsed ? '❯' : '❮'}</button>
        <div style={{ marginBottom: '2.5rem', marginTop: '2.5rem', textAlign: 'center', transition: 'all 0.3s' }}>
          <h2 style={{ color: '#fff', margin: 0, fontSize: isCollapsed ? '1.2rem' : '1.5rem', letterSpacing: '1px', whiteSpace: 'nowrap' }}>{isCollapsed ? <span>P<span style={{ color: '#0070f3' }}>D</span></span> : <span>PATRÃO<span style={{ color: '#0070f3' }}>DIGITAL</span></span>}</h2>
          {!isCollapsed && <p style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.2rem', textTransform: 'uppercase' }}>Sistema de Gestão</p>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          <button onClick={handleOpenModal} title="Lançamento Rápido" style={{ width: isCollapsed ? '45px' : '55px', height: isCollapsed ? '45px' : '55px', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '50%', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0, 112, 243, 0.4)', transition: 'all 0.2s', lineHeight: 0 }} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.08)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}>+</button>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link key={item.path} href={item.path} style={{ textDecoration: 'none' }} title={isCollapsed ? item.name : ""}>
                <div style={{ padding: isCollapsed ? '1rem 0' : '1rem 1.2rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', gap: '1rem', backgroundColor: isActive ? '#1e1e1e' : 'transparent', color: isActive ? '#fff' : '#888', borderTop: '1px solid transparent', borderRight: '1px solid transparent', borderBottom: '1px solid transparent', borderLeft: isActive && !isCollapsed ? '4px solid #0070f3' : '4px solid transparent', transition: 'all 0.2s', fontWeight: isActive ? 'bold' : 'normal', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '1.3rem', color: isActive && isCollapsed ? '#0070f3' : 'inherit' }}>{item.icon}</span>
                  {!isCollapsed && <span>{item.name}</span>}
                </div>
              </Link>
            );
          })}
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid #333', textAlign: 'center', whiteSpace: 'nowrap' }}><p style={{ color: '#555', fontSize: '0.75rem' }}>{isCollapsed ? '©' : 'Kauã Alves © 2026'}</p></div>
      </aside>

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#1e1e1e', borderRadius: '20px', width: '100%', maxWidth: '500px', borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333', borderLeft: '1px solid #333', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: '#fff', margin: 0, fontSize: '1.3rem' }}>🚀 Lançamento Rápido</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid #333', backgroundColor: '#181818' }}>
              <button onClick={() => setActiveTab('activity')} style={{ flex: 1, padding: '1rem', background: 'none', borderTop: 'none', borderRight: 'none', borderLeft: 'none', color: activeTab === 'activity' ? '#0070f3' : '#888', fontWeight: 'bold', borderBottom: activeTab === 'activity' ? '3px solid #0070f3' : '3px solid transparent', cursor: 'pointer', transition: 'all 0.2s' }}>📅 Atividade</button>
              <button onClick={() => setActiveTab('goal')} style={{ flex: 1, padding: '1rem', background: 'none', borderTop: 'none', borderRight: 'none', borderLeft: 'none', color: activeTab === 'goal' ? '#eab308' : '#888', fontWeight: 'bold', borderBottom: activeTab === 'goal' ? '3px solid #eab308' : '3px solid transparent', cursor: 'pointer', transition: 'all 0.2s' }}>🎯 Meta</button>
              <button onClick={() => setActiveTab('note')} style={{ flex: 1, padding: '1rem', background: 'none', borderTop: 'none', borderRight: 'none', borderLeft: 'none', color: activeTab === 'note' ? '#22c55e' : '#888', fontWeight: 'bold', borderBottom: activeTab === 'note' ? '3px solid #22c55e' : '3px solid transparent', cursor: 'pointer', transition: 'all 0.2s' }}>📝 Nota</button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <input type="text" required placeholder={activeTab === 'goal' ? "Ex: Fechar 3 contratos" : "Título principal..."} value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} style={{ width: '100%', padding: '1rem', backgroundColor: '#262626', color: '#fff', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '10px', fontSize: '1.1rem', outline: 'none' }} />

              {/* TEXTAREA AGORA LIBERADA PARA AS METAS TAMBÉM */}
              <textarea placeholder={activeTab === 'note' ? "Ideia rápida ou anotação..." : "Descrição ou detalhes (opcional)..."} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} style={{ width: '100%', padding: '1rem', backgroundColor: '#262626', color: '#fff', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '10px', resize: 'vertical', minHeight: '80px', outline: 'none' }} />

              {activeTab === 'activity' && (
                <input type="datetime-local" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} style={{ width: '100%', padding: '1rem', backgroundColor: '#262626', color: '#fff', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '10px', outline: 'none' }} />
              )}

              {activeTab === 'goal' && (
                <>
                  <div style={{ display: 'flex', backgroundColor: '#333', borderRadius: '8px', padding: '0.3rem', marginBottom: '0.5rem' }}>
                    <button type="button" onClick={() => setGoalType('single')} style={{ flex: 1, padding: '0.6rem', border: 'none', borderRadius: '6px', backgroundColor: goalType === 'single' ? '#0070f3' : 'transparent', color: goalType === 'single' ? '#fff' : '#aaa', cursor: 'pointer', fontWeight: 'bold' }}>Alvo Único</button>
                    <button type="button" onClick={() => setGoalType('routine')} style={{ flex: 1, padding: '0.6rem', border: 'none', borderRadius: '6px', backgroundColor: goalType === 'routine' ? '#eab308' : 'transparent', color: goalType === 'routine' ? '#000' : '#aaa', cursor: 'pointer', fontWeight: 'bold' }}>Rotina Cíclica</button>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ color: '#aaa', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>Alvo Numérico:</label>
                      <input type="number" min="1" required value={formData.target_amount} onChange={(e) => setFormData({...formData, target_amount: e.target.value})} style={{ width: '100%', padding: '1rem', backgroundColor: '#262626', color: '#fff', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '10px', outline: 'none' }} />
                    </div>
                    {goalType === 'single' ? (
                      <div style={{ flex: 1 }}>
                        <label style={{ color: '#aaa', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>Data Limite:</label>
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
                    <input type="number" placeholder="Ex: Dia 15" min="1" max="31" value={formData.specific_day} onChange={(e) => setFormData({...formData, specific_day: e.target.value})} style={{ width: '100%', padding: '1rem', backgroundColor: '#262626', color: '#fff', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '10px', outline: 'none' }} />
                  )}
                  {goalType === 'routine' && formData.routine_type === 'date_range' && (
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <input type="number" placeholder="Início (ex: 20)" min="1" max="31" value={formData.start_day} onChange={(e) => setFormData({...formData, start_day: e.target.value})} style={{ flex: 1, padding: '1rem', backgroundColor: '#262626', color: '#fff', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '10px', outline: 'none' }} />
                      <input type="number" placeholder="Fim (ex: 30)" min="1" max="31" value={formData.end_day} onChange={(e) => setFormData({...formData, end_day: e.target.value})} style={{ flex: 1, padding: '1rem', backgroundColor: '#262626', color: '#fff', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '10px', outline: 'none' }} />
                    </div>
                  )}
                </>
              )}

              <div style={{ marginTop: '0.5rem' }}>
                <label style={{ color: '#aaa', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>Vincular ao Cliente (Opcional):</label>
                <select value={formData.context_id} onChange={(e) => setFormData({...formData, context_id: e.target.value})} style={{ width: '100%', padding: '1rem', backgroundColor: '#262626', color: '#fff', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '10px', outline: 'none' }}>
                  <option value="">📁 Pessoal / Geral</option>
                  {contexts.map(ctx => <option key={ctx.id} value={ctx.id}>🏢 {ctx.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '1.2rem', backgroundColor: 'transparent', color: '#aaa', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={isSubmitting} style={{ flex: 2, padding: '1.2rem', backgroundColor: activeTab === 'goal' ? '#eab308' : (activeTab === 'note' ? '#22c55e' : '#0070f3'), color: activeTab === 'goal' ? '#000' : '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem' }}>{isSubmitting ? 'Processando...' : 'Lançar Agora'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}