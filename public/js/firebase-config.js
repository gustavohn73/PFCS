// public/js/firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-functions.js";

// Objeto de configuração do SEU projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCOq9Vp4TMdLw4U8J_qw6Qx3bN3ONyk7wQ",
  authDomain: "minhas-financas-3906c.firebaseapp.com",
  projectId: "minhas-financas-3906c",
  storageBucket: "minhas-financas-3906c.firebasestorage.app",
  messagingSenderId: "675459035347",
  appId: "1:675459035347:web:5ddef9416f17c4f7f46426",
  measurementId: "G-4HV3NWPYDZ"
};
// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta os serviços que usaremos no resto do aplicativo
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);