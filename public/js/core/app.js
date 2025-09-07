import { listenAuthState, signInWithGoogle, signOutUser } from '../auth.js';
import { verificarStatusSetup, getConfiguracoes, getCentrosCustoUsuario } from '../firestore-service.js';
import { Navigation } from './navigation.js';
import { SetupController } from '../pages/setup.js';

export class App {
    static state = {
        usuarioLogado: null,
        appConfig: {},
        centrosCustoUsuario: [],
        lancamentosListener: null,
        filtroAtual: { ano: new Date().getFullYear(), mes: new Date().getMonth() }
    };

    static async init() {
        console.log('Sistema iniciando...');
        this.configurarEventosGlobais();
        
        const loginButton = document.getElementById('login-button');
        if (loginButton) {
            loginButton.addEventListener('click', signInWithGoogle);
        }
        
        listenAuthState(this.onLogin.bind(this), this.onLogout.bind(this));
    }

    static configurarEventosGlobais() {
        const modals = ['modalEditarLancamento', 'modalPagamentoParcial', 'modalDivisaoCentros'];
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.addEventListener('hidden.bs.modal', this.limparFormularioModal);
            }
        });
    }

    static async onLogin(user) {
        try {
            console.log('Usuário logado:', user.email);
            
            document.getElementById('login-screen').classList.add('d-none');
            document.getElementById('dashboard-screen').classList.remove('d-none');
            
            const userNameElement = document.getElementById('user-name');
            if (userNameElement) {
                userNameElement.textContent = user.displayName || user.email.split('@')[0];
            }
            
            const logoutButton = document.getElementById('logout-button');
            if (logoutButton) {
                logoutButton.addEventListener('click', signOutUser);
            }
            
            this.state.usuarioLogado = user;
            
            const statusSetup = await verificarStatusSetup(user.uid);
            
            if (statusSetup.needsSetup) {
                await this.iniciarSetupUsuario(user, statusSetup.step);
            } else {
                await this.inicializarAplicacao(user);
            }
            
        } catch (error) {
            console.error("Erro no login:", error);
            this.mostrarToast("Erro ao inicializar aplicação. Tente novamente.", "error");
        }
    }

    static onLogout() {
        console.log('Usuário deslogado');
        
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
        
        const loginButton = document.getElementById('login-button');
        if (loginButton) {
            const buttonContent = loginButton.querySelector('.d-flex');
            const spinner = loginButton.querySelector('.loading-spinner');
            
            if (buttonContent) buttonContent.style.display = 'flex';
            if (spinner) spinner.style.display = 'none';
            loginButton.disabled = false;
        }
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
            
            await Navigation.navigate('setup', { step });
        } catch (error) {
            console.error("Erro ao iniciar setup:", error);
            this.mostrarToast("Erro ao carregar configuração inicial", "error");
        }
    }

    static async inicializarAplicacao(user) {
        try {
            this.mostrarLoading(true);
            
            if (!user) {
                console.error("Usuário não encontrado na inicialização");
                return;
            }
            
            this.state.appConfig = await getConfiguracoes(user.uid);
            this.state.centrosCustoUsuario = await getCentrosCustoUsuario(user.uid);
            
            Navigation.configurarNavegacao();
            await Navigation.navigate('inicio');
            
        } catch (error) {
            console.error("Erro ao inicializar aplicação:", error);
            this.mostrarToast("Erro ao carregar configurações.", "error");
            
            if (error.code === 'permission-denied') {
                await Navigation.navigate('setup');
            }
        } finally {
            this.mostrarLoading(false);
        }
    }

    static mostrarLoading(mostrar, seletor = null) {
        if (seletor) {
            const elemento = document.querySelector(seletor);
            if (elemento) {
                if (mostrar) {
                    elemento.disabled = true;
                    elemento.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processando...';
                } else {
                    elemento.disabled = false;
                    elemento.innerHTML = elemento.dataset.originalText || 'Salvar';
                }
            }
        } else {
            const loader = document.getElementById('loading-overlay');
            if (loader) {
                loader.style.display = mostrar ? 'flex' : 'none';
            }
        }
    }

    static mostrarToast(mensagem, tipo = 'info') {
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '9999';
            document.body.appendChild(toastContainer);
        }
        
        const iconMap = {
            success: 'check-circle',
            error: 'exclamation-triangle',
            warning: 'exclamation-circle',
            info: 'info-circle'
        };
        
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${tipo === 'error' ? 'danger' : tipo} border-0`;
        toast.setAttribute('role', 'alert');
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-${iconMap[tipo]} me-2"></i>
                    ${mensagem}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" 
                        data-bs-dismiss="toast"></button>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        const bsToast = new bootstrap.Toast(toast, { delay: 5000 });
        bsToast.show();
        
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }

    static limparFormularioModal() {
        const forms = document.querySelectorAll('.modal form');
        forms.forEach(form => form.reset());
    }

    static formatarMoeda(valor, moeda = 'EUR') {
        if (valor === null || valor === undefined || isNaN(valor)) return '€0,00';
    
        try {
            return new Intl.NumberFormat('pt-PT', { 
                style: 'currency', 
                currency: moeda,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(valor);
        } catch (error) {
            const symbol = moeda === 'EUR' ? '€' : moeda;
            return `${symbol}${valor.toFixed(2).replace('.', ',')}`;
        }
    }

    static popularSelect(seletorOuElemento, opcoes, valorPadrao = '') {
        // Verifica se foi passado o seletor ou o elemento diretamente
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


// Para configurações com abas funcionais
export class SettingsTabsController {
    static inicializar() {
        this.configurarAbas();
        this.carregarDadosConfiguracoes();
    }

    static configurarAbas() {
        const tabBtns = document.querySelectorAll('#settings-tabs .nav-link');
        const tabPanes = document.querySelectorAll('.tab-pane');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                
                // Remove active de todas as abas
                tabBtns.forEach(b => b.classList.remove('active'));
                tabPanes.forEach(p => p.classList.remove('active'));
                
                // Ativa a aba clicada
                btn.classList.add('active');
                document.getElementById(`tab-${targetTab}`).classList.add('active');
            });
        });
    }

    static async carregarDadosConfiguracoes() {
        const user = window.App.state.usuarioLogado;
        const config = window.App.state.appConfig;
        
        if (user) {
            // DADOS REAIS - não fake
            const nomeInput = document.getElementById('perfil-nome');
            const emailInput = document.getElementById('perfil-email');
            
            if (nomeInput) nomeInput.value = user.displayName || '';
            if (emailInput) emailInput.value = user.email || '';
        }

        // TODO: Popular outros campos com dados reais de config
    }
}

window.App = App;