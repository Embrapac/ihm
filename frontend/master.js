/* ============================================================
   MASTER.JS - NÚCLEO DO SISTEMA (Auth e Logs Automáticos)
   Versão Final: Produção Contínua (PLC Real)
   ============================================================ */

/* --- 1. CONFIGURAÇÕES --- */
const CONFIG = {
    AUTH_TIMEOUT: {
    'operador': 480, // 8 horas (duração do turno)
    'admin': 15      // 15 minutos (por segurança)
},
    USUARIOS: {
        'operador': { pass: 'operador', nome: 'Sr. Agenor', cargo: 'Operador', nivel: 1 },
        'admin':    { pass: 'admin',    nome: 'Sr. Carlos', cargo: 'Supervisor', nivel: 2 },
        'manutencao': { pass: 'manu123', nome: 'Equipa Técnica', cargo: 'Manutenção', nivel: 3 }
    }
};

const ESTADO_PADRAO = {
    producao: 0, refugo: 0, meta: 5000, ciclo: 3, status: 'OPERANDO', 
    ultimoUpdate: Date.now(), turnoAtivo: false, horaInicioTurno: '--:--', 
    horaFimTurno: '--:--', horaFalha: '--:--', downtime: 0, oee: 0
};

/* --- 2. LOGGER --- */
const Logger = {
    registrar: (evento, tipo = 'NORMAL') => {
        let user = { nome: 'Sistema', cargo: 'Automático' };
        
        // Identifica com precisão quem está apertando o botão nesta aba
        if (typeof Sessao !== 'undefined') {
            const role = Sessao.obterPapelDestaAba();
            if (role) {
                const sessoes = Sessao._getSessoes();
                if (sessoes[role]) user = sessoes[role];
            }
        }
        
        const logs = JSON.parse(localStorage.getItem('embrapac_logs') || '[]');
        
        logs.unshift({
            timestamp: Date.now(), 
            data: new Date().toISOString(), // PADRÃO ISO
            evento: evento, 
            tipo: tipo, 
            usuario: user.nome, 
            cargo: user.cargo
        });
        
        if (logs.length > 300) logs.pop();
        localStorage.setItem('embrapac_logs', JSON.stringify(logs));
        
        if (typeof renderizarHistoricoCompleto === 'function') {
            renderizarHistoricoCompleto();
        }
    }
};

/* --- 3. SISTEMA DE SESSÃO (Cofre Multi-Usuário) --- */
const Sessao = {
    _getSessoes: function() {
        return JSON.parse(localStorage.getItem('embrapac_sessions') || '{}');
    },
    _setSessoes: function(sessoes) {
        localStorage.setItem('embrapac_sessions', JSON.stringify(sessoes));
    },

    iniciar: function(usuarioKey) {
        const dados = CONFIG.USUARIOS[usuarioKey];
        if (!dados) return false;
        
        const sessoes = this._getSessoes();
        sessoes[usuarioKey] = { ...dados, id: usuarioKey, ultimoAcesso: Date.now() };
        this._setSessoes(sessoes);
        
        // Remove a trava de deslogado ao fazer um novo login bem-sucedido
        sessionStorage.removeItem('embrapac_aba_deslogada');
        sessionStorage.setItem('embrapac_active_role', usuarioKey);
        localStorage.setItem('embrapac_last_role', usuarioKey); 
        
        Logger.registrar(`Login realizado: ${dados.nome}`, "INFORME");
        return true;
    },

    sair: function() {
        const role = this.obterPapelDestaAba();
        if (!role) return;

        const sessoes = this._getSessoes();
        const user = sessoes[role];
        const nome = user ? user.nome : 'Usuário';

        delete sessoes[role];
        this._setSessoes(sessoes);
        
        // Coloca a etiqueta nesta aba para ela não puxar outro login ao recarregar
        sessionStorage.removeItem('embrapac_active_role');
        sessionStorage.setItem('embrapac_aba_deslogada', 'true');
        
        const logs = JSON.parse(localStorage.getItem('embrapac_logs') || '[]');
        logs.unshift({
            timestamp: Date.now(), 
            data: new Date().toISOString(), 
            evento: `Logout realizado: ${nome}`,
            tipo: 'INFORME',
            usuario: nome,
            cargo: 'Sistema'
        });
        localStorage.setItem('embrapac_logs', JSON.stringify(logs));

        if (window.location.pathname.includes('Tela_')) {
            window.location.reload();
        }
    },

    obterPapelDestaAba: function() {       
        if (sessionStorage.getItem('embrapac_aba_deslogada') === 'true') {
            return null;
        }

        let role = sessionStorage.getItem('embrapac_active_role');
        if (role) return role;

        const pathname = window.location.pathname;
        const sessoes = this._getSessoes();

        if (pathname.includes('Tela_1_operador')) {
            if (sessoes['operador']) role = 'operador';
            else if (sessoes['admin']) role = 'admin';
        } 
        else if (pathname.includes('Tela_3_supervisor')) {
            if (sessoes['admin']) role = 'admin';
        }
        else {
            const lastRole = localStorage.getItem('embrapac_last_role');
            if (lastRole && sessoes[lastRole]) role = lastRole;
        }

        if (role) sessionStorage.setItem('embrapac_active_role', role);
        return role;
    },

    validar: function() {
        const role = this.obterPapelDestaAba();
        if (!role) return false;

        const sessoes = this._getSessoes();
        const sessao = sessoes[role];
        
        if (!sessao) {
            sessionStorage.removeItem('embrapac_active_role');
            return false;
        }

        const minutos = (Date.now() - sessao.ultimoAcesso) / 60000;
        const tempoLimite = CONFIG.AUTH_TIMEOUT[sessao.id] || 15;

        if (minutos > tempoLimite) {
            this.sair();
            return false;
        }
       
        if (Date.now() - sessao.ultimoAcesso > 60000) {
            sessao.ultimoAcesso = Date.now();
            sessoes[role] = sessao;
            this._setSessoes(sessoes);
        }

        return sessao;
    },

    atualizarHeader: function() {
        const sessao = this.validar();
        const divInfo = document.querySelector('.user-info');      
        
        const btnTema = `
            <button onclick="alternarTema()" style="background: none; border: none; cursor: pointer; margin-left: 15px;" title="Alternar Tema">
                <i id="theme-icon" class="fas fa-moon" style="font-size: 1.2rem; color: white;"></i>
            </button>
        `;

        if (divInfo) {
            if (sessao) {                            
                divInfo.innerHTML = `
                    <span><i class="fas fa-user-circle"></i> ${sessao.nome} (${sessao.cargo})</span>
                    ${btnTema}
                    <button onclick="Sessao.sair()" style="margin-left:10px; background:none; border:none; color:white; cursor:pointer; font-size:1.1rem;">
                        <i class="fas fa-sign-out-alt"></i> Sair
                    </button>
                `;
            } else {                     
                divInfo.innerHTML = `
                    <span><i class="fas fa-lock"></i> Acesso Restrito</span>
                    ${btnTema}
                `;
            }
                        
            if (typeof aplicarTemaDoUsuario === 'function') aplicarTemaDoUsuario();
        }
    },

    autenticar: function(senhaDigitada) {
        for (const [idPerfil, dados] of Object.entries(CONFIG.USUARIOS)) {
            if (senhaDigitada === dados.pass) {
                this.iniciar(idPerfil);
                return idPerfil; 
            }
        }
        return null;
    }
};

/* --- 4. CLASSE MÁQUINA (PLC Virtual Real-Time) --- */
const Maquina = {
    ler: () => {
        return JSON.parse(localStorage.getItem('embrapac_estado') || JSON.stringify(ESTADO_PADRAO));
    },
    escrever: (novoEstado) => {
        localStorage.setItem('embrapac_estado', JSON.stringify(novoEstado));
    },
    processarCiclo: function() {
        let estado = this.ler();
        let houveMudanca = false;
        const agora = Date.now();

        // --- 1. LÓGICA DE DOWNTIME (CENTRALIZADA) ---
        if (estado.turnoAtivo && estado.status !== 'OPERANDO') {
            if (!estado.inicioDowntimeMs) {
                estado.inicioDowntimeMs = agora;
                houveMudanca = true;
            }
        } else {
            if (estado.inicioDowntimeMs) {
                estado.downtime += (agora - estado.inicioDowntimeMs) / 1000;
                estado.inicioDowntimeMs = null;
                
                estado.ultimoUpdate = agora; 
                houveMudanca = true;
            }
        }

        // --- 2. LÓGICA DE PRODUÇÃO (BASEADA EM DELTA TIME) ---
        if (estado.status === 'OPERANDO') {
            const cicloMs = estado.ciclo * 1000;
            
            if (agora - estado.ultimoUpdate >= cicloMs) {
                const delta = agora - estado.ultimoUpdate;

                if (delta > 1800000) { 
                    console.warn("Salto de tempo > 30min detectado. Ajustando relógio...");
                    estado.ultimoUpdate = agora; 
                    this.escrever(estado); 
                    return estado; 
                }

                const qtd = Math.floor(delta / cicloMs);
                
                if (qtd > 0) {
                    const novaProducao = estado.producao + qtd;
                    
                    if (novaProducao >= estado.meta && estado.meta > 0) {
                        estado.producao = estado.meta;
                        estado.status = 'PARADO';
                        alert("META ATINGIDA! A linha parou automaticamente.");
                        Logger.registrar("Meta de Produção Atingida", "NORMAL");
                    } else {
                        estado.producao = novaProducao;
                        estado.ultimoUpdate += (qtd * cicloMs);
                    }
                    houveMudanca = true;
                }
            }
        }
        
        if (houveMudanca) this.escrever(estado);
        return estado;
    }
}; 
// --- 3. SISTEMA DE TEMAS ---
// 1. Obtém a chave de tema do usuário logado
function obterChaveTema() {
    if (typeof Sessao !== 'undefined') {
        const role = Sessao.obterPapelDestaAba();
        if (role) {
            const sessoes = Sessao._getSessoes();
            if (sessoes[role]) {
                return 'embrapac_theme_' + sessoes[role].cargo;
            }
        }
    }
    return 'embrapac_theme_visitante'; 
}

// 2. Aplica o tema específico daquele usuário na tela
function aplicarTemaDoUsuario() {
    const chave = obterChaveTema();
    const temaSalvo = localStorage.getItem(chave) || 'light';
    document.documentElement.setAttribute('data-theme', temaSalvo);
    atualizarIconeTema(temaSalvo);
}

// 3. Função para alternar (chamada pelo botão)
function alternarTema() {
    const atual = document.documentElement.getAttribute('data-theme');
    const novo = atual === 'dark' ? 'light' : 'dark';
    const chave = obterChaveTema(); // Pega a gaveta do usuário logado
    
    document.documentElement.setAttribute('data-theme', novo);
    localStorage.setItem(chave, novo); // Salva apenas na gaveta dele
    atualizarIconeTema(novo);
}

// 4. Atualiza o ícone do botão (Lua ou Sol)
function atualizarIconeTema(modo) {
    const btnIcon = document.getElementById('theme-icon');
    if (btnIcon) {
        if (modo === 'dark') {
            btnIcon.className = "fas fa-sun";
            btnIcon.style.color = "var(--accent-yellow)";
        } else {
            btnIcon.className = "fas fa-moon";
            btnIcon.style.color = "white";
        }
    }
}

// 5. Sincronização Inteligente entre Abas (Múltiplos Usuários)
window.addEventListener('storage', (event) => {
    if (event.key === 'embrapac_sessions') {
        if (typeof Sessao !== 'undefined') Sessao.atualizarHeader();
    }

    if (typeof obterChaveTema === 'function') {
        const chaveAtual = obterChaveTema();
        if (event.key === chaveAtual) {
            const novoTema = event.newValue || 'light';
            document.documentElement.setAttribute('data-theme', novoTema);
            if (typeof atualizarIconeTema === 'function') atualizarIconeTema(novoTema);
        }
    }
});

// 6. Correção de Sincronia para Arquivos Locais (file:///)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && typeof Sessao !== 'undefined') {
        Sessao.atualizarHeader(); 
    }
});