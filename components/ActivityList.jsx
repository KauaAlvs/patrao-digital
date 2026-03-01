export default function ActivityList({ activities, onComplete, onDelete }) {
  return (
    <section style={{ padding: '1.5rem', backgroundColor: '#1e1e1e', border: '1px solid #333', borderRadius: '12px' }}>
      <h2 style={{ marginTop: 0, color: '#ffffff', marginBottom: '1.5rem' }}>Próximas Atividades</h2>
      {activities.length === 0 ? (
        <p style={{ color: '#a0a0a0' }}>Sua agenda está livre!</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '1rem', margin: 0 }}>
          {activities.map(act => {
            const isDone = act.status === 'done';
            return (
              <li 
                key={act.id} 
                style={{ 
                  padding: '1.25rem', 
                  borderLeft: `5px solid ${act.contexts?.color_hex || '#555'}`, 
                  backgroundColor: isDone ? '#1a2e1a' : '#2d2d2d', 
                  borderRadius: '8px',
                  opacity: isDone ? 0.6 : 1,
                  border: '1px solid #444',
                  borderLeftWidth: '5px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ margin: 0, color: '#ffffff', textDecoration: isDone ? 'line-through' : 'none', fontSize: '1.1rem' }}>
                    {act.title}
                  </h3>
                  <span style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', backgroundColor: '#444', color: '#e0e0e0', borderRadius: '12px', fontWeight: '500' }}>
                    {act.contexts?.name || 'Sem vínculo'}
                  </span>
                </div>
                <p style={{ margin: '0.75rem 0', color: '#bbbbbb', textDecoration: isDone ? 'line-through' : 'none', fontSize: '0.95rem', lineHeight: '1.4' }}>
                  {act.description || 'Sem descrição.'}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #444' }}>
                  <small style={{ color: '#888888', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🗓 {new Date(act.scheduled_for).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </small>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {!isDone && (
                      <button 
                        onClick={() => onComplete(act.id)}
                        style={{ padding: '0.4rem 0.8rem', cursor: 'pointer', backgroundColor: '#198754', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '0.85rem', fontWeight: '500' }}
                      >
                        ✓ Concluir
                      </button>
                    )}
                    <button 
                      onClick={() => onDelete(act.id)}
                      style={{ padding: '0.4rem 0.8rem', cursor: 'pointer', backgroundColor: '#dc3545', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '0.85rem', fontWeight: '500' }}
                    >
                      🗑 Excluir
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}