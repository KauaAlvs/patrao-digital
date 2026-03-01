import './globals.css'
import Sidebar from '../components/Sidebar'

export const metadata = {
  title: 'Patrão Digital',
  description: 'ERP de Gestão Pessoal e Corporativa',
  manifest: '/manifest.json',
  themeColor: '#121212',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Patrão Digital',
  },
}

export const viewport = {
  themeColor: '#121212',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="app-layout">
          <Sidebar />
          <main className="app-main">
            {children}
          </main>
        </div>

        {/* MOTOR RESPONSIVO GLOBAL */}
        <style dangerouslySetInnerHTML={{__html: `
          body { 
            margin: 0; padding: 0; 
            background-color: #121212; color: #fff; 
            font-family: system-ui, -apple-system, sans-serif; 
            overflow: hidden; 
          }
          
          .app-layout { 
            display: flex; height: 100vh; width: 100vw; overflow: hidden; 
          }
          
          .app-main { 
            flex: 1; overflow-y: auto; padding: 2rem; 
          }

          /* Scrollbar customizada (Desktop) */
          ::-webkit-scrollbar { width: 6px; height: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
          ::-webkit-scrollbar-thumb:hover { background: #555; }

          /* ======================================= */
          /* REGRAS EXCLUSIVAS PARA CELULAR (MOBILE) */
          /* ======================================= */
          @media (max-width: 768px) {
            .app-layout { flex-direction: column; }
            .app-main { 
              padding: 1rem; 
              padding-bottom: 110px; /* Garante que o último item não fique atrás da barra inferior */
            }
          }
        `}} />
      </body>
    </html>
  )
}