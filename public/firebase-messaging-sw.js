importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

const firebaseConfig = {
  apiKey: "AIzaSyD3BwiAOevbWL3UE6Kuu3czXzGI8gJ1RE0",
  authDomain: "patrao-digital.firebaseapp.com",
  projectId: "patrao-digital",
  storageBucket: "patrao-digital.firebasestorage.app",
  messagingSenderId: "470313105357",
  appId: "1:470313105357:web:36234f399de96a74cab684"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Esta função escuta as mensagens quando o app está em segundo plano (fechado)
messaging.onBackgroundMessage(function(payload) {
  console.log('Notificação recebida em segundo plano: ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/apple-touch-icon.png', // Usa a logo do seu app
    badge: '/apple-touch-icon.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});