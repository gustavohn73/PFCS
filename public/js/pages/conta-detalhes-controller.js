// js/pages/conta-detalhes-controller.js
import { getConfiguracoes, atualizarConfiguracoes, getLancamentosDaConta } from '../firestore-service.js';
import { DashboardController } from './transacoes-controller.js';

export class ContaDetalhesController {
    static conta = null;
    static contaIndex = null;
    static modalInstance = null;
    static ultimoLancamentoVisivel = null;
    static todosLancamentosCarregados = false;
    static filtrosAtivos = { tipo: 'all', status: 'all' };

    static inicializar(params = {}) {
        this.conta = params.conta;
        this.contaIndex = params.contaIndex;
        this.ultimoLancamentoVisivel = null;
        this.todosLancamentosCarregados = false;
        this.filtrosAtivos = { tipo: 'all', status: 'all' };
        
        if (!this.conta) {
            console.error('Conta não encontrada');
            window.Navigation.navigate('contas');
            return;
        }

        this.configurarEventos();
        this.carregarInformacoesConta();
        this.carregarHistoricoEsaldo();
    }

    static configurarEventos() {
        const modalEl = document.getElementById('editAccountModal');
        if (modalEl) this.modalInstance = new bootstrap.Modal(modalEl);

        const saveBtn = document.getElementById('saveEditAccountBtn');
        if (saveBtn) saveBtn.addEventListener('click', () => this.salvarEdicao());

        const groupableCheckbox = document.getElementById('editAccountGroupable');
        if (groupableCheckbox) {
            groupableCheckbox.addEventListener('change', (e) => {
                document.getElementById('editGroupingOptions').style.display = e.target.checked ? 'block' : 'none';
            });
        }
        
        const loadMoreBtn = document.getElementById('load-more-transactions-btn');
        if (loadMoreBtn) loadMoreBtn.addEventListener('click', () => this.carregarHistoricoEsaldo(false));

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleFiltroClick(e.currentTarget));
        });

        const transactionsList = document.getElementById('transactions-list');
        if (transactionsList && !transactionsList.dataset.listener) {
             transactionsList.addEventListener('click', (event) => {
                DashboardController.handleDashboardClick(event);
            });
            transactionsList.dataset.listener = 'true';
        }
    }

    static handleFiltroClick(clickedButton) {
        const group = clickedButton.dataset.filterGroup;
        const value = clickedButton.dataset.filterValue;

        this.filtrosAtivos[group] = value;

        // Atualiza a aparência dos botões no mesmo grupo
        document.querySelectorAll(`.filter-btn[data-filter-group="${group}"]`).forEach(btn => {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-outline-secondary');
        });
        clickedButton.classList.remove('btn-outline-secondary');
        clickedButton.classList.add('btn-primary');

        this.filtrarTransacoesVisiveis();
    }

    static filtrarTransacoesVisiveis() {
        const linhas = document.querySelectorAll('#transactions-list tr');
        let visibleRows = 0;

        linhas.forEach(linha => {
            const tipo = linha.dataset.tipo;
            const status = linha.dataset.status;

            const mostrarPorTipo = this.filtrosAtivos.tipo === 'all' || this.filtrosAtivos.tipo === tipo;
            const mostrarPorStatus = this.filtrosAtivos.status === 'all' || this.filtrosAtivos.status === status;

            if (mostrarPorTipo && mostrarPorStatus) {
                linha.style.display = '';
                visibleRows++;
            } else {
                linha.style.display = 'none';
            }
        });

        // Mostra/esconde o estado de vazio se nenhum item visível
        const emptyState = document.getElementById('transactions-empty');
        if (visibleRows === 0 && linhas.length > 0) {
            emptyState.style.display = 'block';
            emptyState.querySelector('p').textContent = 'Nenhuma transação encontrada para os filtros selecionados.';
        } else if (linhas.length > 0) {
            emptyState.style.display = 'none';
        }
    }

    static carregarInformacoesConta() {
        const infoCard = document.getElementById('account-info-card');
        if (!infoCard) return;

        const agrupamentoInfo = this.conta.agrupavel ? 
            `<div class="info-item">
                <label><i class="fas fa-layer-group text-primary me-1"></i>Agrupamento</label>
                <span class="info-value">
                    Fecha dia ${this.conta.diaFechamento}, Vence dia ${this.conta.diaVencimento}
                </span>
            </div>` : '';

        infoCard.innerHTML = `
            <div class="row g-3">
                <div class="col-md-4">
                    <div class="info-item">
                        <label>Nome da Conta</label>
                        <span class="info-value">${this.conta.nome}</span>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="info-item">
                        <label>Tipo</label>
                        <span class="info-value">${this.conta.tipo}</span>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="info-item">
                        <label>Moeda</label>
                        <span class="info-value">${this.conta.moeda}</span>
                    </div>
                </div>
                ${agrupamentoInfo ? `<div class="col-12">${agrupamentoInfo}</div>` : ''}
            </div>
            
            <div class="account-actions mt-3">
                <button class="btn btn-primary" id="edit-account-btn-details">
                    <i class="fas fa-edit me-1"></i>Editar Detalhes
                </button>
            </div>
        `;

        // Reconfigurar evento do botão de editar que acabamos de criar
        document.getElementById('edit-account-btn-details').addEventListener('click', () => this.editarConta());
    }
    
    static async carregarHistoricoEsaldo(inicial = true) {
        if (this.todosLancamentosCarregados && !inicial) return;

        const loadMoreContainer = document.getElementById('load-more-container');
        const loadMoreBtn = document.getElementById('load-more-transactions-btn');
        const emptyState = document.getElementById('transactions-empty');
        const transactionsList = document.getElementById('transactions-list');
        const balanceEl = document.getElementById('current-balance');
        const periodoLabelEl = document.getElementById('periodo-label');

        try {
            if (loadMoreBtn) loadMoreBtn.disabled = true;
            if (inicial) transactionsList.innerHTML = '';

            const { lancamentos, ultimoDoc } = await getLancamentosDaConta(
                window.App.state.usuarioLogado.uid,
                this.conta.nome,
                this.ultimoLancamentoVisivel
            );

            if (lancamentos.length === 0 && inicial) {
                emptyState.style.display = 'block';
                emptyState.querySelector('p').textContent = 'Nenhuma transação encontrada para esta conta.';
                transactionsList.style.display = 'none';
                if(loadMoreContainer) loadMoreContainer.style.display = 'none';
            } else {
                emptyState.style.display = 'none';
                transactionsList.style.display = '';
                if(loadMoreContainer) loadMoreContainer.style.display = 'block';

                lancamentos.forEach(lanc => {
                    transactionsList.appendChild(this.criarLinhaTransacao(lanc));
                });
                
                this.ultimoLancamentoVisivel = ultimoDoc;
                if (!ultimoDoc) {
                    this.todosLancamentosCarregados = true;
                    if(loadMoreContainer) loadMoreContainer.style.display = 'none';
                }
            }
            
            this.filtrarTransacoesVisiveis();
            this.calcularEExibirSaldo(balanceEl, periodoLabelEl);

        } catch (error) {
            console.error('Erro ao carregar histórico de transações:', error);
            window.App.mostrarToast('Erro ao carregar histórico', 'error');
        } finally {
            if (loadMoreBtn) loadMoreBtn.disabled = false;
        }
    }

    static criarLinhaTransacao(lancamento) {
        const tr = document.createElement('tr');
        const statusConfig = {
            'Pago': { bg: 'success', text: 'Pago' },
            'Parcial': { bg: 'warning', text: 'Parcial' },
            'Pendente': { bg: 'secondary', text: 'Pendente' }
        };
        const statusInfo = statusConfig[lancamento.status] || statusConfig['Pendente'];

        tr.innerHTML = `
            <td>${lancamento.dataVencimento.toDate().toLocaleDateString('pt-BR')}</td>
            <td>${lancamento.descricao}</td>
            <td>${lancamento.categoria}</td>
            <td><span class="badge bg-${statusInfo.bg}">${statusInfo.text}</span></td>
            <td class="text-end ${lancamento.tipo.toLowerCase()}">${window.App.formatarMoeda(lancamento.valorNaMoedaPrincipal, this.conta.moeda)}</td>
            <td class="text-center">
                 <div class="dropdown">
                    <button class="btn btn-sm btn-light" type="button" data-bs-toggle="dropdown">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li><a class="dropdown-item" href="#" data-action="edit" data-id="${lancamento.id}">Editar</a></li>
                        <li><a class="dropdown-item" href="#" data-action="pay" data-id="${lancamento.id}">Pagar</a></li>
                        <li><a class="dropdown-item" href="#" data-action="delete" data-id="${lancamento.id}">Excluir</a></li>
                    </ul>
                </div>
            </td>
        `;
        return tr;
    }

    static async calcularEExibirSaldo(balanceEl, periodoLabelEl) {
        const userId = window.App.state.usuarioLogado.uid;
        const hoje = new Date();
        let saldo = 0;
        let periodoInfo = "Saldo total da conta";

        const { lancamentos: todosLancamentos } = await getLancamentosDaConta(userId, this.conta.nome, null, 9999);

        if (this.conta.agrupavel) {
            const diaFechamento = this.conta.diaFechamento;
            let inicioFatura, fimFatura;

            // Ajuste para pegar o mês correto
            const anoAtual = hoje.getFullYear();
            const mesAtual = hoje.getMonth();
            const diaAtual = hoje.getDate();

            if (diaAtual >= diaFechamento) {
                inicioFatura = new Date(anoAtual, mesAtual, diaFechamento);
                fimFatura = new Date(anoAtual, mesAtual + 1, diaFechamento -1);
            } else {
                inicioFatura = new Date(anoAtual, mesAtual - 1, diaFechamento);
                fimFatura = new Date(anoAtual, mesAtual, diaFechamento -1);
            }
            
            periodoInfo = `Fatura atual: ${inicioFatura.toLocaleDateString('pt-BR')} a ${fimFatura.toLocaleDateString('pt-BR')}`;
            
            todosLancamentos.forEach(lanc => {
                const dataLanc = lanc.dataLancamento.toDate();
                if (dataLanc >= inicioFatura && dataLanc <= fimFatura) {
                     saldo += lanc.valorNaMoedaPrincipal;
                }
            });
        } else {
             todosLancamentos.forEach(lanc => {
                if (lanc.status === 'Pago' || lanc.status === 'Parcial') {
                    saldo += (lanc.tipo === 'Receita' ? lanc.valorNaMoedaPrincipal : -lanc.valorNaMoedaPrincipal);
                }
            });
        }

        balanceEl.textContent = window.App.formatarMoeda(saldo, this.conta.moeda);
        periodoLabelEl.textContent = periodoInfo;
    }


    static async calcularEExibirSaldo(balanceEl, periodoLabelEl) {
        const userId = window.App.state.usuarioLogado.uid;
        const hoje = new Date();
        let saldo = 0;
        let periodoInfo = "";

        // Busca TODOS os lançamentos da conta para o cálculo
        const { lancamentos: todosLancamentos } = await getLancamentosDaConta(userId, this.conta.nome, null, 9999);

        if (this.conta.agrupavel) {
            // LÓGICA DE FATURA
            const diaFechamento = this.conta.diaFechamento;
            let inicioFatura, fimFatura;

            const anoAtual = hoje.getFullYear();
            const mesAtual = hoje.getMonth();
            const diaAtual = hoje.getDate();
            
            // Se hoje é dia 28 ou mais, a fatura em aberto é a que fecha no próximo mês
            // Ex: hoje é 29/08, fechamento dia 28. A fatura aberta é a de 28/08 a 27/09.
            if (diaAtual >= diaFechamento) {
                inicioFatura = new Date(anoAtual, mesAtual, diaFechamento);
                fimFatura = new Date(anoAtual, mesAtual + 1, diaFechamento - 1);
            } else {
            // Ex: hoje é 07/09, fechamento dia 28. A fatura aberta é a de 28/08 a 27/09.
                inicioFatura = new Date(anoAtual, mesAtual - 1, diaFechamento);
                fimFatura = new Date(anoAtual, mesAtual, diaFechamento - 1);
            }
            
            periodoInfo = `Fatura atual: ${inicioFatura.toLocaleDateString('pt-BR')} a ${fimFatura.toLocaleDateString('pt-BR')}`;
            
            todosLancamentos.forEach(lanc => {
                const dataLanc = lanc.dataLancamento.toDate();
                if (dataLanc >= inicioFatura && dataLanc <= fimFatura) {
                     saldo += lanc.tipo === 'Receita' ? lanc.valorNaMoedaPrincipal : -lanc.valorNaMoedaPrincipal;
                }
            });

        } else {
            // LÓGICA DE CONTA CORRENTE (MÊS ATUAL)
            const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
            const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
            periodoInfo = `Saldo do mês de ${hoje.toLocaleDateString('pt-BR', { month: 'long' })}`;

            todosLancamentos.forEach(lanc => {
                const dataLanc = lanc.dataLancamento.toDate();
                 if (dataLanc >= inicioMes && dataLanc <= fimMes) {
                    saldo += (lanc.tipo === 'Receita' ? lanc.valorNaMoedaPrincipal : -lanc.valorNaMoedaPrincipal);
                }
            });
        }

        balanceEl.textContent = window.App.formatarMoeda(saldo, this.conta.moeda);
        periodoLabelEl.textContent = periodoInfo;
    }


    static editarConta() {
        this.carregarModalEdicao();
        this.modalInstance?.show();
    }

    static async carregarModalEdicao() {
        try {
            const config = await getConfiguracoes(window.App.state.usuarioLogado.uid);
            
            document.getElementById('editAccountName').value = this.conta.nome;
            document.getElementById('editAccountType').value = this.conta.tipo;
            
            const currencySelect = document.getElementById('editAccountCurrency');
            currencySelect.innerHTML = config.moedas.map(moeda => 
                `<option value="${moeda.codigo}" ${moeda.codigo === this.conta.moeda ? 'selected' : ''}>${moeda.codigo}</option>`
            ).join('');
            
            const groupableCheckbox = document.getElementById('editAccountGroupable');
            groupableCheckbox.checked = this.conta.agrupavel || false;
            
            const groupingOptions = document.getElementById('editGroupingOptions');
            groupingOptions.style.display = this.conta.agrupavel ? 'block' : 'none';
            
            if (this.conta.agrupavel) {
                document.getElementById('editClosingDay').value = this.conta.diaFechamento || '';
                document.getElementById('editDueDay').value = this.conta.diaVencimento || '';
            }
        } catch (error) {
            console.error('Erro ao carregar modal:', error);
        }
    }

    static async salvarEdicao() {
        try {
            window.App.mostrarLoading(true, '#saveEditAccountBtn');

            const dadosAtualizados = {
                nome: document.getElementById('editAccountName').value.trim(),
                tipo: document.getElementById('editAccountType').value,
                moeda: document.getElementById('editAccountCurrency').value,
                agrupavel: document.getElementById('editAccountGroupable').checked,
                diaFechamento: document.getElementById('editAccountGroupable').checked ? 
                    parseInt(document.getElementById('editClosingDay').value) || null : null,
                diaVencimento: document.getElementById('editAccountGroupable').checked ? 
                    parseInt(document.getElementById('editDueDay').value) || null : null
            };

            const userId = window.App.state.usuarioLogado.uid;
            const config = await getConfiguracoes(userId);
            
            config.fontes[this.contaIndex] = dadosAtualizados;
            await atualizarConfiguracoes(userId, { fontes: config.fontes });
            
            this.conta = dadosAtualizados;
            this.carregarInformacoesConta();
            
            this.modalInstance?.hide();
            window.App.mostrarToast('Conta atualizada com sucesso!', 'success');

        } catch (error) {
            console.error('Erro ao salvar conta:', error);
            window.App.mostrarToast('Erro ao salvar conta', 'error');
        } finally {
            window.App.mostrarLoading(false);
        }
    }
}

window.ContaDetalhesController = ContaDetalhesController;