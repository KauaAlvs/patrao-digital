'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import DashboardHeader from '../../components/DashboardHeader';
import Swal from 'sweetalert2';

const swalDark = Swal.mixin({
  background: '#1e1e1e',
  color: '#ffffff',
  confirmButtonColor: '#0070f3',
  cancelButtonColor: '#444',
  customClass: { popup: 'border border-gray-700 rounded-xl' }
});

export default function CorporativoPage() {
  const [companies, setCompanies] = useState([]);
  const [corporateActivities, setCorporateActivities] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Estados do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null); 
  const [formData, setFormData] = useState({ name: '', color: '#3b82f6' });
  const [logoFile, setLogoFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const PREDEFINED_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e', '#64748b'];

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data: compData } = await supabase.from('contexts').select('*').eq('type', 'company').order('name');
    const { data: actData } = await supabase.from('activities').select(`*, contexts ( id, name, color_hex, type, logo_url )`).order('scheduled_for', { ascending: true });
    
    setCompanies(compData || []);
    setCorporateActivities((actData || []).filter(a => a.contexts?.type === 'company'));
    setLoading(false);
  }

  const openCreateModal = () => {
    setEditingCompany(null);
    setFormData({ name: '', color: '#3b82f6' });
    setLogoFile(null);
    setIsModalOpen(true);
  };

  const openEditModal = (comp, e) => {
    e.stopPropagation();
    setEditingCompany(comp);
    setFormData({ name: comp.name, color: comp.color_hex });
    setLogoFile(null);
    setIsModalOpen(true);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setIsUploading(true);

    let finalLogoUrl = editingCompany?.logo_url || null;

    if (logoFile) {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, logoFile, { upsert: true });

      if (uploadError) {
        swalDark.fire('Erro no Upload', uploadError.message, 'error');
        setIsUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from('company-logos').getPublicUrl(filePath);
      finalLogoUrl = urlData.publicUrl;
    }

    const payload = { name: formData.name, color_hex: formData.color, logo_url: finalLogoUrl, type: 'company' };
    const request = editingCompany ? supabase.from('contexts').update(payload).eq('id', editingCompany.id) : supabase.from('contexts').insert([payload]);
    const { error } = await request;

    setIsUploading(false);
    if (error) {
      swalDark.fire('Erro', error.message, 'error');
    } else {
      swalDark.fire({ title: 'Salvo!', icon: 'success', timer: 1000, showConfirmButton: false });
      setIsModalOpen(false);
      fetchData();
    }
  }

  const handleDelete = async (comp, e) => {
    e.stopPropagation();
    const result = await swalDark.fire({
      title: 'Excluir?',
      text: "As atividades relacionadas perderão o logo.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, excluir'
    });

    if (result.isConfirmed) {
      await supabase.from('contexts').delete().eq('id', comp.id);
      if (selectedCompanyId === comp.id) setSelectedCompanyId(null);
      fetchData();
    }
  };

  const displayedActivities = selectedCompanyId ? corporateActivities.filter(a => a.context_id === selectedCompanyId) : corporateActivities;
  const pending = displayedActivities.filter(a => a.status === 'pending');
  const completed = displayedActivities.filter(a => a.status === 'done').slice(0, 10);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}><p style={{ color: '#a0a0a0' }}>Organizando QG Corporativo...</p></div>;

  return (
    <div style={{ paddingBottom: '100px' }}>
      <DashboardHeader title="Gestão Corporativa" subtitle="Painel de marcas e controle de entregas." />
      
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button 
          onClick={() => setSelectedCompanyId(null)}
          style={{ padding: '0.6rem 1.2rem', backgroundColor: selectedCompanyId === null ? '#333' : 'transparent', border: '1px solid #444', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}
        >
          🌐 Ver Todas
        </button>
        <button onClick={openCreateModal} style={{ padding: '0.8rem 1.5rem', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0, 112, 243, 0.3)' }}>
          ➕ Nova Empresa
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
        
        {/* GRID DE EMPRESAS (CARDS MAIORES) */}
        <section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {companies.map(comp => {
              const isSelected = selectedCompanyId === comp.id;
              const accentColor = comp.color_hex;

              return (
                <div 
                  key={comp.id} 
                  onClick={() => setSelectedCompanyId(isSelected ? null : comp.id)}
                  style={{
                    backgroundColor: isSelected ? '#2d3748' : '#1e1e1e',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    borderTop: `1px solid ${isSelected ? accentColor : '#333'}`,
                    borderRight: `1px solid ${isSelected ? accentColor : '#333'}`,
                    borderBottom: `1px solid ${isSelected ? accentColor : '#333'}`,
                    borderLeft: `6px solid ${accentColor}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1rem',
                    boxShadow: isSelected ? `0 10px 20px rgba(0,0,0,0.4)` : 'none'
                  }}
                >
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', position: 'absolute', top: '10px', right: '10px' }}>
                    <button onClick={(e) => openEditModal(comp, e)} style={{ background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '4px' }}>✏️</button>
                    <button onClick={(e) => handleDelete(comp, e)} style={{ background: 'rgba(0,0,0,0.3)', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '4px' }}>🗑️</button>
                  </div>

                  <div style={{ 
                    width: '100px', 
                    height: '100px', 
                    backgroundColor: '#262626', 
                    borderRadius: '12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    padding: '10px',
                    overflow: 'hidden'
                  }}>
                    {comp.logo_url ? (
                      <img src={comp.logo_url} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span style={{ fontSize: '2rem' }}>🏢</span>
                    )}
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>{comp.name}</h3>
                    <span style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {corporateActivities.filter(a => a.context_id === comp.id && a.status === 'pending').length} Pendências
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* FEED DE ATIVIDADES (LISTA COMPLETA) */}
        <section style={{ backgroundColor: '#1e1e1e', borderRadius: '16px', padding: '2rem', borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333', borderLeft: '1px solid #333' }}>
          <h3 style={{ marginTop: 0, color: '#fff', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            {selectedCompanyId ? `Timeline: ${companies.find(c => c.id === selectedCompanyId)?.name}` : 'Fluxo de Trabalho Corporativo'}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            {/* COLUNA PENDENTES */}
            <div>
              <h4 style={{ color: '#0070f3', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem', borderLeft: '3px solid #0070f3', paddingLeft: '8px' }}>Pendências</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {pending.length === 0 ? <p style={{ color: '#555' }}>Nenhuma tarefa para este filtro.</p> : pending.map(act => (
                  <div key={act.id} style={{ padding: '1rem', backgroundColor: '#262626', borderRadius: '12px', borderLeft: `4px solid ${act.contexts?.color_hex || '#555'}`, display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {act.contexts?.logo_url && <img src={act.contexts.logo_url} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'contain', backgroundColor: '#fff' }} alt="l" />}
                    <div style={{ flex: 1 }}>
                      <h5 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>{act.title}</h5>
                      <p style={{ margin: '0.2rem 0 0 0', color: '#888', fontSize: '0.85rem' }}>{act.description || 'Sem detalhes'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* COLUNA CONCLUÍDAS */}
            <div>
              <h4 style={{ color: '#22c55e', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem', borderLeft: '3px solid #22c55e', paddingLeft: '8px' }}>Entregues</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {completed.length === 0 ? <p style={{ color: '#555' }}>Aguardando primeira entrega.</p> : completed.map(act => (
                  <div key={act.id} style={{ padding: '0.8rem 1.2rem', backgroundColor: '#1a1a1a', borderRadius: '8px', opacity: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#eee', textDecoration: 'line-through', fontSize: '0.9rem' }}>{act.title}</span>
                    <span style={{ color: '#22c55e' }}>✓</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* MODAL DE EMPRESA */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ backgroundColor: '#1e1e1e', borderRadius: '20px', padding: '2.5rem', width: '100%', maxWidth: '480px', borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333', borderLeft: '1px solid #333', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            <h3 style={{ color: '#fff', margin: '0 0 2rem 0', fontSize: '1.5rem', textAlign: 'center' }}>{editingCompany ? 'Editar Empresa' : '🏢 Nova Empresa'}</h3>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ color: '#aaa', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>Nome da Empresa:</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required style={{ width: '100%', padding: '1rem', backgroundColor: '#2d2d2d', color: '#fff', border: '1px solid #444', borderRadius: '12px', outline: 'none' }} />
              </div>
              
              <div style={{ backgroundColor: '#262626', padding: '1.5rem', borderRadius: '12px', border: '2px dashed #444', textAlign: 'center' }}>
                <span style={{ color: '#fff', fontSize: '0.9rem', display: 'block', marginBottom: '1rem' }}>Logo da Marca</span>
                <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files[0])} style={{ color: '#888', fontSize: '0.8rem', width: '100%' }} />
                {editingCompany?.logo_url && !logoFile && <p style={{ fontSize: '0.7rem', color: '#0070f3', marginTop: '0.8rem' }}>Marca já possui logo. Suba outra para substituir.</p>}
              </div>

              <div>
                <label style={{ color: '#aaa', fontSize: '0.8rem', display: 'block', marginBottom: '1rem' }}>Cor de Identificação:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', justifyContent: 'center' }}>
                  {PREDEFINED_COLORS.map(c => (
                    <div key={c} onClick={() => setFormData({...formData, color: c})} style={{ 
                      width: '35px', height: '35px', borderRadius: '50%', backgroundColor: c, cursor: 'pointer', 
                      border: formData.color === c ? '3px solid #fff' : '3px solid transparent',
                      transform: formData.color === c ? 'scale(1.2)' : 'scale(1)',
                      transition: 'all 0.1s'
                    }} />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '1.1rem', backgroundColor: 'transparent', color: '#888', border: '1px solid #444', borderRadius: '12px', fontWeight: 'bold' }}>Cancelar</button>
                <button type="submit" disabled={isUploading} style={{ flex: 2, padding: '1.1rem', backgroundColor: formData.color, color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem' }}>
                  {isUploading ? 'Enviando...' : (editingCompany ? 'Atualizar' : 'Cadastrar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}