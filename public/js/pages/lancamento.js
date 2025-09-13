// Arquivo: public/js/pages/lancamento.js (VERSÃO CORRIGIDA E COMPLETA)

import {
    criarLancamentos,
    getCentrosCustoUsuario,
    criarNovoCentroCusto,
    atualizarConfiguracoes,
    atualizarLancamento
} from '../firestore-service.js';
import { Navigation } from '../core/navigation.js'; // Adicione a importação de Navigation

export class LancamentoController {
    static previewModalInstance = null;
    static addModalInstance = null;
    static lancamentoEmEdicao = null;
    static faturaCalculada = null; // ADICIONADO: Para guardar os dados da fatura

    static inicializar(state = {}) {
        this.lancamentoEmEdicao = null;
        this.faturaCalculada = null; // ADICIONADO: Reseta ao inicializar
        const previewModalEl = document.getElementById('previewModal');
        if (previewModalEl) this.previewModalInstance = new bootstrap.Modal(previewModalEl);
        
        const addModalEl = document.getElementById('addModal');
        if (addModalEl) this.addModalInstance = new bootstrap.Modal(addModalEl);

        this.configurarFormulario(state.lancamento);
    }

    static async abrirModalLancamento(lancamentoParaEditar = null) {
        const modal = document.getElementById('lancamentoModal');
        const modalContent = document.getElementById('lancamento-modal-content');
        const modalTitle = document.getElementById('lancamentoModalTitle');
    
        if (lancamentoParaEditar) {
            modalTitle.textContent = 'Editar Lançamento';
        } else {
            modalTitle.textContent = 'Novo Lançamento';
        }
    
        // Carregar o formulário de lançamento dentro do modal
        try {
            const response = await fetch('./pages/lancamento.html');
            const htmlContent = await response.text();
        
            // Extrair apenas o conteúdo do formulário (sem page-header)
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            const formContent = doc.querySelector('.content-card');
        
            modalContent.innerHTML = formContent.innerHTML;
        
            // Configurar o formulário
            await this.configurarFormulario(lancamentoParaEditar);
        
            // Mostrar o modal
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
        
        } catch (error) {
            console.error('Erro ao carregar modal de lançamento:', error);
            window.App.mostrarToast('Erro ao abrir formulário', 'error');
        }
    }

    static async configurarFormulario(lancamentoParaEditar = null) {
        await this.popularSelects();
        
        const hoje = new Date().toISOString().split('T')[0];
        document.getElementById('lanc-data').value = hoje;
        document.getElementById('lanc-data-vencimento').value = hoje;

        this.configurarEventos();
        // Dispara o evento change para carregar a moeda da fonte padrão
        document.getElementById('lanc-fonte').dispatchEvent(new Event('change'));

        if (lancamentoParaEditar) {
            this.preencherFormularioParaEdicao(lancamentoParaEditar);
        }
    }

    static preencherFormularioParaEdicao(lancamento) {
        this.lancamentoEmEdicao = lancamento;
        document.getElementById('lanc-descricao').value = lancamento.descricao;
        document.getElementById('lanc-valor').value = lancamento.valorOriginal;

        // CORREÇÃO: O objeto 'lancamento' já vem com datas JS válidas do firestore-service
        document.getElementById('lanc-data').value = lancamento.dataLancamento.toISOString().split('T')[0];
        document.getElementById('lanc-data-vencimento').value = lancamento.dataVencimento.toISOString().split('T')[0];
    
        if (lancamento.tipo === 'Receita') {
            document.getElementById('tipo-receita').checked = true;
        } else {
            document.getElementById('tipo-despesa').checked = true;
        }
        this.alternarTipoLancamento();
    
        // É crucial que 'lancamento.fonteId' seja o NOME da fonte, não um ID
        document.getElementById('lanc-fonte').value = lancamento.fonteId; 
        document.getElementById('lanc-categoria').value = lancamento.categoria;
        document.getElementById('lanc-fonte').dispatchEvent(new Event('change'));
    
        document.getElementById('dividir-centros').disabled = true;
        document.getElementById('tipo-recorrencia').disabled = true;

        if (lancamento.centroCustoIds && lancamento.centroCustoIds.length > 0) {
            document.getElementById('lanc-centro-custo').value = lancamento.centroCustoIds[0];
        }

        const btnSalvar = document.querySelector('#form-lancamento button[type="submit"]');
        btnSalvar.innerHTML = '<i class="fas fa-save me-1"></i>Salvar Alterações';
    }

    static async popularSelects() {
        const config = window.App.state.appConfig;
        const centrosCusto = window.App.state.centrosCustoUsuario;

        // CORREÇÃO: Usar a função popularSelect padrão. Ela usará o 'nome' como valor se não houver 'id'.
        window.App.popularSelect('#lanc-fonte', config.fontes || []);
        if (config.fontePrincipalId) { // Esta lógica talvez precise ser ajustada se fontePrincipalId for um nome
            document.getElementById('lanc-fonte').value = config.fontePrincipalId;
        }

        this.alternarTipoLancamento();
        
        window.App.popularSelect('#lanc-centro-custo', centrosCusto || []);
        if (config.centroCustoPrincipalId) {
            document.getElementById('lanc-centro-custo').value = config.centroCustoPrincipalId;
        }
    }
    
    // O método configurarEventos continua igual, só adicionamos um listener para a data
    static configurarEventos() {
        document.getElementById('form-lancamento').addEventListener('submit', this.handleSubmitLancamento.bind(this));
        
        document.querySelectorAll('input[name="tipo"]').forEach(radio => {
            radio.addEventListener('change', this.alternarTipoLancamento.bind(this));
        });
        
        // CORRIGIDO: Adicionamos um listener na data de lançamento também
        document.getElementById('lanc-fonte').addEventListener('change', this.vincularMoedaAFonte.bind(this));
        document.getElementById('lanc-data').addEventListener('change', this.vincularMoedaAFonte.bind(this));
        
        const chkDividir = document.getElementById('dividir-centros');
        chkDividir.addEventListener('change', () => this.alternarDivisaoCentros(chkDividir.checked));
        this.alternarDivisaoCentros(chkDividir.checked);

        document.getElementById('tipo-recorrencia').addEventListener('change', this.alternarRecorrencia.bind(this));
        document.getElementById('btn-preview').addEventListener('click', this.gerarPreview.bind(this));
        
        document.getElementById('btn-add-categoria').addEventListener('click', () => this.abrirAdicaoRapida('categoria'));
        document.getElementById('btn-add-fonte').addEventListener('click', () => this.abrirAdicaoRapida('fonte'));
        document.getElementById('btn-add-centro').addEventListener('click', () => this.abrirAdicaoRapida('centro'));
    }

    // O método alternarTipoLancamento continua igual...
    static alternarTipoLancamento() {
        const tipo = document.querySelector('input[name="tipo"]:checked').value;
        const selectCategoria = document.getElementById('lanc-categoria');
        const categorias = (tipo === 'Despesa') 
            ? window.App.state.appConfig.categoriasDespesa 
            : window.App.state.appConfig.categoriasReceita;
        
        window.App.popularSelect(selectCategoria, categorias || []);
    }

    // =========================================================================
    // MÉTODO ATUALIZADO: vincularMoedaAFonte
    // Aqui está a correção principal e a nova lógica.
    // =========================================================================
    static vincularMoedaAFonte() {
        this.faturaCalculada = null;
        const fonteSelect = document.getElementById('lanc-fonte');
        const dataLancamentoInput = document.getElementById('lanc-data');
        const dataVencimentoInput = document.getElementById('lanc-data-vencimento');
        const infoConversaoDiv = document.getElementById('info-conversao');
        
        // CORREÇÃO CRÍTICA: Voltamos a usar o NOME da fonte para buscar, como era no seu código original.
        const nomeFonte = fonteSelect.value;
        const fontes = window.App.state.appConfig.fontes || [];
        const fonte = fontes.find(f => f.nome === nomeFonte);

        if (!fonte) {
            document.getElementById('lanc-moeda').value = '';
            infoConversaoDiv.innerHTML = '';
            dataVencimentoInput.readOnly = false;
            return;
        }

        // 1. Preenche a moeda (Funcionalidade original restaurada)
        document.getElementById('lanc-moeda').value = fonte.moeda;

        // 2. Lógica de vencimento para contas agrupáveis
        if (fonte.agrupavel && fonte.diaFechamento && fonte.diaVencimento && dataLancamentoInput.value) {
            // (a lógica de cálculo da fatura continua a mesma da versão anterior, que estava correta)
            const dataLancamento = new Date(dataLancamentoInput.value + 'T12:00:00');
            let anoVencimento = dataLancamento.getFullYear();
            let mesVencimento = dataLancamento.getMonth();
            if (dataLancamento.getDate() >= parseInt(fonte.diaFechamento, 10)) {
                mesVencimento += 1;
            }
            const dataVencimentoFatura = new Date(anoVencimento, mesVencimento + 1, parseInt(fonte.diaVencimento, 10));
            dataVencimentoInput.value = dataVencimentoFatura.toISOString().split('T')[0];
            dataVencimentoInput.readOnly = true;
            
            const anoFaturaFmt = dataVencimentoFatura.getFullYear();
            const mesFaturaFmt = (dataVencimentoFatura.getMonth() + 1).toString().padStart(2, '0');
            // Usamos o nome da fonte para o ID da fatura, garantindo consistência
            const fonteIdParaFatura = fonte.nome.replace(/\s+/g, '-').toLowerCase();
            this.faturaCalculada = `${fonteIdParaFatura}_${anoFaturaFmt}-${mesFaturaFmt}`;
            infoConversaoDiv.innerHTML = `<i class="fas fa-info-circle text-primary me-1"></i>Vencimento calculado automaticamente.`;
        } else {
            dataVencimentoInput.readOnly = false;
            infoConversaoDiv.innerHTML = '';
        }
    }
    
    // =========================================================================
    // MÉTODO ATUALIZADO: processarRecorrencia
    // Adicionamos a linha para incluir o faturaId.
    // =========================================================================
    static processarRecorrencia(form) {
        const lancamentos = [];
        const idGrupoRecorrencia = `rec_${Date.now()}`;
        const totalParcelas = form.totalParcelas || form.totalRecorrencias || 1;

        for (let i = 0; i < totalParcelas; i++) {
            const dataVencimentoParcela = new Date(form.dataVencimento);
            dataVencimentoParcela.setMonth(dataVencimentoParcela.getMonth() + i);
            dataVencimentoParcela.setMonth(dataVencimentoParcela.getMonth() + i);

            form.divisoes.forEach(divisao => {
                const { centroCustoId, valor } = divisao;
                const centroCusto = window.App.state.centrosCustoUsuario.find(c => c.id === centroCustoId);

                const lancamento = {
                    usuarioId: window.App.state.usuarioLogado.uid,
                    descricao: totalParcelas > 1 ? `${form.descricao} (${i + 1}/${totalParcelas})` : form.descricao,
                    faturaId: this.faturaCalculada, // <-- ADICIONADO AQUI
                    valorOriginal: valor,
                    moedaOriginal: form.moedaOriginal,
                    valorNaMoedaPrincipal: form.moedaOriginal === window.App.state.appConfig.moedaPrincipal 
                        ? valor 
                        : this.converterParaMoedaPrincipal(valor, form.moedaOriginal),
                    dataLancamento: form.dataLancamento,
                    dataVencimento: dataVencimentoParcela,
                    tipo: form.tipo,
                    categoria: form.categoria,
                    fonteId: form.fonteId,
                    centrosCusto: [{ id: centroCustoId, valor: valor }],
                    centroCustoIds: [centroCustoId],
                    usuariosComAcesso: centroCusto ? centroCusto.usuariosCompartilhados : [window.App.state.usuarioLogado.uid],
                    recorrencia: totalParcelas > 1 ? { tipo: form.tipoRecorrencia, parcelaAtual: i + 1, totalParcelas, idGrupo: idGrupoRecorrencia } : null
                };
                lancamentos.push(lancamento);
            });
        }
        return lancamentos;
    }

    // =========================================================================
    // CORREÇÃO DE BUG: handleSubmitLancamento
    // Apenas uma versão desta função deve existir na classe.
    // =========================================================================
    static async handleSubmitLancamento(event) {
        event.preventDefault();
        const btnSalvar = event.submitter;
        btnSalvar.disabled = true;

        try {
            if (this.lancamentoEmEdicao) {
                const form = this.coletarDadosDoFormulario();
                const dadosAtualizados = {
                    descricao: form.descricao,
                    valorOriginal: form.valor,
                    moedaOriginal: form.moedaOriginal,
                    valorNaMoedaPrincipal: this.converterParaMoedaPrincipal(form.valor, form.moedaOriginal),
                    dataLancamento: form.dataLancamento,
                    dataVencimento: form.dataVencimento,
                    tipo: form.tipo,
                    categoria: form.categoria,
                    fonteId: form.fonteId,
                    centroCustoIds: [form.divisoes[0].centroCustoId],
                    faturaId: this.faturaCalculada // Adicionado para edições também
                };
                await atualizarLancamento(this.lancamentoEmEdicao.id, dadosAtualizados);
                window.App.mostrarToast('Lançamento atualizado com sucesso!', 'success');
            } else {
                const form = this.coletarDadosDoFormulario();
                if (form.dividir) {
                    const totalDistribuido = form.divisoes.reduce((acc, div) => acc + div.valor, 0);
                    if (Math.abs(form.valor - totalDistribuido) > 0.01) {
                        throw new Error('A soma dos valores divididos não corresponde ao valor total.');
                    }
                }
                const lancamentosParaCriar = this.processarRecorrencia(form);
                await criarLancamentos(lancamentosParaCriar);
                window.App.mostrarToast('Lançamento(s) criado(s) com sucesso!', 'success');
            }
            Navigation.navigate('transacoes');
        } catch (error) {
            console.error("Erro ao salvar lançamento:", error);
            window.App.mostrarToast(error.message, 'error');
            btnSalvar.disabled = false;
        }
    }

    // O resto da sua classe continua exatamente igual...
    // (alternarDivisaoCentros, gerarCamposDivisaoCentros, etc.)
    static alternarDivisaoCentros(ativado) {
        document.getElementById('container-divisao-centros').style.display = ativado ? 'block' : 'none';
        document.getElementById('container-principal-centro-custo').style.display = ativado ? 'none' : 'block';
        if (ativado) this.gerarCamposDivisaoCentros();
    }
    
    static gerarCamposDivisaoCentros() {
        const container = document.getElementById('lista-divisao-centros');
        container.innerHTML = '';
        window.App.state.centrosCustoUsuario.forEach(centro => {
            const div = document.createElement('div');
            div.className = 'row mb-2 align-items-center';
            div.innerHTML = `
                <div class="col-5">
                    <div class="form-check">
                        <input class="form-check-input centro-checkbox" type="checkbox" value="${centro.id}" id="chk-centro-${centro.id}">
                        <label class="form-check-label" for="chk-centro-${centro.id}">${centro.nome}</label>
                    </div>
                </div>
                <div class="col-7">
                    <input type="number" class="form-control centro-valor" data-centro-id="${centro.id}" step="0.01" placeholder="Valor" disabled>
                </div>`;
            container.appendChild(div);
        });
        this.adicionarListenersDivisao();
    }

    static adicionarListenersDivisao() {
        document.getElementById('lanc-valor').addEventListener('input', () => this.validarDivisao(true));
        document.querySelectorAll('.centro-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                e.target.closest('.row').querySelector('.centro-valor').disabled = !e.target.checked;
                this.validarDivisao(true);
            });
        });
        document.querySelectorAll('.centro-valor').forEach(input => input.addEventListener('input', () => this.validarDivisao(false)));
    }

    static validarDivisao(distribuir = false) {
        const valorPrincipal = parseFloat(document.getElementById('lanc-valor').value) || 0;
        const checkboxes = document.querySelectorAll('.centro-checkbox:checked');
        let totalDistribuido = 0;

        if (distribuir && checkboxes.length > 0) {
            const valorPorCentro = valorPrincipal / checkboxes.length;
            checkboxes.forEach(cb => {
                cb.closest('.row').querySelector('.centro-valor').value = valorPorCentro.toFixed(2);
            });
        }
        
        document.querySelectorAll('.centro-valor:not(:disabled)').forEach(input => {
            totalDistribuido += parseFloat(input.value) || 0;
        });

        const diferenca = valorPrincipal - totalDistribuido;
        const resumoDiv = document.getElementById('resumo-divisao');
        resumoDiv.innerHTML = `
            <div class="d-flex justify-content-between">
                <small>Valor Total: <strong>${window.App.formatarMoeda(valorPrincipal)}</strong></small>
                <small>Distribuído: <strong>${window.App.formatarMoeda(totalDistribuido)}</strong></small>
                <small class="fw-bold ${Math.abs(diferenca) > 0.01 ? 'text-danger' : 'text-success'}">
                    Diferença: <strong>${window.App.formatarMoeda(diferenca)}</strong>
                </small>
            </div>`;
    }
    
    static alternarRecorrencia() {
        const tipo = document.getElementById('tipo-recorrencia').value;
        const container = document.getElementById('container-recorrencia');
        container.innerHTML = '';
        container.style.display = 'none';
        const valorPrincipalInput = document.getElementById('lanc-valor');
        valorPrincipalInput.readOnly = false;

        if (tipo === 'parcelado') {
            container.innerHTML = `
                <div class="row"><div class="col-md-6 mb-3"><label class="form-label">Valor Total da Compra</label><input type="number" class="form-control" id="recorrencia-valor-total" step="0.01" placeholder="Ex: 1200.00"></div><div class="col-md-6 mb-3"><label class="form-label">Número de Parcelas</label><input type="number" class="form-control" id="recorrencia-num-parcelas" step="1" min="2" placeholder="Ex: 12"></div></div>`;
            container.style.display = 'block';
            
            const valorTotalInput = document.getElementById('recorrencia-valor-total');
            const numParcelasInput = document.getElementById('recorrencia-num-parcelas');
            
            const calcularParcela = () => {
                const total = parseFloat(valorTotalInput.value) || 0;
                const parcelas = parseInt(numParcelasInput.value) || 1;
                valorPrincipalInput.value = (total / parcelas).toFixed(2);
                valorPrincipalInput.readOnly = true;
                valorPrincipalInput.dispatchEvent(new Event('input'));
            };
            valorTotalInput.addEventListener('input', calcularParcela);
            numParcelasInput.addEventListener('input', calcularParcela);
        } else if (tipo === 'recorrente') {
            container.innerHTML = `<div class="mb-3"><label class="form-label">Repetir por quantos meses?</label><input type="number" id="recorrencia-meses" class="form-control" value="12" min="1"></div>`;
            container.style.display = 'block';
        }
    }

    static abrirAdicaoRapida(tipo) {
        const addModalTitle = document.getElementById('addModalTitle');
        const addModalBody = document.getElementById('addModalBody');
        const saveAddButton = document.getElementById('saveAddButton');
        
        let title = '';
        let formHtml = '';

        switch(tipo) {
            case 'categoria':
                const tipoCategoria = document.querySelector('input[name="tipo"]:checked').value;
                title = `Adicionar Nova Categoria de ${tipoCategoria}`;
                formHtml = `<input type="text" id="add-item-nome" class="form-control" placeholder="Nome da categoria">`;
                break;
            case 'fonte':
                title = 'Adicionar Nova Fonte/Conta';
                formHtml = `
                    <div class="mb-2"><input type="text" id="add-item-nome" class="form-control" placeholder="Nome da Fonte"></div>
                    <div class="mb-2"><select id="add-item-tipo" class="form-select"><option value="Banco">Banco</option><option value="Cartão">Cartão</option><option value="Dinheiro">Dinheiro</option></select></div>
                    <div class="mb-2"><select id="add-item-moeda" class="form-select">${window.App.state.appConfig.moedas.map(m => `<option value="${m.codigo}">${m.codigo}</option>`).join('')}</select></div>
                    <hr>
                    <div class="form-check form-switch mb-3">
                        <input class="form-check-input" type="checkbox" id="add-fonte-agrupavel">
                        <label class="form-check-label" for="add-fonte-agrupavel">Agrupar lançamentos</label>
                    </div>
                    <div id="container-add-agrupamento" style="display:none;">
                        <div class="row">
                            <div class="col-6"><label class="form-label">Dia Fechamento</label><input type="number" id="add-fonte-dia-fechamento" class="form-control" min="1" max="31"></div>
                            <div class="col-6"><label class="form-label">Dia Vencimento</label><input type="number" id="add-fonte-dia-vencimento" class="form-control" min="1" max="31"></div>
                        </div>
                    </div>`;
                break;
            case 'centro':
                title = 'Adicionar Novo Centro de Custo';
                formHtml = `<input type="text" id="add-item-nome" class="form-control" placeholder="Nome do centro de custo">`;
                break;
        }

        addModalTitle.textContent = title;
        addModalBody.innerHTML = formHtml;
        
        if (tipo === 'fonte') {
            document.getElementById('add-fonte-agrupavel').addEventListener('change', (e) => {
                document.getElementById('container-add-agrupamento').style.display = e.target.checked ? 'block' : 'none';
            });
        }
        
        saveAddButton.onclick = () => this.salvarAdicaoRapida(tipo);
        this.addModalInstance.show();
    }

    static async salvarAdicaoRapida(tipo) {
        const nome = document.getElementById('add-item-nome').value.trim();
        if (!nome) return window.App.mostrarToast('O nome é obrigatório.', 'warning');
        
        try {
            let config = { ...window.App.state.appConfig };
            let selectParaAtualizar, valorParaSelecionar = nome;

            if (tipo === 'categoria') {
                const tipoCat = document.querySelector('input[name="tipo"]:checked').value;
                const key = tipoCat === 'Despesa' ? 'categoriasDespesa' : 'categoriasReceita';
                config[key] = [...(config[key] || []), nome];
                selectParaAtualizar = document.getElementById('lanc-categoria');
            } else if (tipo === 'fonte') {
                const novaFonte = {
                    id: `fonte_${Date.now()}`, // Adiciona um ID único
                    nome: nome,
                    tipo: document.getElementById('add-item-tipo').value,
                    moeda: document.getElementById('add-item-moeda').value,
                    agrupavel: document.getElementById('add-fonte-agrupavel').checked,
                    diaFechamento: parseInt(document.getElementById('add-fonte-dia-fechamento').value) || null,
                    diaVencimento: parseInt(document.getElementById('add-fonte-dia-vencimento').value) || null
                };
                config.fontes = [...(config.fontes || []), novaFonte];
                selectParaAtualizar = document.getElementById('lanc-fonte');
                valorParaSelecionar = novaFonte.nome; // Seleciona pelo nome
            } else if (tipo === 'centro') {
                const novoCentroId = await criarNovoCentroCusto(window.App.state.usuarioLogado.uid, nome);
                window.App.state.centrosCustoUsuario = await getCentrosCustoUsuario(window.App.state.usuarioLogado.uid);
                selectParaAtualizar = document.getElementById('lanc-centro-custo');
                valorParaSelecionar = novoCentroId;
            }

            if (tipo === 'categoria' || tipo === 'fonte') {
                await atualizarConfiguracoes(window.App.state.usuarioLogado.uid, config);
                window.App.state.appConfig = config;
            }

            await this.popularSelects();
            if (selectParaAtualizar) selectParaAtualizar.value = valorParaSelecionar;
            selectParaAtualizar.dispatchEvent(new Event('change'));

            this.addModalInstance.hide();
            window.App.mostrarToast(`${tipo.charAt(0).toUpperCase() + tipo.slice(1)} adicionado(a)!`, 'success');
        } catch (error) {
            window.App.mostrarToast(`Erro ao adicionar ${tipo}`, 'error');
        }
    }
    
    static gerarPreview() {
        try {
            const form = this.coletarDadosDoFormulario();
            const lancamentos = this.processarRecorrencia(form);
            
            let previewHtml = `<h6>Será(ão) criado(s) ${lancamentos.length} lançamento(s):</h6>`;
            previewHtml += '<ul class="list-group">';

            lancamentos.forEach(lanc => {
                const centroNome = window.App.state.centrosCustoUsuario.find(c => c.id === lanc.centroCustoIds[0])?.nome;
                previewHtml += `
                    <li class="list-group-item">
                        <strong>${lanc.descricao}</strong><br>
                        <small>Valor: ${window.App.formatarMoeda(lanc.valorOriginal, lanc.moedaOriginal)}</small><br>
                        <small>Vencimento: ${lanc.dataVencimento.toLocaleDateString()}</small><br>
                        <small>Centro de Custo: ${centroNome}</small>
                    </li>`;
            });

            previewHtml += '</ul>';
            document.getElementById('preview-content').innerHTML = previewHtml;
            this.previewModalInstance.show();
        } catch (error) {
            window.App.mostrarToast(`Erro ao gerar preview: ${error.message}`, 'error');
        }
    }

    static coletarDadosDoFormulario() {
        const form = {};
        form.descricao = document.getElementById('lanc-descricao').value;
        form.valor = parseFloat(document.getElementById('lanc-valor').value);
        form.moedaOriginal = document.getElementById('lanc-moeda').value;
        form.dataLancamento = new Date(document.getElementById('lanc-data').value + 'T00:00:00Z');
        form.dataVencimento = new Date(document.getElementById('lanc-data-vencimento').value + 'T00:00:00Z');
        form.tipo = document.querySelector('input[name="tipo"]:checked').value;
        form.categoria = document.getElementById('lanc-categoria').value;
        form.fonteId = document.getElementById('lanc-fonte').value; // Coleta o nome da fonte
        
        form.dividir = document.getElementById('dividir-centros').checked;
        if (form.dividir) {
            form.divisoes = [];
            document.querySelectorAll('.centro-checkbox:checked').forEach(cb => {
                form.divisoes.push({
                    centroCustoId: cb.value,
                    valor: parseFloat(cb.closest('.row').querySelector('.centro-valor').value)
                });
            });
            if(form.divisoes.length === 0) throw new Error("Selecione pelo menos um centro de custo para dividir.");
        } else {
            form.divisoes = [{ centroCustoId: document.getElementById('lanc-centro-custo').value, valor: form.valor }];
        }

        form.tipoRecorrencia = document.getElementById('tipo-recorrencia').value;
        if (form.tipoRecorrencia === 'parcelado') {
            form.totalParcelas = parseInt(document.getElementById('recorrencia-num-parcelas').value);
        } else if (form.tipoRecorrencia === 'recorrente') {
            form.totalRecorrencias = parseInt(document.getElementById('recorrencia-meses').value);
        }
        
        return form;
    }

    static converterParaMoedaPrincipal(valor, moedaOrigem) {
        const config = window.App.state.appConfig;
    
        // Se a moeda for a mesma, retorna o valor original
        if (moedaOrigem === config.moedaPrincipal) {
            return valor;
        }
    
        const moedas = config.moedas || [];
        const moedaOrigemData = moedas.find(m => m.codigo === moedaOrigem);
        const moedaPrincipalData = moedas.find(m => m.codigo === config.moedaPrincipal);
    
        if (!moedaOrigemData || !moedaPrincipalData) {
            console.warn(`Taxa de câmbio não encontrada. Origem: ${moedaOrigem}, Principal: ${config.moedaPrincipal}`);
            return valor; 
        }
    
        // Conversão correta: valor na moeda origem / taxa origem * taxa principal
        // Se BRL tem taxa 6 e EUR tem taxa 1: 96 BRL / 6 * 1 = 16 EUR
        const valorConvertido = (valor / moedaOrigemData.taxa) * moedaPrincipalData.taxa;
    
        console.log(`Convertendo ${valor} ${moedaOrigem} para ${config.moedaPrincipal}: ${valorConvertido}`);
        return valorConvertido;
    }

    static calcularFaturaId(fonteId, dataVencimento) {
        const fonte = window.App.state.appConfig.fontes.find(f => f.nome === fonteId);
        if (!fonte || !fonte.agrupavel) return null;
    
        const dataVenc = new Date(dataVencimento);
        let mesReferencia = dataVenc.getMonth();
        let anoReferencia = dataVenc.getFullYear();
    
        // Se o dia do vencimento é ANTES do fechamento, pertence ao mês atual
        // Se é DEPOIS, pertence ao próximo mês
        if (dataVenc.getDate() > fonte.diaFechamento) {
            mesReferencia += 1;
            if (mesReferencia > 11) {
                mesReferencia = 0;
                anoReferencia += 1;
            }
        }
    
        const mesFormatado = String(mesReferencia + 1).padStart(2, '0');
        return `${fonteId.toLowerCase()}-${anoReferencia}-${mesFormatado}`;
    }

    static calcularDataVencimento(fonteId, dataVencimento) {
        const fonte = window.App.state.appConfig.fontes.find(f => f.nome === fonteId);
        if (!fonte || !fonte.agrupavel) return new Date(dataVencimento);
    
        const dataVenc = new Date(dataVencimento);
        let mesVencimento = dataVenc.getMonth();
        let anoVencimento = dataVenc.getFullYear();
    
        // Lógica igual ao faturaId
        if (dataVenc.getDate() > fonte.diaFechamento) {
            mesVencimento += 1;
            if (mesVencimento > 11) {
                mesVencimento = 0;
                anoVencimento += 1;
            }
        }
    
        return new Date(anoVencimento, mesVencimento, fonte.diaVencimento);
    }
}