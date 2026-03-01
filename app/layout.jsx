import './globals.css'
import Sidebar from '../components/Sidebar'

export const metadata = {
  title: 'Patrão Digital',
  description: 'ERP de Gestão Pessoal e Corporativa',
  themeColor: '#121212',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Patrão',
  },
}

export const viewport = {
  themeColor: '#121212',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Trava o zoom automático do iPhone/Android
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        {/* CORREÇÃO DO PWA: Link forçado para o navegador não ter desculpas */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body>
        <div className="app-layout">
          <Sidebar />
          <main className="app-main">
            {children}
          </main>
        </div>

        {/* MOTOR RESPONSIVO GLOBAL & CORREÇÃO DE MODAIS */}
        <style dangerouslySetInnerHTML={{__html: `
          body { 
            margin: 0; padding: 0; background-color: #121212; color: #fff; 
            font-family: system-ui, -apple-system, sans-serif; overflow: hidden; 
            box-sizing: border-box;
          }
          * { box-sizing: border-box; }
          
          .app-layout { display: flex; height: 100vh; width: 100vw; overflow: hidden; }
          .app-main { flex: 1; overflow-y: auto; padding: 2rem; overflow-x: hidden; }

          /* Scrollbar customizada (PC) */
          ::-webkit-scrollbar { width: 6px; height: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

          /* ========================================================= */
          /* 📱 MOBILE FIRST: A MÁGICA QUE CONSERTA TUDO NO CELULAR 📱 */
          /* ========================================================= */
          @media (max-width: 768px) {
            .app-layout { flex-direction: column; }
            .app-main { padding: 1rem; padding-bottom: 120px; } /* Espaço para a barra inferior */

            /* 1. Conserta os quadrados do Calendário que estavam apertados */
            div[style*="grid-template-columns: repeat(7"] {
              gap: 0.2rem !important;
            }
            div[style*="min-height: 85px"], div[style*="minHeight: 85px"] {
              min-height: 60px !important;
              padding: 0.2rem !important;
            }
            div[style*="font-size: 0.9rem"] { font-size: 0.75rem !important; }

            /* 2. Formata TODOS os Modais do sistema (Agenda, Metas, Novo Lançamento) */
            div[style*="max-width: 480px"], div[style*="max-width: 500px"], 
            div[style*="max-width: 550px"], div[style*="max-width: 600px"] {
              width: 95% !important; /* Usa 95% da tela do celular */
              max-height: 90vh !important; /* Nunca ultrapassa a tela (remove scroll extra) */
              padding: 1.2rem !important; /* Diminui o respiro interno para caber mais coisa */
              margin: 0 auto;
            }

            /* 3. Quebra os formulários que estavam lado a lado para um embaixo do outro */
            form div[style*="display: flex"] {
              flex-direction: column !important;
              gap: 0.8rem !important;
            }

            /* 4. Padroniza fontes para evitar quebra de layout */
            h3 { font-size: 1.2rem !important; margin-bottom: 1rem !important; }
            p { font-size: 0.85rem !important; }
            
            /* 5. Ajuste de Inputs para evitar zoom e toques acidentais */
            input, select, textarea {
              font-size: 16px !important;
              padding: 0.8rem !important;
            }

            /* 6. Diminui os ícones gigantes dos modais */
            div[style*="width: 80px"], div[style*="width: 90px"] {
              width: 60px !important;
              height: 60px !important;
              margin-bottom: 0.5rem !important;
            }
          }
        `}} />

        {/* SCRIPT DO SERVICE WORKER (Para o PWA funcionar) */}
        <script dangerouslySetInnerHTML={{__html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(function(registration) {
                console.log('PWA: ServiceWorker registrado com sucesso!');
              }).catch(function(err) {
                console.log('PWA: Falha ao registrar o ServiceWorker: ', err);
              });
            });
          }
        `}} />
      </body>
    </html>
  )
}