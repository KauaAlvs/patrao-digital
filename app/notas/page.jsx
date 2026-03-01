'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import DashboardHeader from '../../components/DashboardHeader';
import Swal from 'sweetalert2';
import PageLoader from '../../components/PageLoader';

const swalDark = Swal.mixin({
  background: '#1e1e1e', color: '#ffffff', confirmButtonColor: '#0070f3', cancelButtonColor: '#444',
  customClass: { popup: 'border border-gray-700 rounded-xl' }
});

export default function NotasPage() {
  const [notes, setNotes] = useState([]);
  const [contexts, setContexts] = useState([]);
  const [selectedContextId, setSelectedContextId] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [activeNote, setActiveNote] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [lineHeight, setLineHeight] = useState('1.6');
  const [summary, setSummary] = useState([]);
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', date: '' });
  const [isCreatingTask, setIsCreatingTask] = useState(false); 
  
  // Controle de Salvamento Automático
  const [syncStatus, setSyncStatus] = useState('');
  const autoSaveTimeout = useRef(null);
  
  const editorRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Injeção de texto independente
  useEffect(() => {
    if (isEditing && editorRef.current && activeNote) {
      if (editorRef.current.innerHTML === '') {
        editorRef.current.innerHTML = activeNote.content || '';
        generateSummary();
      }
    }
  }, [isEditing, activeNote?.id]);

  async function fetchData() {
    setLoading(true);
    const { data: contextsData } = await supabase.from('contexts').select('*').order('name');
    const { data: notesData } = await supabase.from('notes').select(`*, contexts ( name, color_hex, logo_url )`).order('updated_at', { ascending: false });

    setContexts(contextsData || []);
    setNotes(notesData || []);
    setLoading(false);
  }

  // === SISTEMA DE AUTO-SAVE ===
  const triggerAutoSave = () => {
    setSyncStatus('Digitando...');
    if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    
    autoSaveTimeout.current = setTimeout(() => {
      performAutoSave();
    }, 1500); 
  };

  const performAutoSave = async () => {
    if (!activeNote) return;

    setSyncStatus('Salvando...');
    const currentHTML = editorRef.current ? editorRef.current.innerHTML : '';
    const currentTitle = activeNote.title.trim() === '' ? 'Documento sem título' : activeNote.title;
    const validContextId = activeNote.context_id && activeNote.context_id !== "" ? activeNote.context_id : null;

    const payload = {
      title: currentTitle,
      content: currentHTML,
      context_id: validContextId,
      updated_at: new Date().toISOString()
    };

    if (activeNote.id) {
      const { error } = await supabase.from('notes').update(payload).eq('id', activeNote.id);
      if (error) setSyncStatus('Erro ao salvar');
      else setSyncStatus('Salvo na nuvem ☁️');
    } else {
      const { data, error } = await supabase.from('notes').insert([payload]).select().single();
      if (error) {
        setSyncStatus('Erro ao salvar');
      } else {
        setSyncStatus('Salvo na nuvem ☁️');
        setActiveNote(prev => ({ ...prev, id: data.id, title: currentTitle }));
      }
    }
  };

  // === FUNÇÃO DE EXCLUSÃO DE NOTA ===
  const handleDeleteNote = async (id, e) => {
    if (e) e.stopPropagation(); // Impede de abrir a nota ao clicar na lixeira por fora
    
    const result = await swalDark.fire({
      title: 'Excluir Documento?',
      text: 'Essa ação não pode ser desfeita.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sim, excluir',
      confirmButtonColor: '#dc3545'
    });

    if (result.isConfirmed) {
      if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
      await supabase.from('notes').delete().eq('id', id);
      
      // Se a nota excluída for a que está aberta, fecha o editor
      if (activeNote && activeNote.id === id) {
        setIsEditing(false);
        setActiveNote(null);
      }
      
      fetchData();
      swalDark.fire({ title: 'Excluído!', icon: 'success', timer: 1000, showConfirmButton: false });
    }
  };

  const execCmd = (cmd, value = null) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    generateSummary();
    triggerAutoSave();
  };

  const insertEmoji = (emoji) => {
    document.execCommand('insertText', false, emoji);
    editorRef.current?.focus();
    triggerAutoSave();
  };

  const generateSummary = () => {
    if (!editorRef.current) return;
    const headers = Array.from(editorRef.current.querySelectorAll('h1, h2, h3')).map((h, i) => ({
      text: h.innerText,
      level: h.tagName,
      id: `header-${i}`
    }));
    setSummary(headers);
  };

  const handleEditorInput = () => {
    generateSummary();
    triggerAutoSave();
  };

  const handleSaveAndExit = async () => {
    if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    await performAutoSave(); 
    setIsEditing(false);
    setActiveNote(null);
    setSyncStatus('');
    fetchData(); 
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim() || isCreatingTask) return; 
    setIsCreatingTask(true);
    
    const validContextId = activeNote.context_id && activeNote.context_id !== "" ? activeNote.context_id : null;
    
    if (!activeNote.id) {
       await performAutoSave(); 
    }

    const { error } = await supabase.from('activities').insert([{
      title: newTask.title,
      scheduled_for: newTask.date || new Date().toISOString(),
      context_id: validContextId,
      note_id: activeNote.id || null, 
      status: 'pending'
    }]);

    setIsCreatingTask(false); 

    if (!error) {
      swalDark.fire({ title: 'Tarefa Vinculada!', icon: 'success', timer: 1000, showConfirmButton: false, target: '#editor-root' });
      setIsTaskModalOpen(false);
      setNewTask({ title: '', date: '' });
    } else {
      swalDark.fire({ title: 'Erro', text: error.message, icon: 'error', target: '#editor-root' });
    }
  };

  const filteredNotes = notes.filter(n => selectedContextId ? n.context_id === selectedContextId : true);

  if (loading) return <PageLoader text="Carregando seus Documentos..." icon="📝" />;

  return (
    <div style={{ paddingBottom: '50px' }}>
      <DashboardHeader title="Documentação & Notas" subtitle="Foco total na escrita com integração ao seu QG." />

      <style>{`
        /* Oculta scrollbar da barra de ferramentas no mobile */
        .editor-toolbar::-webkit-scrollbar { display: none; }
        .editor-toolbar { -ms-overflow-style: none; scrollbar-width: none; }

        @media (max-width: 768px) {
          .editor-header { flex-direction: column !important; align-items: stretch !important; gap: 0.8rem !important; padding: 1rem !important; }
          .editor-header-top { display: flex; justify-content: space-between; align-items: center; width: 100%; }
          .editor-title-input { font-size: 1.2rem !important; width: 100% !important; padding: 0.5rem 0 !important; }
          .editor-actions-row { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: space-between; }
          .editor-actions-row select, .editor-actions-row button { flex: 1; font-size: 0.85rem !important; padding: 0.6rem !important; }
          
          .editor-sidebar { display: none !important; } 
          .editor-main-area { padding: 1rem !important; }
          .editor-sheet { padding: 1.5rem !important; font-size: 1rem !important; min-height: 80vh !important; }
        }
      `}</style>

      {!isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* BARRA DE FILTROS */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
              <button onClick={() => setSelectedContextId(null)} style={{ padding: '0.7rem 1.3rem', borderRadius: '30px', borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333', borderLeft: '1px solid #333', backgroundColor: !selectedContextId ? '#0070f3' : '#1a1a1a', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>📂 Todas</button>
              {contexts.map(ctx => (
                <button key={ctx.id} onClick={() => setSelectedContextId(ctx.id)} style={{ padding: '0.7rem 1.3rem', borderRadius: '30px', borderTop: `1px solid ${selectedContextId === ctx.id ? ctx.color_hex : '#333'}`, borderRight: `1px solid ${selectedContextId === ctx.id ? ctx.color_hex : '#333'}`, borderBottom: `1px solid ${selectedContextId === ctx.id ? ctx.color_hex : '#333'}`, borderLeft: `1px solid ${selectedContextId === ctx.id ? ctx.color_hex : '#333'}`, backgroundColor: selectedContextId === ctx.id ? ctx.color_hex : '#1a1a1a', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', whiteSpace: 'nowrap' }}>
                  {ctx.logo_url && <img src={ctx.logo_url} style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'contain' }} alt="" />}
                  {ctx.name}
                </button>
              ))}
            </div>
            <button onClick={() => { setActiveNote({ title: '', content: '', context_id: selectedContextId }); setSyncStatus(''); setIsEditing(true); }} style={{ padding: '0.9rem 1.8rem', backgroundColor: '#fff', color: '#000', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>➕ Novo Documento</button>
          </div>

          {/* LISTA DE DOCUMENTOS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {filteredNotes.map(note => (
              <div key={note.id} onClick={() => { setActiveNote(note); setSyncStatus('Salvo na nuvem ☁️'); setIsEditing(true); }} style={{ backgroundColor: '#1e1e1e', borderRadius: '16px', padding: '1.5rem', cursor: 'pointer', borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333', borderLeft: `6px solid ${note.contexts?.color_hex || '#555'}`, transition: 'transform 0.2s', position: 'relative' }}>
                
                {/* BOTÃO DE LIXEIRA NO CARD POR FORA */}
                <div style={{ position: 'absolute', top: '15px', right: '15px', zIndex: 10 }}>
                  <button onClick={(e) => handleDeleteNote(note.id, e)} style={{ background: 'rgba(255,0,0,0.1)', border: 'none', color: '#ff4444', cursor: 'pointer', borderRadius: '4px', padding: '6px' }} title="Excluir Nota">🗑</button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.2rem', paddingRight: '40px' }}>
                  <div style={{ width: '40px', height: '40px', backgroundColor: '#262626', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {note.contexts?.logo_url ? <img src={note.contexts.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="" /> : <span>📄</span>}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#555' }}>{new Date(note.updated_at).toLocaleDateString()}</span>
                </div>
                <h3 style={{ color: '#fff', margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>{note.title || 'Sem Título'}</h3>
                <p style={{ color: '#888', fontSize: '0.9rem', height: '45px', overflow: 'hidden' }}>{note.content?.replace(/<[^>]*>/g, '').substring(0, 100) || 'Sem conteúdo...'}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        
        /* EDITOR FULLSCREEN */
        <div id="editor-root" style={{ position: 'fixed', inset: 0, backgroundColor: '#121212', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
          
          {/* HEADER DO EDITOR */}
          <div className="editor-header" style={{ padding: '0.8rem 1.5rem', backgroundColor: '#1e1e1e', borderBottom: '1px solid #333', display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
            
            <div className="editor-header-top">
              <button onClick={handleSaveAndExit} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                ❮ <span style={{ fontSize: '1rem' }}>Voltar</span>
              </button>
              <span style={{ color: '#888', fontSize: '0.8rem', textAlign: 'right' }}>{syncStatus}</span>
            </div>

            <input 
              type="text" 
              className="editor-title-input"
              value={activeNote.title} 
              onChange={(e) => { setActiveNote({...activeNote, title: e.target.value}); triggerAutoSave(); }} 
              placeholder="Documento sem título" 
              style={{ backgroundColor: 'transparent', border: 'none', color: '#fff', fontSize: '1.4rem', fontWeight: 'bold', outline: 'none', flex: 1, minWidth: '200px' }} 
            />
            
            <div className="editor-actions-row" style={{ display: 'flex', gap: '0.5rem' }}>
              <select 
                value={activeNote.context_id || ''} 
                onChange={(e) => { setActiveNote({...activeNote, context_id: e.target.value}); triggerAutoSave(); }} 
                style={{ backgroundColor: '#262626', color: '#fff', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', padding: '0.6rem', borderRadius: '8px', outline: 'none' }}
              >
                <option value="">📁 Pessoal / Geral</option>
                {contexts.map(ctx => <option key={ctx.id} value={ctx.id}>🏢 {ctx.name}</option>)}
              </select>

              {/* BOTÃO DE EXCLUIR DE DENTRO DO EDITOR */}
              {activeNote.id && (
                <button onClick={() => handleDeleteNote(activeNote.id)} style={{ backgroundColor: 'transparent', color: '#ff4444', border: '1px solid #ff4444', padding: '0.7rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }} title="Excluir Nota">
                  🗑
                </button>
              )}

              <button onClick={() => setIsTaskModalOpen(true)} style={{ backgroundColor: '#0070f3', color: '#fff', border: 'none', padding: '0.7rem 1.3rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>📅 Tarefa</button>
              <button onClick={handleSaveAndExit} style={{ backgroundColor: '#198754', color: '#fff', border: 'none', padding: '0.7rem 1.6rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>💾 Salvar</button>
            </div>
          </div>

          {/* BARRA DE FERRAMENTAS */}
          <div className="editor-toolbar" style={{ padding: '0.6rem 1.5rem', backgroundColor: '#181818', borderBottom: '1px solid #222', display: 'flex', gap: '0.6rem', alignItems: 'center', overflowX: 'auto', whiteSpace: 'nowrap' }}>
            <select defaultValue="p" onChange={(e) => execCmd('formatBlock', e.target.value)} style={{ backgroundColor: '#262626', color: '#fff', border: 'none', padding: '0.4rem', borderRadius: '4px', outline: 'none' }}>
              <option value="p">Texto Normal</option>
              <option value="H1">Título 1</option>
              <option value="H2">Título 2</option>
              <option value="H3">Título 3</option>
            </select>

            <div style={{ width: '1px', backgroundColor: '#333', height: '20px', margin: '0 5px', flexShrink: 0 }} />

            <button onClick={() => execCmd('bold')} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#262626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><b>B</b></button>
            <button onClick={() => execCmd('italic')} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#262626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><i>I</i></button>
            <button onClick={() => execCmd('underline')} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#262626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><u>U</u></button>
            
            <div style={{ width: '1px', backgroundColor: '#333', height: '20px', margin: '0 5px', flexShrink: 0 }} />

            <button onClick={() => execCmd('insertUnorderedList')} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#262626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>• Lista</button>
            <button onClick={() => execCmd('insertOrderedList')} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#262626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>1. Lista</button>
            
            <div style={{ width: '1px', backgroundColor: '#333', height: '20px', margin: '0 5px', flexShrink: 0 }} />

            <div style={{ display: 'flex', gap: '0.3rem', marginLeft: 'auto' }}>
              <button onClick={() => insertEmoji('🎯')} style={{ padding: '0.4rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>🎯</button>
              <button onClick={() => insertEmoji('✅')} style={{ padding: '0.4rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✅</button>
              <button onClick={() => insertEmoji('⚠️')} style={{ padding: '0.4rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>⚠️</button>
            </div>
          </div>

          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* SUMÁRIO */}
            <aside className="editor-sidebar" style={{ width: '250px', backgroundColor: '#181818', borderRight: '1px solid #222', padding: '1.5rem', overflowY: 'auto' }}>
              <h5 style={{ color: '#666', textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: '1.5rem', letterSpacing: '1px' }}>Índice do Doc</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {summary.length === 0 ? <p style={{ fontSize: '0.8rem', color: '#444' }}>Formate textos como H1 ou H2 para gerar o índice.</p> : summary.map((s, i) => (
                  <div key={i} style={{ fontSize: '0.85rem', color: '#aaa', paddingLeft: s.level === 'H2' ? '1rem' : s.level === 'H3' ? '1.5rem' : '0' }}>• {s.text}</div>
                ))}
              </div>
            </aside>

            {/* FOLHA BRANCA */}
            <main className="editor-main-area" style={{ flex: 1, overflowY: 'auto', padding: '3rem 1rem', display: 'flex', justifyContent: 'center' }}>
              <div 
                className="editor-sheet"
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning={true}
                onInput={handleEditorInput}
                style={{ 
                  width: '100%', maxWidth: '850px', backgroundColor: '#fff', padding: '5rem', 
                  color: '#000', fontSize: '1.15rem', lineHeight: lineHeight, outline: 'none', minHeight: '100vh',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.5)', borderTop: '1px solid #ddd', borderRight: '1px solid #ddd', borderBottom: '1px solid #ddd', borderLeft: '1px solid #ddd', borderRadius: '4px', cursor: 'text'
                }}
              />
            </main>
          </div>

          {/* MODAL SOBREPOSTO TAREFAS */}
          {isTaskModalOpen && (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 3000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }}>
              <div style={{ backgroundColor: '#1e1e1e', padding: '2.5rem', borderRadius: '20px', width: '100%', maxWidth: '420px', borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333', borderLeft: '1px solid #333' }}>
                <h3 style={{ color: '#fff', marginTop: 0, marginBottom: '1.5rem', textAlign: 'center' }}>🎯 Gerar Tarefa Deste Doc</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                  <input type="text" placeholder="Nome da Tarefa" value={newTask.title} onChange={(e) => setNewTask({...newTask, title: e.target.value})} style={{ width: '100%', padding: '1rem', backgroundColor: '#262626', color: '#fff', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '10px', outline: 'none' }} />
                  <input type="datetime-local" value={newTask.date} onChange={(e) => setNewTask({...newTask, date: e.target.value})} style={{ width: '100%', padding: '1rem', backgroundColor: '#262626', color: '#fff', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '10px', outline: 'none' }} />
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button onClick={() => setIsTaskModalOpen(false)} style={{ flex: 1, padding: '1rem', backgroundColor: 'transparent', color: '#888', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', borderRadius: '10px' }}>Cancelar</button>
                    <button onClick={handleCreateTask} disabled={isCreatingTask} style={{ flex: 2, padding: '1rem', backgroundColor: isCreatingTask ? '#555' : '#0070f3', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold' }}>
                      {isCreatingTask ? 'Criando...' : 'Criar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}