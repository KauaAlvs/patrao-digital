import './globals.css'
import Sidebar from '../components/Sidebar'

export const metadata = {
  title: 'Patrão Digital',
  description: 'Sistema de Gestão Pessoal e Corporativa',
  manifest: '/manifest.json', // <-- ISSO FAZ A MÁGICA DO PWA
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
  userScalable: false, // Evita zoom indesejado no celular
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body style={{ display: 'flex', backgroundColor: '#121212', margin: 0, color: '#fff', minHeight: '100vh' }}>
        <Sidebar />
        <main style={{ flex: 1, height: '100vh', overflowY: 'auto', padding: '2rem' }}>
          {children}
        </main>
      </body>
    </html>
  )
}