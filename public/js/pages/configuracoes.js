// public/js/pages/configuracoes.js
import {
    getConfiguracoes,
    getUsuario,
    atualizarConfiguracoes,
    criarPerfilUsuario,
    criarNovoCentroCusto,
    removerCentroCusto,
    getCentrosCustoUsuario,
    compartilharCentroCusto,
    atualizarNomeCentroCusto,
    removerCompartilhamento
} from '../firestore-service.js';

export class ConfiguracoesController {
    static dados = {
        perfil: {},
        config: {},
        centrosCusto: []
    };

    static tabAtual = 'conta';
    static editModalInstance = null;
    static itemEmEdicao = null;

    static async inicializar() {
        console.log('⚙️ Inicializando Configurações...');

        // Configurar modal de edição
        const editModalEl = document.getElementById('editModal');
        if (editModalEl) {
            this.editModalInstance = new bootstrap.Modal(editModalEl);
        }

        // Configurar navegação por abas
        this.configurarAbas();

        // Configurar eventos
        this.configurarEventos();

        // Carregar dados
        await this.carregarDados();

        // Atualizar título mobile
        const mobileTitle = document.getElementById('mobile-page-title');
        if (mobileTitle) {
            mobileTitle.textContent = 'Configurações';
        }
    }

    static configurarAbas() {
        const tabButtons = document.querySelectorAll('[data-tab]');

        tabButtons.forEach(btn => {
            btn.replaceWith(btn.cloneNode(true));
        });

        document.querySelectorAll('[data-tab]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = btn.dataset.tab;
                this.mostrarAba(tabName);
            });
        });
    }

    static mostrarAba(tabName) {
        this.tabAtual = tabName;

        // Atualizar botões
        document.querySelectorAll('[data-tab]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Atualizar painéis
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `tab-${tabName}`);
        });
    }

    static configurarEventos() {
        // Form de perfil
        const formPerfil = document.getElementById('form-perfil');
        if (formPerfil) {
            formPerfil.replaceWith(formPerfil.cloneNode(true));
            document.getElementById('form-perfil').addEventListener('submit',
                this.salvarPerfil.bind(this));
        }

        // Event delegation para todos os botões da página de configurações
        document.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            // Botões de adicionar
            if (target.id === 'btn-adicionar-fonte') {
                this.abrirAdicao('fonte');
            } else if (target.id === 'btn-adicionar-moeda') {
                this.abrirAdicao('moeda');
            } else if (target.id === 'btn-adicionar-categoria-despesa') {
                this.abrirAdicao('categoria', 'despesa');
            } else if (target.id === 'btn-adicionar-categoria-receita') {
                this.abrirAdicao('categoria', 'receita');
            } else if (target.id === 'btn-adicionar-centro') {
                this.abrirAdicao('centro');
            }

            // Botões de ação usando data attributes
            else if (target.dataset.action === 'editar-fonte') {
                this.editarFonte(parseInt(target.dataset.index));
            } else if (target.dataset.action === 'remover-fonte') {
                this.removerFonte(parseInt(target.dataset.index));
            } else if (target.dataset.action === 'editar-moeda') {
                this.editarMoeda(parseInt(target.dataset.index));
            } else if (target.dataset.action === 'remover-moeda') {
                this.removerMoeda(parseInt(target.dataset.index));
            } else if (target.dataset.action === 'remover-categoria') {
                this.removerCategoria(target.dataset.tipo, parseInt(target.dataset.index));
            } else if (target.dataset.action === 'editar-centro') {
                this.editarCentro(target.dataset.id);
            } else if (target.dataset.action === 'remover-centro') {
                this.removerCentro(target.dataset.id);
            }
        });

        // Botão salvar edição
        const btnSalvarEdit = document.getElementById('saveEditButton');
        if (btnSalvarEdit) {
            btnSalvarEdit.replaceWith(btnSalvarEdit.cloneNode(true));
            document.getElementById('saveEditButton').addEventListener('click',
                this.salvarEdicao.bind(this));
        }
    }

    static async carregarDados() {
        try {
            window.App.mostrarLoading(true);

            const userId = window.App.state.usuarioLogado.uid;

            this.dados.perfil = await getUsuario(userId);
            this.dados.config = await getConfiguracoes(userId);
            this.dados.centrosCusto = await getCentrosCustoUsuario(userId);

            this.atualizarInterface();

        } catch (error) {
            console.error('❌ Erro ao carregar configurações:', error);
            window.App.mostrarToast('Erro ao carregar dados', 'error');
        } finally {
            window.App.mostrarLoading(false);
        }
    }

    static atualizarInterface() {
        // Perfil
        const nomeInput = document.getElementById('perfil-nome');
        const emailInput = document.getElementById('perfil-email');
        const moedaSelect = document.getElementById('perfil-moeda');

        if (nomeInput) nomeInput.value = this.dados.perfil.nome || '';
        if (emailInput) emailInput.value = window.App.state.usuarioLogado.email || '';

        // Popular select de moeda dinamicamente com as moedas configuradas
        if (moedaSelect) {
            const moedas = this.dados.config.moedas || [];
            moedaSelect.innerHTML = moedas.map(m =>
                `<option value="${m.codigo}">${m.codigo}</option>`
            ).join('');
            moedaSelect.value = this.dados.config.moedaPrincipal || 'EUR';
        }

        // Listas
        this.atualizarListaFontes();
        this.atualizarListaMoedas();
        this.atualizarListaCategorias();
        this.atualizarListaCentros();
    }

    static async salvarPerfil(event) {
        event.preventDefault();

        try {
            window.App.mostrarLoading(true);

            const userId = window.App.state.usuarioLogado.uid;
            const nome = document.getElementById('perfil-nome').value.trim();
            const moeda = document.getElementById('perfil-moeda').value;

            await Promise.all([
                criarPerfilUsuario(userId, { ...this.dados.perfil, nome }),
                atualizarConfiguracoes(userId, { ...this.dados.config, moedaPrincipal: moeda })
            ]);

            this.dados.perfil.nome = nome;
            this.dados.config.moedaPrincipal = moeda;

            window.App.state.appConfig = this.dados.config;

            window.App.mostrarToast('Perfil atualizado com sucesso!', 'success');

        } catch (error) {
            console.error('❌ Erro ao salvar perfil:', error);
            window.App.mostrarToast('Erro ao salvar perfil', 'error');
        } finally {
            window.App.mostrarLoading(false);
        }
    }

    static atualizarListaFontes() {
        const container = document.getElementById('lista-fontes');
        if (!container) return;

        const fontes = this.dados.config.fontes || [];

        if (fontes.length === 0) {
            container.innerHTML = `
                <div class="empty-state p-4">
                    <p class="text-muted mb-0">Nenhuma fonte cadastrada</p>
                </div>
            `;
            return;
        }

        container.innerHTML = fontes.map((fonte, index) => `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <strong>${fonte.nome}</strong>
                    <small class="text-muted ms-2">${fonte.tipo} - ${fonte.moeda}</small>
                    ${fonte.agrupavel ? '<span class="badge bg-primary ms-2">Agrupável</span>' : ''}
                </div>
                <div>
                    <button class="btn btn-sm btn-outline-secondary me-2"
                            data-action="editar-fonte"
                            data-index="${index}"
                            title="Editar">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger"
                            data-action="remover-fonte"
                            data-index="${index}"
                            title="Remover">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    static atualizarListaMoedas() {
        const container = document.getElementById('lista-moedas');
        if (!container) return;

        const moedas = this.dados.config.moedas || [];
        const moedaPrincipal = this.dados.config.moedaPrincipal || 'EUR';

        if (moedas.length === 0) {
            container.innerHTML = `
                <div class="empty-state p-4">
                    <p class="text-muted mb-0">Nenhuma moeda configurada</p>
                </div>
            `;
            return;
        }

        container.innerHTML = moedas.map((moeda, index) => {
            const isPrincipal = moeda.codigo === moedaPrincipal;

            return `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${moeda.codigo}</strong>
                        <small class="text-muted ms-2">Taxa: ${moeda.taxa}</small>
                        ${isPrincipal ? '<span class="badge bg-success ms-2">Principal</span>' : ''}
                    </div>
                    <div>
                        <button class="btn btn-sm btn-outline-secondary me-2"
                                data-action="editar-moeda"
                                data-index="${index}"
                                title="Editar">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                        ${!isPrincipal ? `
                            <button class="btn btn-sm btn-outline-danger"
                                    data-action="remover-moeda"
                                    data-index="${index}"
                                    title="Remover">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    static atualizarListaCategorias() {
        ['despesa', 'receita'].forEach(tipo => {
            const container = document.getElementById(`lista-categorias-${tipo}`);
            if (!container) return;

            const key = tipo === 'despesa' ? 'categoriasDespesa' : 'categoriasReceita';
            const categorias = this.dados.config[key] || [];

            if (categorias.length === 0) {
                container.innerHTML = `
                    <div class="empty-state p-4">
                        <p class="text-muted mb-0">Nenhuma categoria cadastrada</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = categorias.map((cat, index) => `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <span>${cat}</span>
                    <button class="btn btn-sm btn-outline-danger"
                            data-action="remover-categoria"
                            data-tipo="${tipo}"
                            data-index="${index}"
                            title="Remover">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('');
        });
    }

    static atualizarListaCentros() {
        const container = document.getElementById('lista-centros-custo');
        if (!container) return;

        const centros = this.dados.centrosCusto || [];

        if (centros.length === 0) {
            container.innerHTML = `
                <div class="empty-state p-4">
                    <p class="text-muted mb-0">Nenhum centro de custo cadastrado</p>
                </div>
            `;
            return;
        }

        container.innerHTML = centros.map(centro => {
            const isPrincipal = centro.id === this.dados.config.centroCustoPrincipalId;

            return `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <strong>${centro.nome}</strong>
                            ${isPrincipal ? '<span class="badge bg-success ms-2">Principal</span>' : ''}
                        </div>
                        <div>
                            <button class="btn btn-sm btn-outline-secondary me-2"
                                    data-action="editar-centro"
                                    data-id="${centro.id}"
                                    title="Editar">
                                <i class="fas fa-pencil-alt"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger"
                                    data-action="remover-centro"
                                    data-id="${centro.id}"
                                    title="Remover">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    ${centro.usuariosCompartilhados && centro.usuariosCompartilhados.length > 1 ? `
                        <small class="text-muted">
                            <i class="fas fa-users me-1"></i>
                            Compartilhado com ${centro.usuariosCompartilhados.length - 1} pessoa(s)
                        </small>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    static abrirAdicao(tipo, subtipo = null) {
        const labels = {
            'fonte': 'Nome da Conta/Fonte (ex: Banco Itaú, Carteira)',
            'moeda': 'Código da Moeda (ex: USD, GBP, JPY)',
            'centro': 'Nome do Centro de Custo (ex: Casa, Trabalho)',
            'categoria': `Nome da Categoria de ${subtipo === 'despesa' ? 'Despesa' : 'Receita'}`
        };

        const nome = prompt(labels[tipo] || `Nome do(a) ${tipo}:`);
        if (!nome || !nome.trim()) return;

        this.adicionarItem(tipo, nome.trim(), subtipo);
    }

    static async adicionarItem(tipo, nome, subtipo) {
        try {
            const userId = window.App.state.usuarioLogado.uid;
            const config = this.dados.config;

            if (tipo === 'fonte') {
                if (!config.fontes) config.fontes = [];
                config.fontes.push({
                    nome,
                    tipo: 'Banco',
                    moeda: config.moedaPrincipal || 'EUR',
                    agrupavel: false
                });

                await atualizarConfiguracoes(userId, config);
                this.atualizarListaFontes();

            } else if (tipo === 'moeda') {
                // Adicionar moeda
                const taxa = parseFloat(prompt('Taxa de conversão (em relação à moeda principal):', '1.0'));
                if (isNaN(taxa) || taxa <= 0) {
                    window.App.mostrarToast('Taxa inválida', 'error');
                    return;
                }

                if (!config.moedas) config.moedas = [];

                // Verificar se já existe
                if (config.moedas.find(m => m.codigo === nome)) {
                    window.App.mostrarToast('Moeda já existe', 'warning');
                    return;
                }

                config.moedas.push({
                    codigo: nome.toUpperCase(),
                    taxa: taxa
                });

                await atualizarConfiguracoes(userId, config);
                this.dados.config = config;
                this.atualizarListaMoedas();

                // Atualizar também o select de moeda principal
                this.atualizarInterface();

            } else if (tipo === 'categoria') {
                const key = subtipo === 'despesa' ? 'categoriasDespesa' : 'categoriasReceita';
                if (!config[key]) config[key] = [];
                config[key].push(nome);

                await atualizarConfiguracoes(userId, config);
                this.atualizarListaCategorias();

            } else if (tipo === 'centro') {
                const novoCentro = await criarNovoCentroCusto(userId, { nome });
                this.dados.centrosCusto.push(novoCentro);
                this.atualizarListaCentros();
            }

            window.App.mostrarToast(`${tipo} adicionado com sucesso!`, 'success');

        } catch (error) {
            console.error('Erro ao adicionar:', error);
            window.App.mostrarToast('Erro ao adicionar item', 'error');
        }
    }

    static async removerFonte(index) {
        if (!confirm('Tem certeza que deseja remover esta fonte?')) return;

        try {
            const userId = window.App.state.usuarioLogado.uid;
            this.dados.config.fontes.splice(index, 1);

            await atualizarConfiguracoes(userId, this.dados.config);
            this.atualizarListaFontes();

            window.App.mostrarToast('Fonte removida!', 'success');
        } catch (error) {
            window.App.mostrarToast('Erro ao remover fonte', 'error');
        }
    }

    static async removerMoeda(index) {
        if (!confirm('Tem certeza que deseja remover esta moeda?')) return;

        try {
            const userId = window.App.state.usuarioLogado.uid;
            this.dados.config.moedas.splice(index, 1);

            await atualizarConfiguracoes(userId, this.dados.config);
            this.atualizarListaMoedas();

            window.App.mostrarToast('Moeda removida!', 'success');
        } catch (error) {
            window.App.mostrarToast('Erro ao remover moeda', 'error');
        }
    }

    static async removerCategoria(tipo, index) {
        if (!confirm('Tem certeza que deseja remover esta categoria?')) return;

        try {
            const userId = window.App.state.usuarioLogado.uid;
            const key = tipo === 'despesa' ? 'categoriasDespesa' : 'categoriasReceita';

            this.dados.config[key].splice(index, 1);

            await atualizarConfiguracoes(userId, this.dados.config);
            this.atualizarListaCategorias();

            window.App.mostrarToast('Categoria removida!', 'success');
        } catch (error) {
            window.App.mostrarToast('Erro ao remover categoria', 'error');
        }
    }

    static async removerCentro(centroId) {
        if (!confirm('Tem certeza que deseja remover este centro de custo?')) return;

        try {
            await removerCentroCusto(centroId);

            this.dados.centrosCusto = this.dados.centrosCusto.filter(c => c.id !== centroId);
            this.atualizarListaCentros();

            window.App.mostrarToast('Centro removido!', 'success');
        } catch (error) {
            window.App.mostrarToast('Erro ao remover centro', 'error');
        }
    }

    static editarFonte(index) {
        // Implementação futura
        window.App.mostrarToast('Funcionalidade em desenvolvimento', 'info');
    }

    static async editarMoeda(index) {
        try {
            const moeda = this.dados.config.moedas[index];
            if (!moeda) return;

            const novaTaxa = prompt(`Editar taxa de conversão para ${moeda.codigo}:`, moeda.taxa);
            if (novaTaxa === null) return; // Cancelado

            const taxa = parseFloat(novaTaxa);
            if (isNaN(taxa) || taxa <= 0) {
                window.App.mostrarToast('Taxa inválida', 'error');
                return;
            }

            const userId = window.App.state.usuarioLogado.uid;
            this.dados.config.moedas[index].taxa = taxa;

            await atualizarConfiguracoes(userId, this.dados.config);
            this.atualizarListaMoedas();

            window.App.mostrarToast('Taxa atualizada!', 'success');
        } catch (error) {
            window.App.mostrarToast('Erro ao editar moeda', 'error');
        }
    }

    static editarCentro(centroId) {
        // Implementação futura
        window.App.mostrarToast('Funcionalidade em desenvolvimento', 'info');
    }

    static salvarEdicao() {
        // Implementação futura
        this.editModalInstance?.hide();
    }
}

window.ConfiguracoesController = ConfiguracoesController;