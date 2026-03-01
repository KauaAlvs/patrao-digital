import { useState } from 'react';

export default function ActivityForm({ contexts, onAddActivity }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contextId, setContextId] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddActivity({ title, description, contextId, scheduledFor });
    setTitle('');
    setDescription('');
    setContextId('');
    setScheduledFor('');
  };

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: '#2d2d2d',
    color: '#ffffff',
    border: '1px solid #444',
    borderRadius: '6px',
    marginTop: '0.5rem',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  };

  return (
    <section style={{ padding: '1.5rem', backgroundColor: '#1e1e1e', border: '1px solid #333', borderRadius: '12px' }}>
      <h2 style={{ marginTop: 0, color: '#ffffff', marginBottom: '1.5rem' }}>Nova Atividade</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <label style={{ color: '#e0e0e0', fontWeight: '500' }}>
          Título:
          <input 
            type="text" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            required 
            style={inputStyle} 
            placeholder="Ex: Reunião de Alinhamento"
          />
        </label>
        
        <label style={{ color: '#e0e0e0', fontWeight: '500' }}>
          Descrição / Bloco de Notas:
          <textarea 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
            placeholder="Detalhes da atividade..."
          />
        </label>

        <label style={{ color: '#e0e0e0', fontWeight: '500' }}>
          Contexto (Vínculo):
          <select 
            value={contextId} 
            onChange={(e) => setContextId(e.target.value)}
            style={inputStyle}
          >
            <option value="">Selecione um contexto...</option>
            {contexts.map(ctx => (
              <option key={ctx.id} value={ctx.id}>{ctx.name}</option>
            ))}
          </select>
        </label>

        <label style={{ color: '#e0e0e0', fontWeight: '500' }}>
          Data e Hora:
          <input 
            type="datetime-local" 
            value={scheduledFor} 
            onChange={(e) => setScheduledFor(e.target.value)} 
            required 
            style={inputStyle} 
          />
        </label>

        <button type="submit" style={{ padding: '0.8rem', cursor: 'pointer', backgroundColor: '#0070f3', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '1rem', marginTop: '0.5rem', transition: 'background-color 0.2s' }}>
          Agendar Atividade
        </button>
      </form>
    </section>
  );
}