// public/js/auth.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

let currentUser = null;

/**
 * Inicia o "escutador" de autenticação, que reage a logins e logouts.
 * Esta é a função mais importante que inicia o aplicativo.
 * @param {function} onLogin - Função a ser chamada quando um usuário faz login.
 * @param {function} onLogout - Função a ser chamada quando um usuário faz logout.
 */
export function listenAuthState(onLogin, onLogout) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Usuário logado:", user.email);
            currentUser = user;
            onLogin(user);
        } else {
            console.log("Nenhum usuário logado.");
            currentUser = null;
            onLogout();
        }
    });
}

/**
 * Retorna o ID do usuário atualmente logado.
 * @returns {string|null} O ID do usuário ou null se não logado.
 */
export function getUserId() { 
    return currentUser ? currentUser.uid : null;
}

/**
 * Inicia o fluxo de login com o popup do Google.
 */
export async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
        prompt: 'select_account'
    });
    
    try {
        console.log("Iniciando login com Google...");
        const result = await signInWithPopup(auth, provider);
        console.log("Login bem-sucedido:", result.user.email);
        return result.user;
    } catch (error) {
        console.error("Erro ao fazer login com Google:", error.code, error.message);
        
        // Tratamento específico de erros
        let errorMessage = "Erro no login. Tente novamente.";
        
        switch (error.code) {
            case 'auth/popup-blocked':
                errorMessage = "Popup bloqueado pelo navegador. Permita popups para este site.";
                break;
            case 'auth/popup-closed-by-user':
            case 'auth/cancelled-popup-request':
                errorMessage = "Login cancelado pelo usuário.";
                break;
            case 'auth/network-request-failed':
                errorMessage = "Erro de conexão. Verifique sua internet.";
                break;
            case 'auth/too-many-requests':
                errorMessage = "Muitas tentativas. Aguarde um momento.";
                break;
        }
        
        // Mostrar erro na interface se a função existir
        if (typeof window.mostrarToast === 'function') {
            window.mostrarToast(errorMessage, 'error');
        } else {
            alert(errorMessage);
        }
        
        throw new Error(errorMessage);
    }
}

/**
 * Faz o logout do usuário atual.
 */
export async function signOutUser() {
    try {
        console.log("Fazendo logout...");
        await signOut(auth);
        console.log("Logout realizado com sucesso");
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
        throw error;
    }
}

/**
 * Retorna o usuário atualmente logado.
 * @returns {object|null} O objeto do usuário ou nulo.
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Verifica se existe um usuário logado
 * @returns {boolean}
 */
export function isUserLoggedIn() {
    return currentUser !== null;
}