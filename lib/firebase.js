import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyD3BwiAOevbWL3UE6Kuu3czXzGI8gJ1RE0",
  authDomain: "patrao-digital.firebaseapp.com",
  projectId: "patrao-digital",
  storageBucket: "patrao-digital.firebasestorage.app",
  messagingSenderId: "470313105357",
  appId: "1:470313105357:web:36234f399de96a74cab684",
  measurementId: "G-M566FG2W8L"
};

// Evita inicializar o Firebase duas vezes (erro comum no Next.js)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let messaging = null;

// Só inicializa o Messaging se estiver rodando no navegador (Cliente)
if (typeof window !== "undefined" && typeof navigator !== "undefined") {
  messaging = getMessaging(app);
}

export const requestForToken = async () => {
  try {
    if (!messaging) return null;
    
    const currentToken = await getToken(messaging, { 
      vapidKey: "BJUNFym6LtGDj9ycABVszpLH1CpRfFtyLa-j9TV4YBr9Jy5VCjj3nXRnsVmFCvqYgyi7HpKpfCgcc1a6uxnO8D8" 
    });
    
    if (currentToken) {
      console.log('Token gerado com sucesso:', currentToken);
      return currentToken;
    } else {
      console.log('Nenhum token disponível. O usuário bloqueou a permissão.');
      return null;
    }
  } catch (err) {
    console.log('Erro ao pedir permissão de notificação:', err);
    return null;
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) return;
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });

export { app, messaging };