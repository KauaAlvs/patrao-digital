'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import DashboardHeader from '../../components/DashboardHeader';
import Swal from 'sweetalert2';

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
  const [isCreatingTask, setIsCreatingTask] = useState(false); // Cadeado contra duplicação
  
  // Controle de Salvamento Automático
  const [syncStatus, setSyncStatus] = useState('');
  const autoSaveTimeout = useRef(null);
  
  const editorRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Injeção de texto independente: impede que o React pisque a folha ao digitar o título
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
    
    const { data: notesData } = await supabase
      .from('notes')
      .select(`*, contexts ( name, color_hex, logo_url )`)
      .order('updated_at', { ascending: false });

    setContexts(contextsData || []);
    setNotes(notesData || []);
    setLoading(false);
  }

  // === SISTEMA DE AUTO-SAVE (GOOGLE DOCS STYLE) ===
  const triggerAutoSave = () => {
    setSyncStatus('Digitando...');
    if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    
    autoSaveTimeout.current = setTimeout(() => {
      performAutoSave();
    }, 1500); // Salva 1.5 segundos após você parar de digitar
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
      // Se for nota nova, insere e pega o ID devolta para não duplicar nos próximos auto-saves
      const { data, error } = await supabase.from('notes').insert([payload]).select().single();
      if (error) {
        setSyncStatus('Erro ao salvar');
      } else {
        setSyncStatus('Salvo na nuvem ☁️');
        setActiveNote(prev => ({ ...prev, id: data.id, title: currentTitle }));
      }
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
    await performAutoSave(); // Força o último salvamento
    setIsEditing(false);
    setActiveNote(null);
    setSyncStatus('');
    fetchData(); // Atualiza a lista na tela inicial
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim() || isCreatingTask) return; // Trava o botão contra clique duplo
    setIsCreatingTask(true);
    
    const validContextId = activeNote.context_id && activeNote.context_id !== "" ? activeNote.context_id : null;
    
    // Se a nota ainda não foi salva no banco (não tem ID), salva primeiro
    if (!activeNote.id) {
       await performAutoSave(); 
    }

    const { error } = await supabase.from('activities').insert([{
      title: newTask.title,
      scheduled_for: newTask.date || new Date().toISOString(),
      context_id: validContextId,
      note_id: activeNote.id || null, // Garante que a nota tem ID agora
      status: 'pending'
    }]);

    setIsCreatingTask(false); // Destrava o botão

    if (!error) {
      swalDark.fire({ title: 'Tarefa Vinculada!', icon: 'success', timer: 1000, showConfirmButton: false, target: '#editor-root' });
      setIsTaskModalOpen(false);
      setNewTask({ title: '', date: '' });
    } else {
      swalDark.fire({ title: 'Erro', text: error.message, icon: 'error', target: '#editor-root' });
    }
  };

  const filteredNotes = notes.filter(n => selectedContextId ? n.context_id === selectedContextId : true);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}><p style={{ color: '#888' }}>Carregando Bloco de Notas...</p></div>;

  return (
    <div style={{ paddingBottom: '50px' }}>
      <DashboardHeader title="Documentação & Notas" subtitle="Foco total na escrita com integração ao seu QG." />

      {!isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* BARRA DE FILTROS */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
              <button onClick={() => setSelectedContextId(null)} style={{ padding: '0.7rem 1.3rem', borderRadius: '30px', borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333', borderLeft: '1px solid #333', backgroundColor: !selectedContextId ? '#0070f3' : '#1a1a1a', color: '#fff', cursor: 'pointer' }}>📂 Todas</button>
              {contexts.map(ctx => (
                <button key={ctx.id} onClick={() => setSelectedContextId(ctx.id)} style={{ padding: '0.7rem 1.3rem', borderRadius: '30px', borderTop: `1px solid ${selectedContextId === ctx.id ? ctx.color_hex : '#333'}`, borderRight: `1px solid ${selectedContextId === ctx.id ? ctx.color_hex : '#333'}`, borderBottom: `1px solid ${selectedContextId === ctx.id ? ctx.color_hex : '#333'}`, borderLeft: `1px solid ${selectedContextId === ctx.id ? ctx.color_hex : '#333'}`, backgroundColor: selectedContextId === ctx.id ? ctx.color_hex : '#1a1a1a', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {ctx.logo_url && <img src={ctx.logo_url} style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'contain' }} alt="" />}
                  {ctx.name}
                </button>
              ))}
            </div>
            <button onClick={() => { setActiveNote({ title: '', content: '', context_id: selectedContextId }); setSyncStatus(''); setIsEditing(true); }} style={{ padding: '0.9rem 1.8rem', backgroundColor: '#fff', color: '#000', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>➕ Novo Documento</button>
          </div>

          {/* LISTA DE DOCUMENTOS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {filteredNotes.map(note => (
              <div key={note.id} onClick={() => { setActiveNote(note); setSyncStatus('Salvo na nuvem ☁️'); setIsEditing(true); }} style={{ backgroundColor: '#1e1e1e', borderRadius: '16px', padding: '1.5rem', cursor: 'pointer', borderTop: '1px solid #333', borderRight: '1px solid #333', borderBottom: '1px solid #333', borderLeft: `6px solid ${note.contexts?.color_hex || '#555'}`, transition: 'transform 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.2rem' }}>
                  <div style={{ width: '40px', height: '40px', backgroundColor: '#262626', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {note.contexts?.logo_url ? <img src={note.contexts.logo_url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="" /> : <span>📄</span>}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#555' }}>{new Date(note.updated_at).toLocaleDateString()}</span>
                </div>
                <h3 style={{ color: '#fff', margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>{note.title}</h3>
                <p style={{ color: '#888', fontSize: '0.9rem', height: '45px', overflow: 'hidden' }}>{note.content?.replace(/<[^>]*>/g, '').substring(0, 100) || 'Sem conteúdo...'}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        
        /* EDITOR FULLSCREEN */
        <div id="editor-root" style={{ position: 'fixed', inset: 0, backgroundColor: '#121212', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
          
          {/* HEADER DO EDITOR */}
          <div style={{ padding: '0.8rem 1.5rem', backgroundColor: '#1e1e1e', borderBottom: '1px solid #333', display: 'flex', flexWrap: 'wrap', gap: '1.2rem', alignItems: 'center' }}>
            <button onClick={handleSaveAndExit} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.4rem' }}>✕</button>
            <input 
              type="text" 
              value={activeNote.title} 
              onChange={(e) => { setActiveNote({...activeNote, title: e.target.value}); triggerAutoSave(); }} 
              placeholder="Documento sem título" 
              style={{ backgroundColor: 'transparent', border: 'none', color: '#fff', fontSize: '1.4rem', fontWeight: 'bold', outline: 'none', flex: 1 }} 
            />
            
            <span style={{ color: '#888', fontSize: '0.8rem', marginRight: '1rem' }}>{syncStatus}</span>

            <select 
              value={activeNote.context_id || ''} 
              onChange={(e) => { setActiveNote({...activeNote, context_id: e.target.value}); triggerAutoSave(); }} 
              style={{ backgroundColor: '#262626', color: '#fff', borderTop: '1px solid #444', borderRight: '1px solid #444', borderBottom: '1px solid #444', borderLeft: '1px solid #444', padding: '0.6rem', borderRadius: '8px', outline: 'none' }}
            >
              <option value="">📁 Pessoal / Geral</option>
              {contexts.map(ctx => <option key={ctx.id} value={ctx.id}>🏢 {ctx.name}</option>)}
            </select>

            <button onClick={() => setIsTaskModalOpen(true)} style={{ backgroundColor: '#0070f3', color: '#fff', border: 'none', padding: '0.7rem 1.3rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>📅 Gerar Tarefa</button>
            <button onClick={handleSaveAndExit} style={{ backgroundColor: '#198754', color: '#fff', border: 'none', padding: '0.7rem 1.6rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>💾 Sair</button>
          </div>

          {/* BARRA DE FERRAMENTAS */}
          <div style={{ padding: '0.6rem 1.5rem', backgroundColor: '#181818', borderBottom: '1px solid #222', display: 'flex', gap: '0.6rem', alignItems: 'center', overflowX: 'auto' }}>
            <select defaultValue="p" onChange={(e) => execCmd('formatBlock', e.target.value)} style={{ backgroundColor: '#262626', color: '#fff', border: 'none', padding: '0.4rem', borderRadius: '4px', outline: 'none' }}>
              <option value="p">Texto Normal</option>
              <option value="H1">Título 1 (Gigante)</option>
              <option value="H2">Título 2 (Grande)</option>
              <option value="H3">Título 3 (Médio)</option>
            </select>

            <div style={{ width: '1px', backgroundColor: '#333', height: '20px', margin: '0 5px' }} />

            <button onClick={() => execCmd('bold')} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#262626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><b>B</b></button>
            <button onClick={() => execCmd('italic')} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#262626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><i>I</i></button>
            <button onClick={() => execCmd('underline')} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#262626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><u>U</u></button>
            
            <div style={{ width: '1px', backgroundColor: '#333', height: '20px', margin: '0 5px' }} />

            <button onClick={() => execCmd('insertUnorderedList')} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#262626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>• Lista</button>
            <button onClick={() => execCmd('insertOrderedList')} style={{ padding: '0.4rem 0.8rem', backgroundColor: '#262626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>1. Lista</button>
            
            <div style={{ width: '1px', backgroundColor: '#333', height: '20px', margin: '0 5px' }} />

            <select defaultValue="1.6" onChange={(e) => { setLineHeight(e.target.value); triggerAutoSave(); }} style={{ backgroundColor: '#262626', color: '#fff', border: 'none', padding: '0.4rem', borderRadius: '4px', outline: 'none' }}>
              <option value="1.2">Espaçamento Curto</option>
              <option value="1.6">Normal</option>
              <option value="2.2">Espaçamento Largo</option>
            </select>

            <div style={{ display: 'flex', gap: '0.3rem', marginLeft: 'auto' }}>
              <button onClick={() => insertEmoji('🎯')} style={{ padding: '0.4rem', border: 'none', background: 'none', cursor: 'pointer' }}>🎯</button>
              <button onClick={() => insertEmoji('✅')} style={{ padding: '0.4rem', border: 'none', background: 'none', cursor: 'pointer' }}>✅</button>
              <button onClick={() => insertEmoji('⚠️')} style={{ padding: '0.4rem', border: 'none', background: 'none', cursor: 'pointer' }}>⚠️</button>
            </div>
          </div>

          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* SUMÁRIO */}
            <aside style={{ width: '250px', backgroundColor: '#181818', borderRight: '1px solid #222', padding: '1.5rem', overflowY: 'auto' }}>
              <h5 style={{ color: '#666', textTransform: 'uppercase', fontSize: '0.75rem', marginBottom: '1.5rem', letterSpacing: '1px' }}>Índice do Doc</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {summary.length === 0 ? <p style={{ fontSize: '0.8rem', color: '#444' }}>Formate textos como H1 ou H2 para gerar o índice.</p> : summary.map((s, i) => (
                  <div key={i} style={{ fontSize: '0.85rem', color: '#aaa', paddingLeft: s.level === 'H2' ? '1rem' : s.level === 'H3' ? '1.5rem' : '0' }}>• {s.text}</div>
                ))}
              </div>
            </aside>

            {/* FOLHA BRANCA */}
            <main style={{ flex: 1, overflowY: 'auto', padding: '3rem 1rem', display: 'flex', justifyContent: 'center' }}>
              <div 
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning={true}
                onInput={handleEditorInput}
                style={{ 
                  width: '100%', maxWidth: '850px', backgroundColor: '#fff', padding: '5rem', 
                  color: '#000', fontSize: '1.15rem', lineHeight: lineHeight, outline: 'none', minHeight: '1000px',
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