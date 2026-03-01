import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request) {
  try {
    // 1. Inicializa o Firebase
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }

    // 2. Busca os Tokens (Aparelhos)
    const { data: tokensData } = await supabase.from('user_tokens').select('token');
    if (!tokensData || tokensData.length === 0) return NextResponse.json({ message: 'Sem tokens.' });
    const tokens = tokensData.map(t => t.token);

    // 3. Puxa Atividades e Metas
    const { data: activities } = await supabase.from('activities').select('*').eq('status', 'pending');
    const { data: goals } = await supabase.from('goals').select('*').eq('status', 'in_progress');

    // Zerando as horas para cálculo perfeito de "Dias Restantes"
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const inFiveDaysMidnight = todayMidnight + (5 * 24 * 60 * 60 * 1000); 

    // === LÓGICA DE FIM DE CICLO (O Segredo da Sexta-Feira) ===
    const getCycleEnd = (g, currentDate) => {
      if (g.goal_type === 'single') return g.deadline ? new Date(g.deadline).getTime() : null;
      
      const d = new Date(currentDate);
      const rType = g.routine_type || g.frequency;
      
      if (rType === 'weekly') {
        const day = d.getDay(); // 0 = Dom, 1 = Seg, 5 = Sex
        let diffToFriday = day <= 5 ? 5 - day : 6; // Se for sábado (6), a próxima sexta é em 6 dias
        d.setDate(d.getDate() + diffToFriday);
        d.setHours(23, 59, 59, 999);
        return d.getTime();
      }
      if (rType === 'monthly') {
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        lastDay.setHours(23, 59, 59, 999);
        return lastDay.getTime();
      }
      if (rType === 'specific_day' && g.routine_config?.day) {
        let target = new Date(d.getFullYear(), d.getMonth(), g.routine_config.day);
        if (d.getDate() > g.routine_config.day) target.setMonth(target.getMonth() + 1);
        target.setHours(23, 59, 59, 999);
        return target.getTime();
      }
      return null; // Ranges e outros casos caem aqui
    };

    let atrasadas = [];
    let hoje = [];
    let metasNoRadar = []; // Aqui entram as metas que faltam pouco para acabar

    // 4A. Analisa Atividades Comuns
    (activities || []).forEach(act => {
      const actTime = new Date(act.scheduled_for).setHours(0,0,0,0);
      if (actTime < todayMidnight) atrasadas.push(act);
      else if (actTime === todayMidnight) hoje.push(act);
    });

    // 4B. Analisa Metas e Rotinas Cíclicas (O Motor Analítico)
    (goals || []).forEach(g => {
      const cycleEnd = getCycleEnd(g, now);
      if (!cycleEnd) return;

      const faltam = g.target_amount - g.current_amount;
      
      // Se a meta acaba nos próximos 5 dias E você ainda não concluiu
      if (faltam > 0 && cycleEnd >= todayMidnight && cycleEnd <= inFiveDaysMidnight) {
        metasNoRadar.push({
          title: g.title,
          feitos: g.current_amount,
          total: g.target_amount,
          faltam: faltam,
          endTime: cycleEnd,
          isWeekly: g.routine_type === 'weekly'
        });
      }
    });

    // Ordena para avisar primeiro do que vence antes
    metasNoRadar.sort((a, b) => a.endTime - b.endTime);

    // Função auxiliar de dias
    const calcularDias = (dataFutura) => Math.round((new Date(dataFutura).setHours(0,0,0,0) - todayMidnight) / (1000 * 60 * 60 * 24));

    // 5. MOTOR DE DECISÃO (A Fala da Secretária)
    let titulo = '';
    let corpo = '';

    if (atrasadas.length > 0) {
      titulo = '🚨 Alerta de Gargalo!';
      corpo = `Você tem ${atrasadas.length} pendência(s) acumulada(s) ("${atrasadas[0].title}"). Limpe a mesa antes de puxar novas tarefas.`;
      
    } else if (metasNoRadar.length > 0) {
      // PRIORIDADE MÁXIMA SE NÃO HOUVER ATRASO: Cobrar o que falta nas metas!
      const meta = metasNoRadar[0];
      const dias = calcularDias(meta.endTime);
      
      titulo = '🎯 Gap de Meta Identificado';
      
      let tempoTexto = meta.isWeekly ? (dias === 0 ? 'HOJE (Sexta)!' : `em ${dias} dia(s), na Sexta-feira.`) : (dias === 0 ? 'HOJE!' : `em ${dias} dia(s).`);
      
      corpo = `Na meta "${meta.title}", você já fez ${meta.feitos} de ${meta.total}. Falta concluir ${meta.faltam} alvo(s) para fechar o ciclo ${tempoTexto} Não deixe para a última hora!`;
      
      // Adiciona um extra se tiver atividade solta hoje
      if (hoje.length > 0) {
        corpo += ` (Ah, e você tem ${hoje.length} compromisso(s) avulso(s) marcados para hoje).`;
      }

    } else if (hoje.length > 0) {
      titulo = '⚡ Foco de Hoje';
      corpo = `Você tem ${hoje.length} compromisso(s) na agenda hoje ("${hoje[0].title}"). Execute com excelência.`;
    } else {
      titulo = '🕸️ Radar Limpo';
      corpo = 'Nenhuma meta pendente apertada e agenda livre. Que tal prospectar clientes ou se organizar para a próxima semana?';
    }

    // 6. Prepara e dispara
    const finalMessage = {
      notification: { title: titulo, body: corpo },
      tokens: tokens
    };

    const response = await admin.messaging().sendEachForMulticast(finalMessage);
    
    // Limpeza Automática dos Tokens desinstalados
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
      limpos: tokensToRemove.length
    });

  } catch (error) {
    console.error("Erro na Secretária:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}