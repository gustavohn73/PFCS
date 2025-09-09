// js/pages/contas-controller.js
import { getConfiguracoes, atualizarConfiguracoes, calcularSaldosContas } from '../firestore-service.js';

export class ContasController {
  static modalInstance = null;
  static deleteModalInstance = null;
  static editModalInstance = null;
  static editingIndex = null;
  static contas = [];
  static saldos = {};

  static inicializar() {
    console.log('Inicializando ContasController...');
    this.configurarEventos();
    this.carregarContas();
  }

  static configurarEventos() {
    const addBtn = document.getElementById('add-account-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.adicionarConta());
    }

    // Modal de adição
    const modalEl = document.getElementById('accountModal');
    if (modalEl) {
      this.modalInstance = new bootstrap.Modal(modalEl);
    }

    // Modal de edição  
    const editModalEl = document.getElementById('editAccountModal');
    if (editModalEl) {
      this.editModalInstance = new bootstrap.Modal(editModalEl);
    }

    // Modal de exclusão
    const deleteModalEl = document.getElementById('deleteAccountModal');
    if (deleteModalEl) {
      this.deleteModalInstance = new bootstrap.Modal(deleteModalEl);
    }

    const saveBtn = document.getElementById('saveAccountBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.salvarConta());
    }

    const saveEditBtn = document.getElementById('saveEditAccountBtn');
    if (saveEditBtn) {
      saveEditBtn.addEventListener('click', () => this.salvarEdicaoConta());
    }

    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
      confirmDeleteBtn.addEventListener('click', () => this.confirmarExclusao());
    }

    // Eventos para checkbox de agrupamento
    const groupableCheckbox = document.getElementById('accountGroupable');
    if (groupableCheckbox) {
      groupableCheckbox.addEventListener('change', (e) => {
        const options = document.getElementById('groupingOptions');
        options.style.display = e.target.checked ? 'block' : 'none';
      });
    }

    const editGroupableCheckbox = document.getElementById('editAccountGroupable');
    if (editGroupableCheckbox) {
      editGroupableCheckbox.addEventListener('change', (e) => {
        const options = document.getElementById('editGroupingOptions');
        options.style.display = e.target.checked ? 'block' : 'none';
      });
    }
  }

  static async carregarContas() {
    try {
      window.App.mostrarLoading(true);
      const userId = window.App.state.usuarioLogado.uid;
      
      const [config, saldos] = await Promise.all([
        getConfiguracoes(userId),
        calcularSaldosContas(userId)
      ]);
      
      this.contas = config.fontes || [];
      this.saldos = saldos;
      this.renderizarContas();
      this.carregarMoedasNoModal(config.moedas || []);
      
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
      window.App.mostrarToast('Erro ao carregar contas', 'error');
    } finally {
      window.App.mostrarLoading(false);
    }
  }

  static renderizarContas() {
    const grid = document.getElementById('accounts-grid');
    const emptyState = document.getElementById('empty-state');
    
    if (!grid) return;

    if (this.contas.length === 0) {
      grid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    grid.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';
    
    grid.innerHTML = this.contas.map((conta, index) => this.criarCardConta(conta, index)).join('');
  }

  static criarCardConta(conta, index) {
    const tipoIcons = {
      'Banco': 'fas fa-university',
      'Cartão': 'fas fa-credit-card', 
      'Dinheiro': 'fas fa-wallet'
    };

    const saldoConta = this.saldos[conta.nome] || { disponivel: 0, pendente: 0, agrupavel: false };
    const saldoFormatado = window.App.formatarMoeda(saldoConta.disponivel, conta.moeda);
    
    const badgeAgrupavel = conta.agrupavel ? 
      `<span class="badge bg-info ms-2">
        <i class="fas fa-layer-group me-1"></i>
        Fatura (${conta.diaFechamento}→${conta.diaVencimento})
      </span>` : '';

    const statusSaldo = saldoConta.disponivel < 0 ? 'text-danger' : 'text-success';

    return `
      <div class="col">
        <div class="card h-100 shadow-sm hover-card">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <div class="d-flex align-items-center">
                <div class="account-icon me-3">
                  <i class="${tipoIcons[conta.tipo]} fa-lg"></i>
                </div>
                <div>
                  <h5 class="card-title mb-1">${conta.nome}</h5>
                  <div class="d-flex align-items-center">
                    <span class="badge bg-light text-dark me-2">
                      <i class="fas fa-tag me-1"></i>
                      ${conta.tipo}
                    </span>
                    ${badgeAgrupavel}
                  </div>
                </div>
              </div>
            </div>
            
            <div class="mb-3">
              <small class="text-muted">Moeda: ${conta.moeda}</small>
            </div>
            
            <div class="saldo-info mb-3">
              <div class="row">
                <div class="col-6">
                  <div class="saldo-item">
                    <small class="text-muted d-block">Saldo Atual</small>
                    <span class="h6 ${statusSaldo} mb-0">${saldoFormatado}</span>
                  </div>
                </div>
                <div class="col-6">
                  <div class="saldo-item">
                    <small class="text-muted d-block">Pendente</small>
                    <span class="h6 text-warning mb-0">${window.App.formatarMoeda(saldoConta.pendente, conta.moeda)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="card-actions d-flex gap-2">
              <button class="btn btn-outline-primary btn-sm flex-fill" onclick="ContasController.verDetalhes(${index})">
                <i class="fas fa-eye me-1"></i>
                Detalhes
              </button>
              <button class="btn btn-outline-secondary btn-sm" onclick="ContasController.editarConta(${index})">
                <i class="fas fa-edit me-1"></i>
                Editar
              </button>
              <button class="btn btn-outline-danger btn-sm" onclick="ContasController.removerConta(${index})">
                <i class="fas fa-trash me-1"></i>
                Excluir
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  static carregarMoedasNoModal(moedas) {
    const selects = ['accountCurrency', 'editAccountCurrency'];
    selects.forEach(selectId => {
      const select = document.getElementById(selectId);
      if (select) {
        select.innerHTML = moedas.map(moeda => 
          `<option value="${moeda.codigo}">${moeda.codigo}</option>`
        ).join('');
      }
    });
  }

  static adicionarConta() {
    this.editingIndex = null;
    this.limparFormulario();
    document.getElementById('accountModalTitle').textContent = 'Adicionar Conta';
    this.modalInstance?.show();
  }

  static editarConta(index) {
    this.editingIndex = index;
    const conta = this.contas[index];
    
    // Preencher formulário de edição
    document.getElementById('editAccountName').value = conta.nome;
    document.getElementById('editAccountType').value = conta.tipo;
    document.getElementById('editAccountCurrency').value = conta.moeda;
    document.getElementById('editAccountGroupable').checked = conta.agrupavel || false;
    
    if (conta.agrupavel) {
      document.getElementById('editClosingDay').value = conta.diaFechamento || '';
      document.getElementById('editDueDay').value = conta.diaVencimento || '';
      document.getElementById('editGroupingOptions').style.display = 'block';
    } else {
      document.getElementById('editGroupingOptions').style.display = 'none';
    }
    
    this.editModalInstance?.show();
  }

  static async salvarConta() {
    try {
      const form = document.getElementById('accountForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      window.App.mostrarLoading(true, '#saveAccountBtn');

      const dadosConta = this.coletarDadosFormulario();
      const userId = window.App.state.usuarioLogado.uid;
      const config = await getConfiguracoes(userId);
      
      config.fontes = config.fontes || [];
      config.fontes.push(dadosConta);

      await atualizarConfiguracoes(userId, { fontes: config.fontes });
      
      await this.carregarContas();
      this.modalInstance?.hide();
      
      window.App.mostrarToast('Conta adicionada com sucesso!', 'success');

    } catch (error) {
      console.error('Erro ao salvar conta:', error);
      window.App.mostrarToast('Erro ao salvar conta', 'error');
    } finally {
      window.App.mostrarLoading(false);
    }
  }

  static async salvarEdicaoConta() {
    try {
      const form = document.getElementById('editAccountForm');
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      window.App.mostrarLoading(true, '#saveEditAccountBtn');

      const dadosConta = this.coletarDadosFormularioEdicao();
      const userId = window.App.state.usuarioLogado.uid;
      const config = await getConfiguracoes(userId);
      
      config.fontes[this.editingIndex] = dadosConta;

      await atualizarConfiguracoes(userId, { fontes: config.fontes });
      
      await this.carregarContas();
      this.editModalInstance?.hide();
      
      window.App.mostrarToast('Conta atualizada com sucesso!', 'success');

    } catch (error) {
      console.error('Erro ao atualizar conta:', error);
      window.App.mostrarToast('Erro ao atualizar conta', 'error');
    } finally {
      window.App.mostrarLoading(false);
    }
  }

  static coletarDadosFormulario() {
    const agrupavel = document.getElementById('accountGroupable').checked;
    
    return {
      nome: document.getElementById('accountName').value.trim(),
      tipo: document.getElementById('accountType').value,
      moeda: document.getElementById('accountCurrency').value,
      agrupavel: agrupavel,
      diaFechamento: agrupavel ? parseInt(document.getElementById('closingDay').value) || null : null,
      diaVencimento: agrupavel ? parseInt(document.getElementById('dueDay').value) || null : null
    };
  }

  static coletarDadosFormularioEdicao() {
    const agrupavel = document.getElementById('editAccountGroupable').checked;
    
    return {
      nome: document.getElementById('editAccountName').value.trim(),
      tipo: document.getElementById('editAccountType').value,
      moeda: document.getElementById('editAccountCurrency').value,
      agrupavel: agrupavel,
      diaFechamento: agrupavel ? parseInt(document.getElementById('editClosingDay').value) || null : null,
      diaVencimento: agrupavel ? parseInt(document.getElementById('editDueDay').value) || null : null
    };
  }

  static removerConta(index) {
    this.editingIndex = index;
    this.deleteModalInstance?.show();
  }

  static async confirmarExclusao() {
    try {
      window.App.mostrarLoading(true, '#confirmDeleteBtn');
      
      const userId = window.App.state.usuarioLogado.uid;
      const config = await getConfiguracoes(userId);
      
      config.fontes.splice(this.editingIndex, 1);
      await atualizarConfiguracoes(userId, { fontes: config.fontes });
      
      await this.carregarContas();
      this.deleteModalInstance?.hide();
      
      window.App.mostrarToast('Conta removida com sucesso!', 'success');

    } catch (error) {
      console.error('Erro ao remover conta:', error);
      window.App.mostrarToast('Erro ao remover conta', 'error');
    } finally {
      window.App.mostrarLoading(false);
    }
  }

  static verDetalhes(index) {
    const conta = this.contas[index];
    window.Navigation.navigate('conta-detalhes', { contaIndex: index, conta });
  }

  static limparFormulario() {
    document.getElementById('accountForm').reset();
    document.getElementById('groupingOptions').style.display = 'none';
  }
}

window.ContasController = ContasController;
