# 📱 Patrão Digital - ERP & Secretária Digital PWA

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase)
![Firebase](https://img.shields.io/badge/Firebase-FCM-FFCA28?style=for-the-badge&logo=firebase)
![Vercel](https://img.shields.io/badge/Vercel-Cron_Jobs-black?style=for-the-badge&logo=vercel)
![PWA](https://img.shields.io/badge/PWA-Mobile_First-5A0FC8?style=for-the-badge&logo=pwa)

O **Patrão Digital** não é apenas um gerenciador de tarefas; é um ecossistema de produtividade proativo. Construído como um Web App Progressivo (PWA), ele atua como uma **Secretária Digital** que calcula "gaps" de metas, gerencia dívidas de produtividade e envia notificações push de forma autônoma.

Desenvolvido para eliminar a fricção da anotação diária e substituir a dependência de aplicativos de terceiros e CRMs genéricos.

---

## 🚀 Principais Funcionalidades (O Cérebro do Sistema)

### 1. 🧠 Motor Faxineiro & Isolamento de Dívida
Diferente de sistemas comuns, o Patrão Digital não simplesmente zera suas metas semanais na segunda-feira. Se você tinha uma meta de 10 prospecções e fez apenas 7, o sistema **isola o saldo devedor (3)** criando uma nova Atividade `[PENDENTE]` na sua agenda, e só então reseta o ciclo para a nova semana. Nada se perde.

### 2. ⏳ Radar Proativo de 5 Dias
O sistema não espera a tarefa vencer para te avisar. Através de Cron Jobs rodando no servidor, ele analisa seu banco de dados e cria um "funil de atenção":
- **🚨 Atrasos:** Cobrança diária até a conclusão.
- **⏳ Radar (5 Dias):** Contagem regressiva silenciosa ("Faltam 4 dias para fechar a meta").
- **🔔 Véspera:** Alerta de antecipação ("Marcado para AMANHÃ!").
- **⚡ Hoje:** Foco diário.

### 3. 🛡️ Imunidade à Inatividade (Supabase Hack)
Projetos no plano gratuito do Supabase são pausados após 7 dias de inatividade. Como o *Patrão Digital* possui Cron Jobs da Vercel (`vercel.json`) que fazem requisições ao banco de dados 2x ao dia (08:00 e 18:00), o banco de dados é mantido "quente" e ativo 24/7, garantindo alta disponibilidade com custo zero.

### 4. 🔔 Notificações Push (FCM) com Auto-Higiene
Integração nativa com Firebase Cloud Messaging (FCM) para Web Push. O sistema de envio (Multicast) possui um algoritmo de **auto-higiene**: ele identifica tokens mortos (usuários que desinstalaram o PWA ou limparam o cache) no momento do disparo e os remove automaticamente do banco, otimizando o envio e evitando notificações duplicadas.

### 5. 📱 Experiência PWA Mobile-First
- Instalação direta na Tela Inicial (sem Play Store/App Store).
- Interface *Fricção Zero* com Floating Action Button (+) posicionado para o polegar.
- Modo Dark nativo para conforto visual.
- Bloco de notas de acesso rápido.

---

## 🛠️ Arquitetura e Tecnologias

- **Frontend/Backend:** Next.js 14 (App Router)
- **Database / BaaS:** Supabase (PostgreSQL)
- **Mensageria (Push):** Firebase Cloud Messaging (FCM) + Service Workers
- **Agendamento (Automação):** Vercel Cron Jobs
- **Estilização:** Tailwind CSS

---

## ⚙️ Como rodar o projeto localmente

### 1. Clone o repositório
```bash
git clone [https://github.com/SEU_USUARIO/patrao-digital.git](https://github.com/SEU_USUARIO/patrao-digital.git)
cd patrao-digital