// public/js/core/app.js
import { listenAuthState, signInWithGoogle, signOutUser } from '../auth.js';
import { verificarStatusSetup, getConfiguracoes, getCentrosCustoUsuario } from '../firestore-service.js';

export class App {
    static state = {
        usuarioLogado: null,
        appConfig: {},
        centrosCustoUsuario: [],
        lancamentosListener: null,
        filtroAtual: { ano: new Date().getFullYear(), mes: new Date().getMonth() }
    };

    static async init() {
        console.log('🚀 Sistema iniciando...');
        this.configurarEventosGlobais();

        const loginButton = document.getElementById('login-button');
        if (loginButton) {
            loginButton.addEventListener('click', signInWithGoogle);
        }

        listenAuthState(this.onLogin.bind(this), this.onLogout.bind(this));
    }

    static configurarEventosGlobais() {
        // Toast container
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;';
            document.body.appendChild(container);
        }

        // Cleanup de modais ao fechar
        document.addEventListener('hidden.bs.modal', () => {
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        });
    }

    static async onLogin(user) {
        try {
            console.log('✅ Usuário logado:', user.email);

            document.getElementById('login-screen').classList.add('d-none');
            document.getElementById('dashboard-screen').classList.remove('d-none');

            const userNameElement = document.getElementById('user-name');
            if (userNameElement) {
                userNameElement.textContent = user.displayName || user.email.split('@')[0];
            }

            const greetingElement = document.getElementById('user-greeting-name');
            if (greetingElement) {
                const primeiroNome = (user.displayName || user.email.split('@')[0]).split(' ')[0];
                greetingElement.textContent = primeiroNome;
            }

            const logoutButton = document.getElementById('logout-button');
            if (logoutButton) {
                logoutButton.replaceWith(logoutButton.cloneNode(true)); // Remove listeners antigos
                document.getElementById('logout-button').addEventListener('click', signOutUser);
            }

            this.state.usuarioLogado = user;

            const statusSetup = await verificarStatusSetup(user.uid);

            if (statusSetup.needsSetup) {
                await this.iniciarSetupUsuario(user, statusSetup.step);
            } else {
                await this.inicializarAplicacao(user);
            }

        } catch (error) {
            console.error("❌ Erro no login:", error);
            this.mostrarToast("Erro ao inicializar aplicação. Tente novamente.", "error");
        }
    }

    static onLogout() {
        console.log('👋 Usuário deslogado');

        const loginScreen = document.getElementById('login-screen');
        const dashboardScreen = document.getElementById('dashboard-screen');

        if (loginScreen) loginScreen.classList.remove('d-none');
        if (dashboardScreen) dashboardScreen.classList.add('d-none');

        if (this.state.lancamentosListener) {
            this.state.lancamentosListener();
            this.state.lancamentosListener = null;
        }

        this.state.usuarioLogado = null;
        this.state.appConfig = {};
        this.state.centrosCustoUsuario = [];
    }

    static async iniciarSetupUsuario(user, step) {
        try {
            if (!document.querySelector('#setup-wizard-styles')) {
                const link = document.createElement('link');
                link.id = 'setup-wizard-styles';
                link.rel = 'stylesheet';
                link.href = './css/setup-wizard.css';
                document.head.appendChild(link);
            }

            // Import dinâmico para evitar circular dependency
            const { Navigation } = await import('./navigation.js');
            await Navigation.navigate('setup', { step });
        } catch (error) {
            console.error("❌ Erro ao iniciar setup:", error);
            this.mostrarToast("Erro ao carregar configuração inicial", "error");
        }
    }

    static async inicializarAplicacao(user) {
        try {
            this.mostrarLoading(true);

            if (!user) {
                console.error("❌ Usuário não encontrado na inicialização");
                return;
            }

            this.state.appConfig = await getConfiguracoes(user.uid);
            this.state.centrosCustoUsuario = await getCentrosCustoUsuario(user.uid);

            console.log('✅ Configurações carregadas:', this.state.appConfig);
            console.log('✅ Centros de custo:', this.state.centrosCustoUsuario.length);

            // Import dinâmico
            const { Navigation } = await import('./navigation.js');
            Navigation.configurarNavegacao();

            // Atualizar data no header desktop
            this.atualizarDataHeader();

            await Navigation.navigate('inicio');

        } catch (error) {
            console.error("❌ Erro ao inicializar aplicação:", error);
            this.mostrarToast("Erro ao carregar configurações. Tente recarregar a página.", "error");
        } finally {
            this.mostrarLoading(false);
        }
    }

    static atualizarDataHeader() {
        const desktopDate = document.getElementById('current-date-display');

        if (desktopDate) {
            const hoje = new Date();
            const opcoes = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const dataFormatada = hoje.toLocaleDateString('pt-BR', opcoes);
            desktopDate.textContent = dataFormatada;
        }
    }

    static mostrarLoading(show, seletor = 'body') {
        const elemento = typeof seletor === 'string' ? document.querySelector(seletor) : seletor;
        if (!elemento) return;

        if (show) {
            const overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Carregando...</span>
                </div>
            `;
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255,255,255,0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9998;
            `;
            document.body.appendChild(overlay);
        } else {
            document.querySelectorAll('.loading-overlay').forEach(el => el.remove());
        }
    }

    static mostrarToast(mensagem, tipo = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const cores = {
            success: '#00C851',
            error: '#EF4444',
            warning: '#F59E0B',
            info: '#3B82F6'
        };

        const icones = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.style.cssText = `
            background: ${cores[tipo]};
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            margin-bottom: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 12px;
            min-width: 300px;
            animation: slideIn 0.3s ease;
        `;

        toast.innerHTML = `
            <i class="fas ${icones[tipo]}"></i>
            <span>${mensagem}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    static formatarMoeda(valor, moeda = 'EUR') {
        return new Intl.NumberFormat('pt-PT', {
            style: 'currency',
            currency: moeda
        }).format(valor);
    }

    static popularSelect(seletorOuElemento, opcoes, valorPadrao = '') {
        const select = typeof seletorOuElemento === 'string'
            ? document.querySelector(seletorOuElemento)
            : seletorOuElemento;

        if (!select) return;

        select.innerHTML = '<option value="">Selecione...</option>';

        if (Array.isArray(opcoes)) {
            opcoes.forEach(opcao => {
                const valor = typeof opcao === 'string' ? opcao : opcao.id || opcao.codigo || opcao.nome;
                const texto = typeof opcao === 'string' ? opcao : opcao.nome || opcao.codigo;
                const selected = valor === valorPadrao ? 'selected' : '';

                select.innerHTML += `<option value="${valor}" ${selected}>${texto}</option>`;
            });
        }
    }
}

// Adicionar estilos de animação
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

window.App = App;