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
    { name: 'Dashboard', path: '/', icon: '🏠' }, { name: 'Agenda', path: '/agenda', icon: '📅' },
    { name: 'Metas', path: '/metas', icon: '🎯' }, { name: 'Empresas', path: '/corporativo', icon: '🏢' },
    { name: 'Notas', path: '/notas', icon: '📝' }
  ];

  return (
    <>
      {/* CSS RESPONSIVO MUTANTE */}
      <style>{`
        .sidebar-wrapper {
          width: ${isCollapsed ? '80px' : '260px'};
          background-color: #121212; height: 100vh; padding: 1.5rem 1rem;
          display: flex; flex-direction: column; border-right: 1px solid #333;
          transition: width 0.3s ease; position: relative; z-index: 100;
        }
        .collapse-btn {
          position: absolute; top: 1.5rem; right: ${isCollapsed ? '0' : '1rem'};
          margin: ${isCollapsed ? '0 auto' : '0'}; left: ${isCollapsed ? '0' : 'auto'};
          background: none; border: none; color: #888; cursor: pointer; font-size: 1.2rem; width: 30px;
        }
        .logo-box { margin: 2.5rem 0; text-align: center; white-space: nowrap; }
        .logo-title { color: #fff; margin: 0; font-size: ${isCollapsed ? '1.2rem' : '1.5rem'}; letter-spacing: 1px; }
        .logo-sub { color: #666; font-size: 0.75rem; margin-top: 0.2rem; text-transform: uppercase; display: ${isCollapsed ? 'none' : 'block'}; }
        
        .fab-container { display: flex; justify-content: center; margin-bottom: 2rem; }
        .fab-button {
          width: ${isCollapsed ? '45px' : '55px'}; height: ${isCollapsed ? '45px' : '55px'};
          background-color: #0070f3; color: #fff; border: none; border-radius: 50%;
          font-size: 2rem; display: flex; align-items: center; justify-content: center;
          cursor: pointer; box-shadow: 0 4px 15px rgba(0, 112, 243, 0.4); transition: all 0.2s; line-height: 0;
        }
        .fab-button:hover { transform: scale(1.08); }

        .nav-menu { display: flex; flex-direction: column; gap: 0.5rem; flex: 1; }
        .nav-link {
          padding: ${isCollapsed ? '1rem 0' : '1rem 1.2rem'}; border-radius: 10px; display: flex; align-items: center;
          justify-content: ${isCollapsed ? 'center' : 'flex-start'}; gap: 1rem;
          transition: all 0.2s; white-space: nowrap; text-decoration: none;
        }
        .nav-link.active { background-color: #1e1e1e; color: #fff; border-left: ${isCollapsed ? '4px solid transparent' : '4px solid #0070f3'}; font-weight: bold; }
        .nav-link.inactive { background-color: transparent; color: #888; border-left: 4px solid transparent; }
        .nav-icon { font-size: 1.3rem; }
        .nav-link.active .nav-icon { color: ${isCollapsed ? '#0070f3' : 'inherit'}; }
        .nav-text { display: ${isCollapsed ? 'none' : 'block'}; }

        .footer-box { margin-top: auto; padding-top: 1.5rem; border-top: 1px solid #333; text-align: center; white-space: nowrap; }
        .footer-text { color: #555; font-size: 0.75rem; }

        /* ============================================== */
        /* MAGIA MOBILE APP: BOTTOM NAVIGATION BAR & FAB */
        /* ============================================== */
        @media (max-width: 768px) {
          .sidebar-wrapper {
            width: 100% !important; height: 75px; flex-direction: row;
            position: fixed; bottom: 0; left: 0; padding: 0;
            border-right: none; border-top: 1px solid #222;
            background-color: rgba(18, 18, 18, 0.98); backdrop-filter: blur(10px);
            align-items: center; justify-content: space-around;
            padding-bottom: env(safe-area-inset-bottom); /* Fix para iPhones */
          }
          .collapse-btn, .logo-box, .footer-box { display: none; }
          .nav-menu { flex-direction: row; justify-content: space-around; width: 100%; align-items: center; padding: 0 0.5rem; }
          .nav-link { flex-direction: column; gap: 0.3rem; padding: 0.5rem; border: none !important; min-width: 60px; justify-content: center; }
          .nav-link.active { background-color: transparent; color: #0070f3; }
          .nav-icon { font-size: 1.4rem; color: inherit; }
          .nav-text { display: block; font-size: 0.6rem; font-weight: bold; margin: 0; }

          /* FAB (Botão de Cadastro) Flutuando no Celular */
          .fab-container { position: fixed; bottom: 95px; right: 20px; margin: 0; z-index: 1000; }
          .fab-button { width: 60px; height: 60px; box-shadow: 0 8px 25px rgba(0, 112, 243, 0.6); }
        }
      `}</style>

      <aside className="sidebar-wrapper">
        <button className="collapse-btn" onClick={() => setIsCollapsed(!isCollapsed)} title={isCollapsed ? "Expandir menu" : "Recolher menu"}>{isCollapsed ? '❯' : '❮'}</button>
        <div className="logo-box">
          <h2 className="logo-title">{isCollapsed ? <span>P<span style={{ color: '#0070f3' }}>D</span></span> : <span>PATRÃO<span style={{ color: '#0070f3' }}>DIGITAL</span></span>}</h2>
          <p className="logo-sub">Sistema de Gestão</p>
        </div>

        <div className="fab-container">
          <button className="fab-button" onClick={handleOpenModal} title="Lançamento Rápido">+</button>
        </div>

        <nav className="nav-menu">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link key={item.path} href={item.path} style={{ textDecoration: 'none' }} title={isCollapsed ? item.name : ""}>
                <div className={`nav-link ${isActive ? 'active' : 'inactive'}`}>
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-text">{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="footer-box"><p className="footer-text">{isCollapsed ? '©' : 'Kauã Alves © 2026'}</p></div>
      </aside>

      {/* MODAL GLOBAL DE LANÇAMENTO (Fica responsivo nativamente por usar % e maxWidth) */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
          <div style={{ backgroundColor: '#1e1e1e', borderRadius: '20px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333', borderLeft: '1px solid #333', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
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