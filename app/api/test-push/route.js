import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';

// Conecta no seu Supabase usando as chaves que você já tem na Vercel/Ambiente
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request) {
  try {
    // 1. Inicializa o Megafone do Google (Firebase Admin) de forma segura
    if (!admin.apps.length) {
      // Pega o JSON do cofre da Vercel e transforma em objeto
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    // 2. Busca os números de telefone (Tokens) salvos na sua tabela
    const { data: tokensData, error } = await supabase.from('user_tokens').select('token');
    
    if (error || !tokensData || tokensData.length === 0) {
      return NextResponse.json({ message: 'Nenhum token encontrado. Ninguém para avisar.' }, { status: 400 });
    }

    // Extrai só os códigos limpos
    const tokens = tokensData.map(t => t.token);

    // 3. A Mensagem que vai chegar no seu celular!
    const message = {
      notification: {
        title: '🔥 Patrão Digital Online!',
        body: 'Seu sistema de notificações está funcionando com maestria.',
      },
      tokens: tokens, // Manda para todos os seus aparelhos cadastrados de uma vez
    };

    // 4. Aperta o gatilho!
    const response = await admin.messaging().sendEachForMulticast(message);

    return NextResponse.json({ 
      success: true, 
      message: 'Sinal disparado com sucesso!',
      enviados: response.successCount
    });

  } catch (error) {
    console.error("Erro no motor de push:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}