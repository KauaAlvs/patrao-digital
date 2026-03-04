'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Swal from 'sweetalert2';
import PageLoader from '../../components/PageLoader';

const swalDark = Swal.mixin({
  background: '#121212', color: '#ffffff', confirmButtonColor: '#0070f3', cancelButtonColor: '#333',
  customClass: { popup: 'rounded-2xl', input: 'bg-[#1e1e1e] text-white border-gray-700 outline-none p-3 rounded-xl' }
});

const swalLight = Swal.mixin({
  background: '#ffffff', color: '#000000', confirmButtonColor: '#0070f3',
  customClass: { popup: 'rounded-xl shadow-2xl' }
});

export default function FinanceiroPro() {
  const [view, setView] = useState('dashboard'); 
  const [transactions, setTransactions] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [allSavings, setAllSavings] = useState(0); 
  
  const [settings, setSettings] = useState({ dream_title: 'Meu Sonho', dream_goal: 5000 });
  const [activeSalary, setActiveSalary] = useState(0); 
  const [isLoading, setIsLoading] = useState(true);
  
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  async function fetchData() {
    setIsLoading(true);
    
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const monthYearStr = `${year}-${month}`;
    
    const firstDay = new Date(year, currentDate.getMonth(), 1).toISOString();
    const lastDay = new Date(year, currentDate.getMonth() + 1, 0).toISOString();

    const [transRes, savingsRes, fixedRes, configRes, salaryHistoryRes] = await Promise.all([
      supabase.from('transactions').select('*').gte('due_date', firstDay).lte('due_date', lastDay).order('due_date', { ascending: true }),
      supabase.from('transactions').select('amount').eq('type', 'savings'),
      supabase.from('fixed_expenses').select('*').order('due_day'),
      supabase.from('financial_settings').select('*').eq('id', 1).single(),
      supabase.from('monthly_salaries').select('amount').lte('month_year', monthYearStr).order('month_year', { ascending: false }).limit(1)
    ]);

    if (transRes.data) setTransactions(transRes.data);
    if (fixedRes.data) setFixedExpenses(fixedRes.data);
    if (configRes.data) setSettings(configRes.data);
    
    if (salaryHistoryRes.data && salaryHistoryRes.data.length > 0) {
      setActiveSalary(Number(salaryHistoryRes.data[0].amount));
    } else {
      setActiveSalary(0);
    }

    if (savingsRes.data) {
      const totalGuardado = savingsRes.data.reduce((acc, curr) => acc + Number(curr.amount), 0);
      setAllSavings(totalGuardado);
    }
    
    setTimeout(() => setIsLoading(false), 400);
  }

  const monthExtraIncome = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const monthVariableExpense = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const monthSavings = transactions.filter(t => t.type === 'savings').reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalFixedExpense = fixedExpenses.reduce((acc, curr) => acc + Number(curr.amount), 0);
  
  const totalReceitas = activeSalary + monthExtraIncome;
  const totalDespesas = monthVariableExpense + totalFixedExpense + monthSavings; 
  const saldoLivre = totalReceitas - totalDespesas;
  const dreamProgress = Math.min((allSavings / Number(settings.dream_goal)) * 100, 100) || 0;

  const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const openReport = () => {
    swalLight.fire({
      html: `
        <div style="text-align:center; padding: 10px;">
          <h2 style="margin:0; font-size:1.8rem; font-weight: 800; letter-spacing: -1px;">PATRÃO<span style="color:#0070f3">DIGITAL</span></h2>
          <p style="font-size:0.8rem; color:#666; text-transform:uppercase; margin-top: 5px;">Relatório Financeiro • ${currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</p>
          <hr style="border:0; border-top: 1px dashed #ccc; margin: 20px 0;" />
          <div style="text-align:left; font-size:0.95rem; line-height:2;">
            <div style="display:flex; justify-content:space-between;"><strong>Salário Base (Mês):</strong> <span>${formatCurrency(activeSalary)}</span></div>
            <div style="display:flex; justify-content:space-between; color:#22c55e;"><strong>Entradas Extras:</strong> <span>+ ${formatCurrency(monthExtraIncome)}</span></div>
            <div style="display:flex; justify-content:space-between; color:#eab308;"><strong>Despesas Fixas:</strong> <span>- ${formatCurrency(totalFixedExpense)}</span></div>
            <div style="display:flex; justify-content:space-between; color:#ff4d4f;"><strong>Despesas Variáveis:</strong> <span>- ${formatCurrency(monthVariableExpense)}</span></div>
            <div style="display:flex; justify-content:space-between; color:#0070f3;"><strong>Movimentado no Cofre:</strong> <span>${formatCurrency(monthSavings)}</span></div>
          </div>
          <hr style="border:0; border-top: 1px dashed #ccc; margin: 20px 0;" />
          <div style="text-align:left; background-color: #f4f4f5; padding: 15px; border-radius: 12px;">
            <p style="margin:0; font-size:0.8rem; color:#666; text-transform:uppercase; font-weight:bold;">Saldo Livre Final</p>
            <h3 style="margin:5px 0 0 0; font-size: 2rem; color:${saldoLivre >= 0 ? '#0070f3' : '#ff4d4f'}">${formatCurrency(saldoLivre)}</h3>
          </div>
        </div>
      `,
      showConfirmButton: true,
      confirmButtonText: 'Fechar Relatório',
      width: '400px'
    });
  };

  // === NOVO MODAL: EXTRATO DETALHADO DO MÊS ===
  const openExtratoModal = () => {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();

    // Junta as variáveis e extras
    const listTrans = transactions.filter(t => t.type !== 'savings').map(t => ({
      title: t.title, amount: Number(t.amount), type: t.type, dateObj: new Date(t.due_date), isFixed: false
    }));

    // Injeta as contas fixas projetando para o mês atual
    const listFixed = fixedExpenses.map(f => {
      const d = new Date(y, m, f.due_day);
      return { title: `${f.title} (Fixa)`, amount: Number(f.amount), type: 'expense', dateObj: d, isFixed: true };
    });

    // Ordena tudo do dia 1 ao 31
    const fullList = [...listTrans, ...listFixed].sort((a, b) => a.dateObj - b.dateObj);

    let htmlContent = `
      <div style="text-align:left; font-family:sans-serif;">
        <div style="text-align:center; margin-bottom: 20px;">
          <h2 style="margin:0; font-size:1.5rem; font-weight:800;">Extrato do Mês</h2>
          <p style="margin:5px 0 0 0; font-size:0.85rem; color:#666; text-transform:uppercase;">${currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</p>
        </div>
        <div style="max-height: 400px; overflow-y: auto; padding-right: 10px; border-top: 1px solid #eee; padding-top: 10px;">
    `;

    if (fullList.length === 0) {
      htmlContent += `<p style="text-align:center; color:#888; margin: 20px 0;">Nenhum lançamento encontrado.</p>`;
    } else {
      fullList.forEach(item => {
        const color = item.type === 'income' ? '#22c55e' : '#ff4d4f';
        const sign = item.type === 'income' ? '+' : '-';
        const dateStr = item.dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        
        htmlContent += `
          <div style="display:flex; justify-content:space-between; padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
            <div>
              <div style="font-weight:bold; color:#222; font-size: 0.95rem;">${item.title}</div>
              <div style="font-size:0.75rem; color:#888; margin-top:3px;">Data: ${dateStr}</div>
            </div>
            <div style="font-weight:bold; color:${color}; text-align:right; display:flex; align-items:center;">
              ${sign} ${formatCurrency(item.amount)}
            </div>
          </div>
        `;
      });
    }

    htmlContent += `</div></div>`;

    swalLight.fire({ html: htmlContent, showConfirmButton: true, confirmButtonText: 'Fechar Extrato', width: '450px' });
  };

  const handleUpdateSalary = async () => {
    const monthName = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    const { value: newSalary } = await swalDark.fire({
      title: '💰 Atualizar Salário',
      input: 'number',
      inputLabel: `Novo salário a partir de ${monthName}:`,
      inputValue: activeSalary || '',
      showCancelButton: true,
      confirmButtonText: 'Aplicar'
    });
    
    if (newSalary) {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const monthYearStr = `${year}-${month}`;
      await supabase.from('monthly_salaries').upsert({ month_year: monthYearStr, amount: Number(newSalary) });
      swalDark.fire({ title: 'Salário Atualizado!', text: 'Aplicado para este mês em diante.', icon: 'success', timer: 2000, showConfirmButton: false });
      fetchData();
    }
  };

  const handleUpdateDream = async () => {
    const { value: formValues } = await swalDark.fire({
      title: '🎯 Configurar Sonho',
      html: `
        <label style="color:#aaa; font-size:0.8rem; display:block; text-align:left; margin-bottom:5px;">Qual é o seu objetivo?</label>
        <input id="d-title" class="swal2-input" value="${settings.dream_title}">
        <label style="color:#aaa; font-size:0.8rem; display:block; text-align:left; margin-top:15px; margin-bottom:5px;">Qual o valor total necessário?</label>
        <input id="d-goal" type="number" class="swal2-input" value="${settings.dream_goal}">
      `,
      focusConfirm: false, showCancelButton: true, confirmButtonText: 'Salvar',
      preConfirm: () => ({ title: document.getElementById('d-title').value, goal: document.getElementById('d-goal').value })
    });
    if (formValues?.title && formValues?.goal) {
      await supabase.from('financial_settings').upsert({ id: 1, dream_title: formValues.title, dream_goal: Number(formValues.goal) });
      fetchData();
    }
  };

  const handlePeDeMeia = async () => {
    const { value: amount } = await swalDark.fire({
      title: '🐷 Guardar Dinheiro',
      input: 'number',
      inputLabel: `Quanto transferir para "${settings.dream_title}" neste mês?`,
      showCancelButton: true, confirmButtonText: 'Guardar'
    });
    if (amount) {
      await supabase.from('transactions').insert([{ title: `Depósito: ${settings.dream_title}`, amount: Number(amount), type: 'savings', status: 'paid', due_date: new Date().toISOString() }]);
      swalDark.fire({ title: 'Guardado!', icon: 'success', timer: 1500, showConfirmButton: false });
      fetchData();
    }
  };

  const handleResgatarPeDeMeia = async () => {
    const { value: amount } = await swalDark.fire({
      title: '🔄 Resgatar Dinheiro',
      input: 'number',
      inputLabel: `Quanto retirar do cofre? (Saldo Total: ${formatCurrency(allSavings)})`,
      showCancelButton: true, confirmButtonText: 'Resgatar', confirmButtonColor: '#ff4d4f'
    });
    if (amount) {
      if (Number(amount) > allSavings) { swalDark.fire('Erro', 'Você não tem esse valor guardado!', 'error'); return; }
      await supabase.from('transactions').insert([{ title: `Resgate: ${settings.dream_title}`, amount: -Math.abs(Number(amount)), type: 'savings', status: 'paid', due_date: new Date().toISOString() }]);
      swalDark.fire({ title: 'Valor Resgatado!', text: 'Voltou para o Saldo Livre.', icon: 'success', timer: 2000, showConfirmButton: false });
      fetchData();
    }
  };

  const openTransactionModal = async (type) => {
    const isIncome = type === 'income';
    const { value: formValues } = await swalDark.fire({
      title: isIncome ? '➕ Nova Entrada' : '➖ Nova Despesa',
      html: `
        <input id="swal-title" class="swal2-input" placeholder="Descrição">
        <input id="swal-amount" type="number" step="0.01" class="swal2-input" placeholder="Valor R$">
        <input id="swal-date" type="date" class="swal2-input" value="${new Date().toISOString().split('T')[0]}">
      `,
      focusConfirm: false, showCancelButton: true, confirmButtonText: 'Lançar', confirmButtonColor: isIncome ? '#22c55e' : '#ff4d4f',
      preConfirm: () => ({ title: document.getElementById('swal-title').value, amount: document.getElementById('swal-amount').value, due_date: document.getElementById('swal-date').value })
    });
    if (formValues?.title && formValues?.amount) {
      await supabase.from('transactions').insert([{ ...formValues, type, amount: Number(formValues.amount), status: 'pending' }]);
      swalDark.fire({ title: 'Lançado!', icon: 'success', timer: 1500, showConfirmButton: false });
      fetchData();
    }
  };

  const deleteItem = async (table, id) => {
    const { isConfirmed } = await swalDark.fire({ title: 'Apagar?', icon: 'warning', showCancelButton: true });
    if (isConfirmed) { await supabase.from(table).delete().eq('id', id); fetchData(); }
  };

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    await supabase.from('transactions').update({ status: newStatus }).eq('id', id);
    fetchData();
  };

  return (
    <div style={{ backgroundColor: 'transparent', minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif', paddingBottom: '3rem' }}>
      
      {/* HEADER LIMPO */}
      <div style={{ padding: '2rem 1.5rem 1rem 1.5rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: '800', margin: 0, letterSpacing: '-1px' }}>TESOURARIA</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginTop: '0.5rem' }}>
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}>❮</button>
                <span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '1rem', color: '#0070f3' }}>
                  {currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}>❯</button>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
              <button onClick={openReport} style={topBtnStyle('#fff', '#000')}>📊 Relatório</button>
              <button onClick={handleUpdateSalary} style={topBtnStyle('#222', '#fff')}>💰 Ajustar Salário</button>
            </div>
          </div>

          <nav style={{ display: 'flex', gap: '1.5rem', overflowX: 'auto', borderBottom: '2px solid #222', paddingBottom: '0.5rem' }}>
            <button onClick={() => setView('dashboard')} style={tabStyle(view === 'dashboard')}>🏠 Dashboard</button>
            <button onClick={() => setView('transactions')} style={tabStyle(view === 'transactions')}>💸 Entradas & Saídas</button>
            <button onClick={() => setView('fixed')} style={tabStyle(view === 'fixed')}>📋 Contas Fixas</button>
          </nav>
        </div>
      </div>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {isLoading ? (
          <PageLoader text="Sincronizando Tesouraria..." icon="💸" />
        ) : (
          <>
            {view === 'dashboard' && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <div className="top-cards-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  
                  <div style={{ backgroundColor: '#111', borderRadius: '24px', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <p style={{ color: '#888', margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 'bold' }}>SALDO LIVRE PROJETADO</p>
                    <h2 style={{ fontSize: '3.5rem', margin: 0, color: saldoLivre >= 0 ? '#0070f3' : '#ff4d4f', letterSpacing: '-2px' }}>{formatCurrency(saldoLivre)}</h2>
                    <p style={{ fontSize: '0.85rem', color: '#555', marginTop: '0.5rem' }}>O que sobra após pagar as contas e guardar dinheiro.</p>
                  </div>

                  <div style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%)', borderRadius: '24px', padding: '2rem', border: '1px solid #333' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ margin: 0, color: '#eab308', fontWeight: 'bold', fontSize: '0.8rem', letterSpacing: '1px' }}>🎯 {settings.dream_title}</p>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <span style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#fff', lineHeight: '1' }}>{formatCurrency(allSavings)}</span>
                          <span style={{ color: '#888', fontSize: '0.9rem', marginBottom: '4px' }}>/ {formatCurrency(settings.dream_goal)}</span>
                        </div>
                      </div>
                      <button onClick={handleUpdateDream} style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.2rem', cursor: 'pointer' }}>⚙️</button>
                    </div>

                    <div style={{ width: '100%', height: '12px', backgroundColor: '#222', borderRadius: '10px', marginTop: '1.5rem', overflow: 'hidden' }}>
                      <div style={{ width: `${dreamProgress}%`, height: '100%', background: 'linear-gradient(90deg, #eab308 0%, #facc15 100%)', transition: 'width 1s ease-in-out', borderRadius: '10px' }}></div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
                      <button onClick={handlePeDeMeia} style={{ backgroundColor: '#eab308', color: '#000', border: 'none', padding: '0.6rem 1rem', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', flex: 1, marginRight: '0.5rem' }}>🐷 GUARDAR</button>
                      <button onClick={handleResgatarPeDeMeia} style={{ backgroundColor: '#222', color: '#ff4d4f', border: '1px solid #ff4d4f', padding: '0.6rem 1rem', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', flex: 1, marginLeft: '0.5rem' }}>🔄 RESGATAR</button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                  <Card icon="💰" label="Salário do Mês" value={formatCurrency(activeSalary)} color="#fff" />
                  <Card icon="🚀" label="Extras do Mês" value={formatCurrency(monthExtraIncome)} color="#22c55e" />
                  <Card icon="📉" label="Gastos Variáveis" value={formatCurrency(monthVariableExpense)} color="#ff4d4f" />
                  <Card icon="🏠" label="Contas Fixas" value={formatCurrency(totalFixedExpense)} color="#eab308" />
                </div>

                {/* BOTÃO EXTRATO DETALHADO */}
                <button onClick={openExtratoModal} style={{ width: '100%', marginTop: '2rem', padding: '1.2rem', backgroundColor: '#111', color: '#fff', border: '1px solid #333', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                  📄 Abrir Extrato Completo do Mês
                </button>
              </div>
            )}

            {view === 'transactions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
                 <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button onClick={() => openTransactionModal('income')} style={btnStyle('#22c55e', '#000')}>➕ CADASTRAR ENTRADA</button>
                    <button onClick={() => openTransactionModal('expense')} style={btnStyle('#ff4d4f', '#fff')}>➖ CADASTRAR DESPESA</button>
                 </div>
                 
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                   {transactions.filter(t => t.type !== 'savings').map(t => (
                     <div key={t.id} style={{ padding: '1.5rem', backgroundColor: '#111', borderRadius: '20px', borderLeft: `4px solid ${t.type === 'income' ? '#22c55e' : '#ff4d4f'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: t.status === 'paid' ? 0.6 : 1 }}>
                        <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
                          <button onClick={() => toggleStatus(t.id, t.status)} style={{ width: '30px', height: '30px', borderRadius: '8px', border: `2px solid ${t.type === 'income' ? '#22c55e' : '#ff4d4f'}`, backgroundColor: t.status === 'paid' ? (t.type === 'income' ? '#22c55e' : '#ff4d4f') : 'transparent', color: t.type === 'income' ? '#000' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {t.status === 'paid' && '✓'}
                          </button>
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', textDecoration: t.status === 'paid' ? 'line-through' : 'none' }}>{t.title}</div>
                            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '4px' }}>{new Date(t.due_date).toLocaleDateString('pt-BR')}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: t.type === 'income' ? '#22c55e' : '#ff4d4f', fontWeight: 'bold', fontSize: '1.3rem' }}>{t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}</div>
                          <button onClick={() => deleteItem('transactions', t.id)} style={{ border: 'none', background: 'none', color: '#555', fontSize: '0.85rem', cursor: 'pointer', marginTop: '6px' }}>Excluir</button>
                        </div>
                     </div>
                   ))}
                   {transactions.filter(t => t.type !== 'savings').length === 0 && <p style={{ color: '#555', textAlign: 'center', padding: '3rem 0' }}>Nenhum lançamento neste mês.</p>}
                 </div>
              </div>
            )}

            {view === 'fixed' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
                 <button onClick={async () => {
                    const { value: fv } = await swalDark.fire({
                      title: '📋 Conta Fixa', html: `<input id="f-title" class="swal2-input" placeholder="Título"><input id="f-amount" type="number" class="swal2-input" placeholder="Valor"><input id="f-day" type="number" class="swal2-input" placeholder="Dia de vencimento (1-31)">`,
                      preConfirm: () => ({ title: document.getElementById('f-title').value, amount: document.getElementById('f-amount').value, due_day: document.getElementById('f-day').value })
                    });
                    if (fv?.title) {
                      await supabase.from('fixed_expenses').insert([{ ...fv, amount: Number(fv.amount) }]);
                      swalDark.fire('Cadastrado', '', 'success'); fetchData();
                    }
                 }} style={btnStyle('#0070f3', '#fff')}>📋 CADASTRAR NOVA CONTA FIXA</button>
                 
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                   {fixedExpenses.map(f => (
                     <div key={f.id} style={{ padding: '1.5rem', backgroundColor: '#111', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
                          <div style={{ backgroundColor: '#222', padding: '0.6rem 1rem', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 'bold', color: '#eab308' }}>DIA {f.due_day}</div>
                          <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{f.title}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 'bold', color: '#ff4d4f', fontSize: '1.3rem' }}>{formatCurrency(f.amount)}</div>
                          <button onClick={() => deleteItem('fixed_expenses', f.id)} style={{ border: 'none', background: 'none', color: '#555', fontSize: '0.85rem', cursor: 'pointer', marginTop: '6px' }}>Excluir</button>
                        </div>
                     </div>
                   ))}
                   {fixedExpenses.length === 0 && <p style={{ color: '#555', textAlign: 'center', padding: '3rem 0' }}>Nenhuma conta fixa cadastrada.</p>}
                 </div>
              </div>
            )}
          </>
        )}
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 768px) {
          .top-cards-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function Card({ icon, label, value, color }) {
  return (
    <div style={{ backgroundColor: '#111', padding: '1.8rem', borderRadius: '24px', border: '1px solid #222' }}>
      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{icon}</div>
      <p style={{ color: '#777', fontSize: '0.85rem', margin: 0, fontWeight: 'bold', textTransform: 'uppercase' }}>{label}</p>
      <h3 style={{ fontSize: '1.6rem', margin: '0.3rem 0 0 0', color: color }}>{value}</h3>
    </div>
  );
}

const tabStyle = (isActive) => ({
  background: 'none', border: 'none', padding: '0.5rem 0',
  color: isActive ? '#fff' : '#666', fontWeight: isActive ? 'bold' : 'normal',
  borderBottom: isActive ? '3px solid #0070f3' : '3px solid transparent',
  cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '1rem', transition: 'all 0.2s'
});

const topBtnStyle = (bg, color) => ({
  backgroundColor: bg, color: color, border: 'none', padding: '0.8rem 1.2rem',
  borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem',
  boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
});

const btnStyle = (bg, color) => ({
  backgroundColor: bg, color: color, border: 'none', padding: '1.2rem',
  borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem',
  flex: 1, boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
});