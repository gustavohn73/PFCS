// public/js/pages/lancamento.js
import {
    criarLancamentos,
    atualizarLancamento,
    getConfiguracoes,
    atualizarConfiguracoes,
    criarNovoCentroCusto,
    getCentrosCustoUsuario
} from '../firestore-service.js';

export class LancamentoController {
    static lancamentoEmEdicao = null;
    static currentStep = 1;
    static addModalInstance = null;

    static async inicializar(params = {}) {
        console.log('💰 Inicializando Lançamento...');

        this.lancamentoEmEdicao = params.lancamento || null;
        this.currentStep = 1;

        // Atualizar título
        if (this.lancamentoEmEdicao) {
            document.getElementById('form-title').textContent = 'Editar Lançamento';
        }

        await this.popularSelects();
        this.configurarEventos();
        this.configurarModal();

        // Preencher dados se for edição
        if (this.lancamentoEmEdicao) {
            this.preencherFormularioEdicao();
        }

        // Setar data padrão
        const hoje = new Date().toISOString().split('T')[0];
        document.getElementById('lanc-data').value = hoje;
    }

    static configurarEventos() {
        // Remover listeners antigos
        const form = document.getElementById('form-lancamento');
        form.replaceWith(form.cloneNode(true));

        // Re-obter referências
        const newForm = document.getElementById('form-lancamento');

        // Submit do formulário
        newForm.addEventListener('submit', this.handleSubmit.bind(this));

        // Navegação entre etapas
        document.getElementById('btn-avancar')?.addEventListener('click', () => {
            if (this.validarEtapaBasica()) {
                this.mostrarEtapa(2);
            }
        });

        document.getElementById('btn-voltar')?.addEventListener('click', () => {
            this.mostrarEtapa(1);
        });

        document.getElementById('btn-opcoes-avancadas')?.addEventListener('click', () => {
            this.mostrarEtapa(3);
        });

        document.getElementById('btn-voltar-detalhes')?.addEventListener('click', () => {
            this.mostrarEtapa(2);
        });

        // Tipo de transação
        document.querySelectorAll('input[name="tipo"]').forEach(radio => {
            radio.addEventListener('change', this.alternarTipoLancamento.bind(this));
        });

        // Dividir centros
        document.getElementById('dividir-centros')?.addEventListener('change', (e) => {
            this.alternarDivisaoCentros(e.target.checked);
        });

        // Recorrência
        document.getElementById('tipo-recorrencia')?.addEventListener('change',
            this.alternarRecorrencia.bind(this));

        // Botões de adicionar
        document.getElementById('btn-add-categoria')?.addEventListener('click', () =>
            this.abrirAdicaoRapida('categoria'));
        document.getElementById('btn-add-fonte')?.addEventListener('click', () =>
            this.abrirAdicaoRapida('fonte'));
        document.getElementById('btn-add-centro')?.addEventListener('click', () =>
            this.abrirAdicaoRapida('centro'));

        // Fonte change (para moeda)
        document.getElementById('lanc-fonte')?.addEventListener('change',
            this.vincularMoedaAFonte.bind(this));
    }

    static mostrarEtapa(etapa) {
        this.currentStep = etapa;

        document.querySelectorAll('.form-section').forEach(section => {
            section.classList.remove('active');
        });

        const sectionMap = {
            1: 'section-basico',
            2: 'section-detalhes',
            3: 'section-avancado'
        };

        const sectionId = sectionMap[etapa];
        if (sectionId) {
            document.getElementById(sectionId).classList.add('active');
        }

        // Scroll para o topo
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    static validarEtapaBasica() {
        const descricao = document.getElementById('lanc-descricao').value.trim();
        const valor = parseFloat(document.getElementById('lanc-valor').value);
        const categoria = document.getElementById('lanc-categoria').value;

        if (!descricao) {
            window.App.mostrarToast('Por favor, preencha a descrição', 'warning');
            return false;
        }

        if (!valor || valor <= 0) {
            window.App.mostrarToast('Por favor, informe um valor válido', 'warning');
            return false;
        }

        if (!categoria) {
            window.App.mostrarToast('Por favor, selecione uma categoria', 'warning');
            return false;
        }

        return true;
    }

    static async popularSelects() {
        const config = window.App.state.appConfig;
        const centrosCusto = window.App.state.centrosCustoUsuario;

        // Moedas
        window.App.popularSelect('#lanc-moeda', config.moedas || [], config.moedaPrincipal);

        // Fontes
        window.App.popularSelect('#lanc-fonte', config.fontes || []);

        // Centros de Custo
        window.App.popularSelect('#lanc-centro-custo', centrosCusto || []);
        if (config.centroCustoPrincipalId) {
            document.getElementById('lanc-centro-custo').value = config.centroCustoPrincipalId;
        }

        // Categorias (chama alternarTipoLancamento para popular correto)
        this.alternarTipoLancamento();
    }

    static alternarTipoLancamento() {
        const tipo = document.querySelector('input[name="tipo"]:checked').value;
        const selectCategoria = document.getElementById('lanc-categoria');
        const categorias = (tipo === 'Despesa')
            ? window.App.state.appConfig.categoriasDespesa
            : window.App.state.appConfig.categoriasReceita;

        window.App.popularSelect(selectCategoria, categorias || []);
    }

    static vincularMoedaAFonte() {
        const fonteId = document.getElementById('lanc-fonte').value;
        const selectMoeda = document.getElementById('lanc-moeda');

        if (!fonteId) return;

        const fonte = window.App.state.appConfig.fontes?.find(f =>
            (f.id || f.nome) === fonteId
        );

        if (fonte && fonte.moeda) {
            selectMoeda.value = fonte.moeda;
            // Desabilitar select de moeda (vem da fonte)
            selectMoeda.disabled = true;
            selectMoeda.title = `Moeda vinculada à conta ${fonte.nome}`;
        } else {
            selectMoeda.disabled = false;
            selectMoeda.title = '';
        }
    }

    static alternarDivisaoCentros(ativado) {
        const container = document.getElementById('container-divisao-centros');
        container.style.display = ativado ? 'block' : 'none';

        if (ativado) {
            this.gerarCamposDivisao();
        }
    }

    static gerarCamposDivisao() {
        const lista = document.getElementById('divisoes-list');
        const valorTotal = parseFloat(document.getElementById('lanc-valor').value) || 0;
        const centros = window.App.state.centrosCustoUsuario || [];

        lista.innerHTML = centros.slice(0, 3).map((centro, index) => `
            <div class="divisao-item mb-2">
                <div class="row">
                    <div class="col-7">
                        <input type="text" class="form-control form-control-sm" 
                               value="${centro.nome}" readonly>
                    </div>
                    <div class="col-5">
                        <input type="number" class="form-control form-control-sm divisao-valor" 
                               data-centro-id="${centro.id}" step="0.01" min="0"
                               placeholder="0.00">
                    </div>
                </div>
            </div>
        `).join('');
    }

    static alternarRecorrencia() {
        const tipo = document.getElementById('tipo-recorrencia').value;
        const container = document.getElementById('container-recorrencia');

        if (!tipo) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        container.style.display = 'block';

        if (tipo === 'parcelado') {
            container.innerHTML = `
                <div class="row">
                    <div class="col-6">
                        <label class="form-label small">Número de Parcelas</label>
                        <input type="number" id="num-parcelas" class="form-control" 
                               value="2" min="2" max="60" required>
                    </div>
                    <div class="col-6">
                        <label class="form-label small">Valor da Parcela</label>
                        <input type="text" id="valor-parcela" class="form-control" readonly>
                    </div>
                </div>
            `;

            // Calcular parcela automaticamente
            const calcularParcela = () => {
                const total = parseFloat(document.getElementById('lanc-valor').value) || 0;
                const parcelas = parseInt(document.getElementById('num-parcelas').value) || 1;
                const valorParcela = (total / parcelas).toFixed(2);
                document.getElementById('valor-parcela').value = `€${valorParcela}`;
            };

            document.getElementById('lanc-valor').addEventListener('input', calcularParcela);
            document.getElementById('num-parcelas').addEventListener('input', calcularParcela);
            calcularParcela();

        } else if (tipo === 'recorrente') {
            container.innerHTML = `
                <div class="mb-2">
                    <label class="form-label small">Repetir por quantos meses?</label>
                    <input type="number" id="recorrencia-meses" class="form-control" 
                           value="12" min="1" max="120" required>
                </div>
            `;
        }
    }

    static async handleSubmit(event) {
        event.preventDefault();

        const btnSalvar = event.submitter;
        btnSalvar.disabled = true;
        btnSalvar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Salvando...';

        try {
            const form = this.coletarDadosFormulario();

            if (this.lancamentoEmEdicao) {
                // Edição
                await atualizarLancamento(this.lancamentoEmEdicao.id, {
                    descricao: form.descricao,
                    valorOriginal: form.valor,
                    moedaOriginal: form.moeda,
                    valorNaMoedaPrincipal: this.converterParaMoedaPrincipal(form.valor, form.moeda),
                    dataLancamento: form.dataLancamento,
                    dataVencimento: form.dataVencimento,
                    tipo: form.tipo,
                    categoria: form.categoria,
                    status: form.status
                });

                window.App.mostrarToast('Lançamento atualizado!', 'success');
            } else {
                // Criação
                const lancamentos = this.processarRecorrencia(form);
                await criarLancamentos(lancamentos);

                window.App.mostrarToast(
                    `${lancamentos.length} lançamento(s) criado(s)!`,
                    'success'
                );
            }

            const { Navigation } = await import('../core/navigation.js');
            Navigation.navigate('transacoes');

        } catch (error) {
            console.error('❌ Erro ao salvar lançamento:', error);
            window.App.mostrarToast(error.message || 'Erro ao salvar', 'error');

            btnSalvar.disabled = false;
            btnSalvar.innerHTML = '<i class="fas fa-check me-2"></i>Salvar Lançamento';
        }
    }

    static coletarDadosFormulario() {
        return {
            tipo: document.querySelector('input[name="tipo"]:checked').value,
            descricao: document.getElementById('lanc-descricao').value.trim(),
            valor: parseFloat(document.getElementById('lanc-valor').value),
            moeda: document.getElementById('lanc-moeda').value,
            categoria: document.getElementById('lanc-categoria').value,
            dataLancamento: new Date(document.getElementById('lanc-data').value),
            dataVencimento: document.getElementById('lanc-vencimento').value
                ? new Date(document.getElementById('lanc-vencimento').value)
                : new Date(document.getElementById('lanc-data').value),
            fonteId: document.getElementById('lanc-fonte').value,
            centroCustoId: document.getElementById('lanc-centro-custo').value,
            status: document.getElementById('lanc-status')?.value || 'Pendente',
            tipoRecorrencia: document.getElementById('tipo-recorrencia').value,
            observacoes: document.getElementById('lanc-observacoes')?.value || ''
        };
    }

    static processarRecorrencia(form) {
        const lancamentos = [];
        const config = window.App.state.appConfig;

        if (!form.tipoRecorrencia) {
            // Lançamento único
            lancamentos.push(this.criarObjetoLancamento(form, config));
        } else if (form.tipoRecorrencia === 'parcelado') {
            const numParcelas = parseInt(document.getElementById('num-parcelas').value);
            const valorParcela = form.valor / numParcelas;

            for (let i = 0; i < numParcelas; i++) {
                const dataVencimento = new Date(form.dataVencimento);
                dataVencimento.setMonth(dataVencimento.getMonth() + i);

                lancamentos.push(this.criarObjetoLancamento({
                    ...form,
                    descricao: `${form.descricao} (${i + 1}/${numParcelas})`,
                    valor: valorParcela,
                    dataVencimento
                }, config));
            }
        } else if (form.tipoRecorrencia === 'recorrente') {
            const meses = parseInt(document.getElementById('recorrencia-meses').value);

            for (let i = 0; i < meses; i++) {
                const dataVencimento = new Date(form.dataVencimento);
                dataVencimento.setMonth(dataVencimento.getMonth() + i);

                lancamentos.push(this.criarObjetoLancamento({
                    ...form,
                    dataVencimento
                }, config));
            }
        }

        return lancamentos;
    }

    static criarObjetoLancamento(form, config) {
        // Validação crítica: garantir que userId existe
        const userId = window.App?.state?.usuarioLogado?.uid;

        if (!userId) {
            throw new Error('Usuário não está logado ou sessão expirou. Por favor, faça login novamente.');
        }

        return {
            tipo: form.tipo,
            descricao: form.descricao,
            valorOriginal: form.valor,
            moedaOriginal: form.moeda,
            valorNaMoedaPrincipal: this.converterParaMoedaPrincipal(form.valor, form.moeda),
            dataLancamento: form.dataLancamento,
            dataVencimento: form.dataVencimento,
            categoria: form.categoria,
            fonteId: form.fonteId,
            centroCustoIds: form.centroCustoId ? [form.centroCustoId] : [],
            status: form.status,
            observacoes: form.observacoes,
            userId: userId
        };
    }

    static converterParaMoedaPrincipal(valor, moedaOrigem) {
        const config = window.App.state.appConfig;
        const moedaPrincipal = config.moedaPrincipal || 'EUR';

        if (moedaOrigem === moedaPrincipal) return valor;

        const moeda = config.moedas?.find(m => m.codigo === moedaOrigem);
        const taxa = moeda?.taxa || 1;

        return valor * taxa;
    }

    static configurarModal() {
        const modalEl = document.getElementById('addModal');
        if (modalEl) {
            this.addModalInstance = new bootstrap.Modal(modalEl);
        }
    }

    static abrirAdicaoRapida(tipo) {
        const modal = this.addModalInstance;
        if (!modal) return;

        const titulo = {
            'categoria': 'Adicionar Categoria',
            'fonte': 'Adicionar Conta/Fonte',
            'centro': 'Adicionar Centro de Custo'
        };

        document.getElementById('addModalTitle').textContent = titulo[tipo];

        let html = '<input type="text" id="add-item-nome" class="form-control mb-3" placeholder="Nome">';

        if (tipo === 'fonte') {
            html += `
                <select id="add-item-tipo" class="form-select mb-2">
                    <option value="Banco">Banco</option>
                    <option value="Cartão">Cartão de Crédito</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Investimento">Investimento</option>
                </select>
                <select id="add-item-moeda" class="form-select mb-2">
                    <option value="EUR">EUR</option>
                    <option value="BRL">BRL</option>
                    <option value="USD">USD</option>
                </select>
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="add-item-agrupavel">
                    <label class="form-check-label" for="add-item-agrupavel">
                        Conta agrupável (fatura)
                    </label>
                </div>
            `;
        }

        document.getElementById('addModalBody').innerHTML = html;

        // Configurar botão salvar
        const btnSalvar = document.getElementById('saveAddButton');
        btnSalvar.replaceWith(btnSalvar.cloneNode(true));

        document.getElementById('saveAddButton').addEventListener('click', async () => {
            await this.salvarAdicaoRapida(tipo);
        });

        modal.show();
    }

    static async salvarAdicaoRapida(tipo) {
        const nome = document.getElementById('add-item-nome').value.trim();

        if (!nome) {
            window.App.mostrarToast('Por favor, preencha o nome', 'warning');
            return;
        }

        try {
            const userId = window.App.state.usuarioLogado.uid;
            const config = window.App.state.appConfig;

            if (tipo === 'categoria') {
                const tipoCategoria = document.querySelector('input[name="tipo"]:checked').value;
                const key = tipoCategoria === 'Despesa' ? 'categoriasDespesa' : 'categoriasReceita';

                if (!config[key]) config[key] = [];
                config[key].push(nome);

                await atualizarConfiguracoes(userId, config);
                window.App.state.appConfig = config;

                this.alternarTipoLancamento();
                document.getElementById('lanc-categoria').value = nome;

            } else if (tipo === 'fonte') {
                const novaFonte = {
                    nome: nome,
                    tipo: document.getElementById('add-item-tipo').value,
                    moeda: document.getElementById('add-item-moeda').value,
                    agrupavel: document.getElementById('add-item-agrupavel').checked
                };

                if (!config.fontes) config.fontes = [];
                config.fontes.push(novaFonte);

                await atualizarConfiguracoes(userId, config);
                window.App.state.appConfig = config;

                window.App.popularSelect('#lanc-fonte', config.fontes);
                document.getElementById('lanc-fonte').value = nome;

            } else if (tipo === 'centro') {
                const novoCentro = await criarNovoCentroCusto(userId, { nome });
                window.App.state.centrosCustoUsuario.push(novoCentro);

                window.App.popularSelect('#lanc-centro-custo', window.App.state.centrosCustoUsuario);
                document.getElementById('lanc-centro-custo').value = novoCentro.id;
            }

            this.addModalInstance.hide();
            window.App.mostrarToast(`${tipo} adicionado com sucesso!`, 'success');

        } catch (error) {
            console.error('Erro ao adicionar:', error);
            window.App.mostrarToast('Erro ao adicionar item', 'error');
        }
    }

    static preencherFormularioEdicao() {
        const lanc = this.lancamentoEmEdicao;

        document.querySelector(`input[name="tipo"][value="${lanc.tipo}"]`).checked = true;
        document.getElementById('lanc-descricao').value = lanc.descricao;
        document.getElementById('lanc-valor').value = lanc.valorOriginal;
        document.getElementById('lanc-moeda').value = lanc.moedaOriginal;
        document.getElementById('lanc-categoria').value = lanc.categoria;
        document.getElementById('lanc-data').value = lanc.dataLancamento.toISOString().split('T')[0];
        document.getElementById('lanc-vencimento').value = lanc.dataVencimento.toISOString().split('T')[0];
        document.getElementById('lanc-fonte').value = lanc.fonteId;

        if (lanc.centroCustoIds && lanc.centroCustoIds.length > 0) {
            document.getElementById('lanc-centro-custo').value = lanc.centroCustoIds[0];
        }

        if (lanc.status) {
            document.getElementById('lanc-status').value = lanc.status;
        }
    }
}

window.LancamentoController = LancamentoController;