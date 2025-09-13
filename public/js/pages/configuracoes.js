import {
    getConfiguracoes,
    getUsuario,
    atualizarConfiguracoes,
    criarPerfilUsuario,
    criarNovoCentroCusto,
    removerCentroCusto,
    getCentrosCustoUsuario,
    getEmailsFromUserIds,
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
    static itemEmEdicao = null;
    static editModalInstance = null;

    static inicializar() {
        const editModalEl = document.getElementById('editModal');
        if (editModalEl) {
            this.editModalInstance = new bootstrap.Modal(editModalEl);
            document.getElementById('saveEditButton').addEventListener('click', this.salvarEdicao.bind(this));
        }
        this.configurarEventos();
        this.carregarDados();
    }

    static configurarEventos() {
        const formPerfil = document.getElementById('form-perfil');
        if (formPerfil) {
            formPerfil.addEventListener('submit', this.salvarPerfil.bind(this));
        }
    }

    static async salvarPerfil(event) {
        event.preventDefault();
        try {
            window.App.mostrarLoading(true, '#form-perfil button');
            const userId = window.App.state.usuarioLogado.uid;
            const dadosPerfil = { ...this.dados.perfil, nome: document.getElementById('perfil-nome').value };
            const dadosConfig = { ...this.dados.config, moedaPrincipal: document.getElementById('perfil-moeda').value };
            await Promise.all([
                criarPerfilUsuario(userId, dadosPerfil),
                atualizarConfiguracoes(userId, dadosConfig)
            ]);
            this.dados.perfil = dadosPerfil;
            this.dados.config = dadosConfig;
            window.App.mostrarToast('Perfil atualizado com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao salvar perfil:', error);
            window.App.mostrarToast('Erro ao salvar perfil', 'error');
        } finally {
            window.App.mostrarLoading(false, '#form-perfil button');
        }
    }

    static async carregarDados() {
        try {
            window.App.mostrarLoading(true);
            const userId = window.App.state.usuarioLogado.uid;
            
            const [perfil, config, centrosCusto] = await Promise.all([
                getUsuario(userId),
                getConfiguracoes(userId),
                getCentrosCustoUsuario(userId)
            ]);

            const promessasDeEmails = centrosCusto.map(centro => 
                getEmailsFromUserIds(centro.usuariosCompartilhados)
            );

            const listasDeEmails = await Promise.all(promessasDeEmails);

            centrosCusto.forEach((centro, index) => {
                centro.emailsCompartilhados = listasDeEmails[index];
            });

            this.dados = { perfil, config, centrosCusto };
            this.preencherFormulario();
            this.atualizarListas();
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
            window.App.mostrarToast('Erro ao carregar configurações', 'error');
        } finally {
            window.App.mostrarLoading(false);
        }
    }

    static preencherFormulario() {
        document.getElementById('perfil-nome').value = this.dados.perfil.nome || '';
        document.getElementById('perfil-email').value = this.dados.perfil.email || '';
        this.popularSelectMoedas();
    }

    static popularSelectMoedas() {
        // Removemos a referência ao 'nova-fonte-moeda' que não existe mais
        const selectPerfilMoeda = document.getElementById('perfil-moeda');
        
        selectPerfilMoeda.innerHTML = ''; // Limpa apenas o select de perfil
        
        this.dados.config.moedas?.forEach(moeda => {
            const optionHTML = `<option value="${moeda.codigo}">${moeda.codigo}</option>`;
            selectPerfilMoeda.innerHTML += optionHTML;
        });

        selectPerfilMoeda.value = this.dados.config.moedaPrincipal || 'EUR';
    }sss

    static atualizarListas() {
        this.atualizarListaCentrosCusto();
        this.atualizarListaFontes();
        this.atualizarListaMoedas();
        this.atualizarListaCategorias();
    }

    static atualizarListaCentrosCusto() {
        const container = document.getElementById('lista-centros-custo');
        container.innerHTML = '';
        const idPrincipal = this.dados.config.centroCustoPrincipalId; // Pega o ID do principal

        this.dados.centrosCusto?.forEach(centro => {
            const isPrincipal = centro.id === idPrincipal;
            const isProprietario = centro.proprietarioId === window.App.state.usuarioLogado.uid;

            // Gera a lista de e-mails compartilhados com o botão de remover
            const sharedUsersHtml = centro.emailsCompartilhados
                .map(email => `
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="badge bg-secondary">${email}</span>
                    <button class="btn btn-sm btn-link text-danger p-0" onclick="removerUsuarioCompartilhado('${centro.id}', '${email}')" title="Remover acesso">
                       <i class="fas fa-times"></i>
                    </button>
                </div>`).join('');

            container.innerHTML += `
            <div class="list-group-item ${isPrincipal ? 'list-group-item-primary' : ''}">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div>
                        <strong>${centro.nome}</strong>
                        ${isPrincipal ? '<span class="badge bg-primary ms-2">Principal</span>' : ''}
                    </div>
                    <div>
                        ${!isPrincipal && isProprietario ? `
                        <button class="btn btn-sm btn-outline-primary me-2" onclick="definirComoPrincipal('${centro.id}')" title="Definir como Principal">
                            <i class="fas fa-star"></i>
                        </button>
                        ` : ''}
                        
                        <button class="btn btn-sm btn-outline-secondary me-2" onclick="abrirEdicao('centro', '${centro.id}')" title="Editar">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                        
                        <button class="btn btn-sm btn-outline-danger" onclick="removerCentroCusto('${centro.id}')" title="Remover">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="mt-2">
                    <small class="text-muted">Compartilhado com:</small>
                    ${sharedUsersHtml || '<p class="small text-muted fst-italic mt-1">Ninguém.</p>'}
                    <button class="btn btn-sm btn-outline-info mt-2" onclick="compartilharCentro('${centro.id}')">
                       <i class="fas fa-plus me-1"></i> Adicionar
                    </button>
                </div>
            </div>`;
        });
    }

    static async definirComoPrincipal(centroId) {
        try {
            await this.atualizarConfig({ centroCustoPrincipalId: centroId });
            window.App.mostrarToast('Centro de custo principal definido!', 'success');
        } catch (error) {
            window.App.mostrarToast('Erro ao definir centro principal', 'error');
        }
    }

    static atualizarListaFontes() {
        const container = document.getElementById('lista-fontes');
        container.innerHTML = '';
        this.dados.config.fontes?.forEach((fonte, index) => {
            container.innerHTML += `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <strong>${fonte.nome}</strong>
                    <small class="text-muted ms-2">${fonte.tipo} (${fonte.moeda})</small>
                </div>
                <div>
                    <button class="btn btn-sm btn-outline-secondary me-2" onclick="abrirEdicao('fonte', ${index})" title="Editar">
                       <i class="fas fa-pencil-alt"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="removerFonte(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>`;
        });
    }

    static atualizarListaMoedas() {
        const container = document.getElementById('lista-moedas');
        container.innerHTML = '';
        this.dados.config.moedas?.forEach((moeda, index) => {
            const isPrincipal = moeda.codigo === this.dados.config.moedaPrincipal;
            container.innerHTML += `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <strong>${moeda.codigo}</strong>
                    <small class="text-muted ms-2">Taxa: ${moeda.taxa}</small>
                    ${isPrincipal ? '<span class="badge bg-primary ms-2">Principal</span>' : ''}
                </div>
                <div>
                    <button class="btn btn-sm btn-outline-secondary me-2" onclick="abrirEdicao('moeda', ${index})" title="Editar">
                       <i class="fas fa-pencil-alt"></i>
                    </button>
                    ${!isPrincipal ? `<button class="btn btn-sm btn-outline-danger" onclick="removerMoeda(${index})"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            </div>`;
        });
    }

    static atualizarListaCategorias() {
        ['despesa', 'receita'].forEach(tipo => {
            const container = document.getElementById(`lista-categorias-${tipo}`);
            const configKey = tipo === 'despesa' ? 'categoriasDespesa' : 'categoriasReceita';
            container.innerHTML = '';
            this.dados.config[configKey]?.forEach((categoria, index) => {
                container.innerHTML += `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <span>${categoria}</span>
                    <div>
                        <button class="btn btn-sm btn-outline-secondary me-2" onclick="abrirEdicao('categoria', ${index}, '${tipo}')" title="Editar">
                           <i class="fas fa-pencil-alt"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="removerCategoria('${tipo}', ${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>`;
            });
        });
    }

    static async salvarEdicao() {
        const { tipo, idOuIndex, extraParam } = this.itemEmEdicao;
        try {
            const userId = window.App.state.usuarioLogado.uid;
            let configAtualizado = { ...this.dados.config };
            let sucesso = false;

            switch (tipo) {
                case 'centro':
                    const novoNomeCentro = document.getElementById('edit-valor').value;
                    await atualizarNomeCentroCusto(idOuIndex, novoNomeCentro);
                    sucesso = true;
                    break;
                case 'fonte':
                    const fontes = [...configAtualizado.fontes];
                    const novaFonte = {
                        nome: document.getElementById('edit-fonte-nome').value,
                        tipo: document.getElementById('edit-fonte-tipo').value,
                        moeda: document.getElementById('edit-fonte-moeda').value,
                        agrupavel: document.getElementById('edit-fonte-agrupavel').checked,
                        diaFechamento: parseInt(document.getElementById('edit-fonte-dia-fechamento').value) || null,
                        diaVencimento: parseInt(document.getElementById('edit-fonte-dia-vencimento').value) || null
                    };
                    if (idOuIndex !== null) { fontes[idOuIndex] = novaFonte; } 
                    else { fontes.push(novaFonte); }
                    configAtualizado.fontes = fontes;
                    sucesso = true;
                    break;
            }
            
            if(sucesso) {
                 if(tipo !== 'centro') {
                    await atualizarConfiguracoes(userId, configAtualizado);
                    window.App.state.appConfig = configAtualizado;
                 }
                window.App.mostrarToast(`${tipo.charAt(0).toUpperCase() + tipo.slice(1)} atualizado(a)!`, 'success');
                this.editModalInstance.hide();
                await this.carregarDados();
            }
        } catch (error) {
            console.error(`Erro ao salvar edição de ${tipo}:`, error);
            window.App.mostrarToast(`Erro ao atualizar ${tipo}`, 'error');
        }
    }

    static abrirAdicao(tipo) {
        this.itemEmEdicao = { tipo, idOuIndex: null }; 
        const modalTitle = document.getElementById('editModalTitle');
        const modalBody = document.getElementById('editModalBody');
        let formHtml = '';

        if (tipo === 'fonte') {
            modalTitle.textContent = 'Adicionar Nova Fonte';
            formHtml = `
                <div class="mb-3">
                    <label class="form-label">Nome</label>
                    <input type="text" id="edit-fonte-nome" class="form-control" required>
                </div>
                <div class="mb-3">
                    <label class="form-label">Tipo</label>
                    <select id="edit-fonte-tipo" class="form-select">
                        <option value="Banco">Banco</option>
                        <option value="Cartão">Cartão</option>
                        <option value="Dinheiro">Dinheiro</option>
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label">Moeda</label>
                    <select id="edit-fonte-moeda" class="form-select">
                        ${this.dados.config.moedas.map(m => `<option value="${m.codigo}">${m.codigo}</option>`).join('')}
                    </select>
                </div>
                <hr>
                <div class="form-check form-switch mb-3">
                    <input class="form-check-input" type="checkbox" id="edit-fonte-agrupavel">
                    <label class="form-check-label" for="edit-fonte-agrupavel">Agrupar lançamentos (Ex: Fatura de Cartão)</label>
                </div>
                <div id="container-agrupamento-opcoes" style="display:none;">
                    <div class="row">
                        <div class="col-6"><label class="form-label">Dia do Fechamento</label><input type="number" id="edit-fonte-dia-fechamento" class="form-control" min="1" max="31"></div>
                        <div class="col-6"><label class="form-label">Dia do Vencimento</label><input type="number" id="edit-fonte-dia-vencimento" class="form-control" min="1" max="31"></div>
                    </div>
                </div>
            `;
            modalBody.innerHTML = formHtml;
            // Adiciona o evento para mostrar/esconder as opções de agrupamento
            document.getElementById('edit-fonte-agrupavel').addEventListener('change', (e) => {
                document.getElementById('container-agrupamento-opcoes').style.display = e.target.checked ? 'block' : 'none';
            });
        }
        
        this.editModalInstance.show();
    }

    static abrirEdicao(tipo, idOuIndex, extraParam = null) {
        this.itemEmEdicao = { tipo, idOuIndex, extraParam };
        const modalTitle = document.getElementById('editModalTitle');
        const modalBody = document.getElementById('editModalBody');
        let formHtml = '';
        
        switch (tipo) {
            case 'centro':
                const centro = this.dados.centrosCusto.find(c => c.id === idOuIndex);
                modalTitle.textContent = 'Editar Centro de Custo';
                formHtml = `<div class="mb-3"><label class="form-label">Nome</label><input type="text" id="edit-valor" class="form-control" value="${centro.nome}"></div>`;
                break;

            case 'fonte':
                const fonte = this.dados.config.fontes[idOuIndex];
                modalTitle.textContent = 'Editar Fonte';
                formHtml = `
                    <div class="mb-3"><label class="form-label">Nome</label><input type="text" id="edit-fonte-nome" class="form-control" value="${fonte.nome}"></div>
                    <div class="mb-3"><label class="form-label">Tipo</label><select id="edit-fonte-tipo" class="form-select"><option value="Banco" ${fonte.tipo === 'Banco' ? 'selected' : ''}>Banco</option><option value="Cartão" ${fonte.tipo === 'Cartão' ? 'selected' : ''}>Cartão</option><option value="Dinheiro" ${fonte.tipo === 'Dinheiro' ? 'selected' : ''}>Dinheiro</option></select></div>
                    <div class="mb-3"><label class="form-label">Moeda</label><select id="edit-fonte-moeda" class="form-select">${this.dados.config.moedas.map(m => `<option value="${m.codigo}" ${fonte.moeda === m.codigo ? 'selected' : ''}>${m.codigo}</option>`).join('')}</select></div>
                    <hr>
                    <div class="form-check form-switch mb-3">
                        <input class="form-check-input" type="checkbox" id="edit-fonte-agrupavel" ${fonte.agrupavel ? 'checked' : ''}>
                        <label class="form-check-label" for="edit-fonte-agrupavel">Agrupar lançamentos (Ex: Fatura de Cartão)</label>
                    </div>
                    <div id="container-agrupamento-opcoes" style="display:${fonte.agrupavel ? 'block' : 'none'};">
                        <div class="row">
                            <div class="col-6"><label class="form-label">Dia do Fechamento</label><input type="number" id="edit-fonte-dia-fechamento" class="form-control" min="1" max="31" value="${fonte.diaFechamento || ''}"></div>
                            <div class="col-6"><label class="form-label">Dia do Vencimento</label><input type="number" id="edit-fonte-dia-vencimento" class="form-control" min="1" max="31" value="${fonte.diaVencimento || ''}"></div>
                        </div>
                    </div>`;
                modalBody.innerHTML = formHtml;
                document.getElementById('edit-fonte-agrupavel').addEventListener('change', (e) => {
                    document.getElementById('container-agrupamento-opcoes').style.display = e.target.checked ? 'block' : 'none';
                });
                break;
            
            case 'moeda':
                const moeda = this.dados.config.moedas[idOuIndex];
                modalTitle.textContent = 'Editar Moeda';
                formHtml = `
                    <div class="mb-3"><label class="form-label">Código</label><input type="text" id="edit-moeda-codigo" class="form-control" value="${moeda.codigo}"></div>
                    <div class="mb-3"><label class="form-label">Taxa de Câmbio</label><input type="number" step="0.0001" id="edit-moeda-taxa" class="form-control" value="${moeda.taxa}"></div>`;
                break;

            case 'categoria':
                const configKey = extraParam === 'despesa' ? 'categoriasDespesa' : 'categoriasReceita';
                const categoria = this.dados.config[configKey][idOuIndex];
                modalTitle.textContent = 'Editar Categoria';
                formHtml = `<div class="mb-3"><label class="form-label">Nome</label><input type="text" id="edit-valor" class="form-control" value="${categoria}"></div>`;
                break;
        }
        
        if (tipo !== 'fonte') {
             modalBody.innerHTML = formHtml;
        }
        this.editModalInstance.show();
    }


    static async salvarEdicao() {
        const { tipo, idOuIndex, extraParam } = this.itemEmEdicao;
        try {
            const userId = window.App.state.usuarioLogado.uid;
            let configAtualizado = { ...this.dados.config };

            switch (tipo) {
                case 'centro':
                    const novoNomeCentro = document.getElementById('edit-valor').value;
                    if (!novoNomeCentro) return window.App.mostrarToast('O nome não pode ser vazio.', 'warning');
                    await atualizarNomeCentroCusto(idOuIndex, novoNomeCentro);
                    break;
                case 'fonte':
                    const fontes = [...configAtualizado.fontes];
                    const fonteEditada = {
                        nome: document.getElementById('edit-fonte-nome').value,
                        tipo: document.getElementById('edit-fonte-tipo').value,
                        moeda: document.getElementById('edit-fonte-moeda').value,
                        agrupavel: document.getElementById('edit-fonte-agrupavel').checked,
                        diaFechamento: parseInt(document.getElementById('edit-fonte-dia-fechamento').value) || null,
                        diaVencimento: parseInt(document.getElementById('edit-fonte-dia-vencimento').value) || null
                    };
                    if (!fonteEditada.nome) return window.App.mostrarToast('O nome da fonte é obrigatório.', 'warning');
                    fontes[idOuIndex] = fonteEditada;
                    configAtualizado.fontes = fontes;
                    await atualizarConfiguracoes(userId, configAtualizado);
                    window.App.state.appConfig.fontes = fontes;
                    break;
                case 'moeda':
                    const moedas = [...configAtualizado.moedas];
                    moedas[idOuIndex] = { 
                        codigo: document.getElementById('edit-moeda-codigo').value.toUpperCase(), 
                        taxa: parseFloat(document.getElementById('edit-moeda-taxa').value) 
                    };
                    await atualizarConfiguracoes(userId, { moedas });
                    window.App.state.appConfig.moedas = moedas;
                    break;
                case 'categoria':
                    const configKey = extraParam === 'despesa' ? 'categoriasDespesa' : 'categoriasReceita';
                    const categorias = [...configAtualizado[configKey]];
                    const novoNomeCategoria = document.getElementById('edit-valor').value;
                    if (!novoNomeCategoria) return window.App.mostrarToast('O nome da categoria não pode ser vazio.', 'warning');
                    categorias[idOuIndex] = novoNomeCategoria;
                    await atualizarConfiguracoes(userId, { [configKey]: categorias });
                    window.App.state.appConfig[configKey] = categorias;
                    break;
            }
            
            window.App.mostrarToast(`${tipo.charAt(0).toUpperCase() + tipo.slice(1)} atualizado(a)!`, 'success');
            this.editModalInstance.hide();
            await this.carregarDados();

        } catch (error) {
            console.error(`Erro ao salvar edição de ${tipo}:`, error);
            window.App.mostrarToast(`Erro ao atualizar ${tipo}`, 'error');
        }
    }

    static async adicionarFonte() {
        const nome = document.getElementById('nova-fonte-nome')?.value?.trim();
        const tipo = document.getElementById('nova-fonte-tipo')?.value;
        const moeda = document.getElementById('nova-fonte-moeda')?.value;
    
        if (!nome || !tipo || !moeda) {
            window.App.mostrarToast('Preencha todos os campos', 'warning');
            return;
        }
    
        const novaFonte = { nome, tipo, moeda, agrupavel: false };
    
        try {
            const userId = window.App.state.usuarioLogado.uid;
            const configAtualizada = { ...this.dados.config };
            configAtualizada.fontes = [...(configAtualizada.fontes || []), novaFonte];
        
            await atualizarConfiguracoes(userId, configAtualizada);
            window.App.mostrarToast('Fonte criada!', 'success');
            await this.carregarDados();
        } catch (error) {
            window.App.mostrarToast('Erro ao criar fonte', 'error');
        }
    }

    static async removerFonte(index) {
        if (!confirm('Tem certeza?')) return;
        const fontes = [...this.dados.config.fontes];
        fontes.splice(index, 1);
        await this.atualizarConfig({ fontes });
    }

    static async adicionarMoeda() {
        const codigoInput = document.getElementById('nova-moeda-codigo');
        const taxaInput = document.getElementById('nova-moeda-taxa');
        const codigo = codigoInput.value.trim().toUpperCase();
        const taxa = parseFloat(taxaInput.value);
        if (!codigo || !taxa) return window.App.mostrarToast('Preencha o código e a taxa', 'warning');
        const moedasAtuais = [...(this.dados.config.moedas || [])];
        if (moedasAtuais.some(m => m.codigo === codigo)) return window.App.mostrarToast('Essa moeda já existe.', 'error');
        moedasAtuais.push({ codigo, taxa });
        await this.atualizarConfig({ moedas: moedasAtuais });
        codigoInput.value = '';
        taxaInput.value = '';
    }

    static async removerMoeda(index) {
        if (!confirm('Tem certeza?')) return;
        const moedas = [...this.dados.config.moedas];
        moedas.splice(index, 1);
        await this.atualizarConfig({ moedas });
    }

    static async adicionarCategoria(tipo) {
        const input = document.getElementById(`nova-categoria-${tipo}`);
        const categoria = input.value.trim();
    
        if (!categoria) {
            window.App.mostrarToast('Digite uma categoria', 'warning');
            return;
        }
    
        try {
            const userId = window.App.state.usuarioLogado.uid;
            const configAtualizada = { ...this.dados.config };
            const chave = tipo === 'despesa' ? 'categoriasDespesa' : 'categoriasReceita';
        
            configAtualizada[chave] = [...(configAtualizada[chave] || []), categoria];
        
            await atualizarConfiguracoes(userId, configAtualizada);
            window.App.mostrarToast('Categoria criada!', 'success');
            input.value = '';
            await this.carregarDados();
        } catch (error) {
            window.App.mostrarToast('Erro ao criar categoria', 'error');
        }
    }

    static async removerCategoria(tipo, index) {
        if (!confirm('Tem certeza?')) return;
        const configKey = tipo === 'despesa' ? 'categoriasDespesa' : 'categoriasReceita';
        const categorias = [...this.dados.config[configKey]];
        categorias.splice(index, 1);
        await this.atualizarConfig({ [configKey]: categorias });
    }

    static async adicionarCentroCusto() {
        const input = document.getElementById('novo-centro-custo');
        const nome = input.value.trim();
    
        if (!nome) {
            window.App.mostrarToast('Digite um nome para o centro de custo', 'warning');
            return;
        }
    
        try {
            const userId = window.App.state.usuarioLogado.uid;
            await criarNovoCentroCusto(nome, userId);
            window.App.mostrarToast('Centro de custo criado!', 'success');
            input.value = '';
            await this.carregarDados();
        } catch (error) {
            console.error('Erro ao criar centro:', error);
            window.App.mostrarToast('Erro ao criar centro de custo', 'error');
        }
    }

    static async removerCentroCusto(centroId) {
        if (!confirm('Tem certeza?')) return;
        try {
            await removerCentroCusto(centroId);
            window.App.mostrarToast('Centro de custo removido!', 'success');
            await this.carregarDados();
            window.App.state.centrosCustoUsuario = this.dados.centrosCusto;
        } catch (error) {
            window.App.mostrarToast('Erro ao remover centro de custo', 'error');
        }
    }

    static async salvarAdicao() {
        const { tipo } = this.itemEmEdicao;
        const userId = window.App.state.usuarioLogado.uid;
        let configAtualizado = { ...this.dados.config };

        try {
            if (tipo === 'fonte') {
                const fontes = [...(configAtualizado.fontes || [])];
                const novaFonte = {
                    nome: document.getElementById('add-fonte-nome').value,
                    tipo: document.getElementById('add-fonte-tipo').value,
                    moeda: document.getElementById('add-fonte-moeda').value,
                    agrupavel: document.getElementById('add-fonte-agrupavel').checked,
                    diaFechamento: parseInt(document.getElementById('add-fonte-dia-fechamento').value) || null,
                    diaVencimento: parseInt(document.getElementById('add-fonte-dia-vencimento').value) || null
                };

                // Validação
                if (!novaFonte.nome) {
                    return window.App.mostrarToast('O nome da fonte é obrigatório.', 'warning');
                }
                if (novaFonte.agrupavel && (!novaFonte.diaFechamento || !novaFonte.diaVencimento)) {
                    return window.App.mostrarToast('Para fontes agrupáveis, os dias de fechamento e vencimento são obrigatórios.', 'warning');
                }

                fontes.push(novaFonte);
                configAtualizado.fontes = fontes;

                await atualizarConfiguracoes(userId, configAtualizado);
                window.App.state.appConfig = configAtualizado;
                window.App.mostrarToast('Fonte adicionada com sucesso!', 'success');
                this.addModalInstance.hide();
                await this.carregarDados();
            }
        } catch (error) {
            console.error(`Erro ao adicionar ${tipo}:`, error);
            window.App.mostrarToast(`Erro ao adicionar ${tipo}`, 'error');
        }
    }

    static async atualizarConfig(updates) {
        try {
            const novaConfig = { ...this.dados.config, ...updates };
            await atualizarConfiguracoes(window.App.state.usuarioLogado.uid, novaConfig);
            this.dados.config = novaConfig;
            this.atualizarListas();
        } catch (error) {
            console.error('Erro ao atualizar configuração:', error);
            window.App.mostrarToast('Erro ao atualizar configuração', 'error');
        }
    }
}

// Vincula as funções da classe a funções globais para o HTML 'onclick'
window.adicionarFonte = () => ConfiguracoesController.abrirAdicao('fonte');
window.removerFonte = (index) => ConfiguracoesController.removerFonte(index);
window.adicionarMoeda = () => ConfiguracoesController.adicionarMoeda();
window.removerMoeda = (index) => ConfiguracoesController.removerMoeda(index);
window.adicionarCategoria = (tipo) => ConfiguracoesController.adicionarCategoria(tipo);
window.removerCategoria = (tipo, index) => ConfiguracoesController.removerCategoria(tipo, index);
window.adicionarCentroCusto = () => ConfiguracoesController.adicionarCentroCusto();
window.removerCentroCusto = (id) => ConfiguracoesController.removerCentroCusto(id);
window.abrirEdicao = (tipo, idOuIndex, extra) => ConfiguracoesController.abrirEdicao(tipo, idOuIndex, extra);
window.abrirAdicao = (tipo) => ConfiguracoesController.abrirAdicao(tipo);
window.definirComoPrincipal = (id) => ConfiguracoesController.definirComoPrincipal(id);

window.compartilharCentro = async (centroId) => {
    const email = prompt("Digite o e-mail do usuário para compartilhar:");
    if (email && email.trim() !== '') {
        try {
            await compartilharCentroCusto(centroId, email.trim());
            window.App.mostrarToast('Centro de custo compartilhado!', 'success');
            await ConfiguracoesController.carregarDados();
        } catch (error) {
            window.App.mostrarToast(error.message, 'error');
        }
    }
};

window.removerUsuarioCompartilhado = async (centroId, email) => {
    if (confirm(`Remover o acesso de ${email} a este centro de custo?`)) {
        try {
            await removerCompartilhamento(centroId, email);
            window.App.mostrarToast('Acesso removido!', 'success');
            await ConfiguracoesController.carregarDados();
        } catch (error) {
            window.App.mostrarToast(error.message, 'error');
        }
    }
};