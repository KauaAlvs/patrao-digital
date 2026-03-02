import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request) {
  try {
    // 1. Inicializa o Firebase Admin
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }

    // 2. Busca os Tokens (Dispositivos)
    const { data: tokensData } = await supabase.from('user_tokens').select('token');
    if (!tokensData || tokensData.length === 0) return NextResponse.json({ message: 'Sem tokens cadastrados.' });
    const tokens = tokensData.map(t => t.token);

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const inFiveDaysMidnight = todayMidnight + (5 * 24 * 60 * 60 * 1000);

    // =========================================================
    // 3. MOTOR FAXINEIRO (Reset + Isolamento de Dívida)
    // =========================================================
    const { data: routineGoals } = await supabase.from('goals').select('*').eq('goal_type', 'routine');
    
    for (const g of (routineGoals || [])) {
      const lastReset = new Date(g.last_reset_date || g.created_at);
      const rType = g.routine_type || g.frequency;
      let needsReset = false;

      if (rType === 'weekly') {
        const nextMonday = new Date(lastReset);
        nextMonday.setDate(lastReset.getDate() + ((1 + 7 - lastReset.getDay()) % 7 || 7));
        nextMonday.setHours(0, 0, 0, 0);
        if (now >= nextMonday) needsReset = true;
      } 
      else if (rType === 'monthly') {
        const nextMonth = new Date(lastReset.getFullYear(), lastReset.getMonth() + 1, 1);
        if (now >= nextMonth) needsReset = true;
      }
      else if (rType === 'specific_day' && g.routine_config?.day) {
        let nextTarget = new Date(lastReset.getFullYear(), lastReset.getMonth(), g.routine_config.day);
        if (now.getDate() >= g.routine_config.day) nextTarget.setMonth(nextTarget.getMonth() + 1);
        if (now >= nextTarget) needsReset = true;
      }

      if (needsReset) {
        const faltam = g.target_amount - g.current_amount;
        if (faltam > 0) {
          await supabase.from('activities').insert([{
            title: `[PENDENTE] ${g.title}`,
            description: `Saldo não concluído do ciclo anterior. Faltaram ${faltam} de ${g.target_amount} unidades no fechamento do ciclo.`,
            scheduled_for: now.toISOString(),
            status: 'pending',
            context_id: g.context_id
          }]);
        }
        await supabase.from('goals').update({ 
          current_amount: 0, 
          status: 'in_progress', 
          last_reset_date: now.toISOString() 
        }).eq('id', g.id);
      }
    }

    // =========================================================
    // 4. CÉREBRO ANALÍTICO (Classificação e Prioridades)
    // =========================================================
    const { data: activities } = await supabase.from('activities').select('*').eq('status', 'pending');
    const { data: allGoals } = await supabase.from('goals').select('*').eq('status', 'in_progress');

    const getDeadlineTime = (g) => {
      if (g.goal_type === 'single') return g.deadline ? new Date(g.deadline).getTime() : null;
      const d = new Date(now);
      const rType = g.routine_type || g.frequency;
      if (rType === 'weekly') {
        const diff = d.getDay() <= 5 ? 5 - d.getDay() : 6;
        d.setDate(d.getDate() + diff);
        return d.setHours(23, 59, 59, 999);
      }
      if (rType === 'monthly') {
        return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime();
      }
      return null;
    };

    let atrasos = []; 
    let hoje = []; 
    let radar = []; 

    // === CORREÇÃO AQUI: Analisa Atividades do Futuro ===
    (activities || []).forEach(act => {
      const time = new Date(act.scheduled_for).setHours(0,0,0,0);
      if (time < todayMidnight) {
        atrasos.push({ title: act.title, type: 'task' });
      } 
      else if (time === todayMidnight) {
        hoje.push(act);
      } 
      else if (time > todayMidnight && time <= inFiveDaysMidnight) {
        // Agora as atividades dos próximos 5 dias entram no radar!
        radar.push({ title: act.title, endTime: time, isActivity: true });
      }
    });

    // Analisa Metas
    (allGoals || []).forEach(g => {
      const deadline = getDeadlineTime(g);
      const faltam = g.target_amount - g.current_amount;

      if (g.goal_type === 'single' && deadline && deadline < todayMidnight) {
        atrasos.push({ title: g.title, type: 'goal' });
      } 
      else if (faltam > 0 && deadline && deadline >= todayMidnight && deadline <= inFiveDaysMidnight) {
        radar.push({ title: g.title, faltam, endTime: deadline, isWeekly: g.routine_type === 'weekly' });
      }
    });

    // =========================================================
    // 5. MOTOR DE DECISÃO (A Voz da Secretária Digital)
    // =========================================================
    let titulo = '';
    let corpo = '';

    if (atrasos.length > 0) {
      titulo = '🚨 Alerta de Gargalo!';
      corpo = `Patrão, você tem ${atrasos.length} pendência(s) acumulada(s). Foco total em: "${atrasos[0].title}". Vamos limpar isso hoje?`;
    } 
    else if (radar.length > 0) {
      radar.sort((a, b) => a.endTime - b.endTime);
      const item = radar[0];
      const dias = Math.round((item.endTime - todayMidnight) / (1000 * 60 * 60 * 24));
      
      titulo = '⏳ Radar de Prazos';
      
      // === CORREÇÃO AQUI: Fala diferente se for Tarefa da Agenda ou Meta ===
      if (item.isActivity) {
        const tempoMsg = dias === 1 ? 'AMANHÃ' : `daqui a ${dias} dias`;
        corpo = `A atividade "${item.title}" está marcada para ${tempoMsg}. Antecipe-se!`;
      } else {
        const tempoMsg = item.isWeekly 
          ? (dias === 0 ? 'HOJE (Sexta-feira)!' : `em ${dias} dia(s), na Sexta.`)
          : (dias === 0 ? 'HOJE!' : `em ${dias} dia(s).`);
        corpo = `A meta "${item.title}" expira ${tempoMsg} Ainda restam ${item.faltam} unidades. Não deixe acumular!`;
      }

      if (hoje.length > 0) corpo += ` (Lembrando: você tem ${hoje.length} tarefas hoje).`;
    } 
    else if (hoje.length > 0) {
      titulo = '⚡ Foco do Dia';
      corpo = `Você tem ${hoje.length} compromisso(s) na agenda hoje. Começando por: "${hoje[0].title}".`;
    } 
    else {
      titulo = '🛡️ Tudo sob Controle';
      corpo = 'Nenhum atraso ou meta urgente detectada para os próximos 5 dias. Ótimo momento para prospectar ou planejar.';
    }

    // 6. DISPARO E LIMPEZA DE TOKENS MORTOS
    const finalMessage = { notification: { title: titulo, body: corpo }, tokens: tokens };
    const response = await admin.messaging().sendEachForMulticast(finalMessage);
    
    const tokensToRemove = [];
    response.responses.forEach((res, idx) => {
      if (!res.success && (res.error.code === 'messaging/invalid-registration-token' || res.error.code === 'messaging/registration-token-not-registered')) {
        tokensToRemove.push(tokens[idx]); 
      }
    });

    if (tokensToRemove.length > 0) {
      await supabase.from('user_tokens').delete().in('token', tokensToRemove);
    }

    return NextResponse.json({ 
      success: true, 
      resumo: corpo,
      enviados: response.successCount,
      faxina_tokens: tokensToRemove.length
    });

  } catch (error) {
    console.error("Erro na Secretária:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}