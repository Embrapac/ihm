/* ============================================================
   MASTER.JS - NÚCLEO DO SISTEMA (Auth e Logs Automáticos)
   Versão Final: Produção Contínua (PLC Real)
   ============================================================ */

/* --- 1. CONEXÃO COM O SERVIDOR NODE.JS (TOLERÂNCIA A FALHAS) --- */
let socket = null;

// Verifica se a biblioteca do servidor conseguiu carregar
if (typeof io !== 'undefined') {
    socket = io('http://localhost:3000');

    socket.on('connect', () => {
        console.log('[+] Conectado ao Servidor Node.js:', socket.id);
    });

    socket.on('estadoAtualizado', (estadoServidor) => {
        localStorage.setItem('embrapac_estado', JSON.stringify(estadoServidor));
        window.dispatchEvent(new CustomEvent('IHM_Update', { detail: estadoServidor }));
    });

    // NOVO: Quando o servidor mandar a lista de logs nova, salva e atualiza a tela
    socket.on('historicoAtualizado', (logsServidor) => {
        localStorage.setItem('embrapac_logs', JSON.stringify(logsServidor));
        
        // Se a pessoa estiver na tela de Histórico, manda desenhar a tabela de novo
        if (typeof renderizarHistoricoCompleto === 'function') {
            renderizarHistoricoCompleto(false); // false = não reseta a paginação
        }
    });

} else {
    console.warn('[!] Servidor Node.js Offline. O Login e a navegação local continuarão funcionando.');
}


/* --- 2. CONFIGURAÇÕES --- */
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
        
        // Cria o pacote do novo log
        const novoLog = {
            timestamp: Date.now(), 
            data: new Date().toISOString(), // PADRÃO ISO
            evento: evento, 
            tipo: tipo, 
            usuario: user.nome, 
            cargo: user.cargo
        };

        // Se tem servidor conectado, manda o pacote pra ele!
        if (socket && socket.connected) {
            socket.emit('registrarLog', novoLog);
        } else {
            // MODO OFFLINE: Salva localmente se o servidor caiu
            const logs = JSON.parse(localStorage.getItem('embrapac_logs') || '[]');
            logs.unshift(novoLog);
            if (logs.length > 300) logs.pop();
            localStorage.setItem('embrapac_logs', JSON.stringify(logs));
            
            if (typeof renderizarHistoricoCompleto === 'function') {
                renderizarHistoricoCompleto(false);
            }
        }
    }
};

/* --- 4. SISTEMA DE SESSÃO (Cofre Multi-Usuário) --- */
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

    iniciarComDados: function(userApi) {
        const sessoes = this._getSessoes();
        
        // Define o papel interno do frontend baseado no nível que veio do MariaDB
        const role = userApi.nivel === 2 ? 'admin' : 'operador';
        
        sessoes[role] = { ...userApi, id: role, ultimoAcesso: Date.now() };
        this._setSessoes(sessoes);
        
        sessionStorage.removeItem('embrapac_aba_deslogada');
        sessionStorage.setItem('embrapac_active_role', role);
        localStorage.setItem('embrapac_last_role', role); 
        
        Logger.registrar(`Login realizado via API: ${userApi.nome}`, "INFORME");
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

        const pathname = window.location.pathname;
        const sessoes = this._getSessoes();
        let role = sessionStorage.getItem('embrapac_active_role');

        // --- MURALHA DE SEGURANÇA (RBAC) ---
        if (pathname.includes('Tela_3_supervisor')) {
            // TELA 3: Exclusiva do Supervisor. Se não for ele, bloqueia o acesso.
            if (sessoes['admin']) {
                role = 'admin';
            } else {
                role = null; 
            }
        } 
        else if (pathname.includes('Tela_1_operador')) {
            // TELA 1: Aberta para Operador ou Supervisor
            if (!role || !sessoes[role]) {
                if (sessoes['operador']) role = 'operador';
                else if (sessoes['admin']) role = 'admin';
                else role = null;
            }
        }
        else {
            // TELA 2 (Histórico) e outras: Usa o último login válido
            if (!role || !sessoes[role]) {
                const lastRole = localStorage.getItem('embrapac_last_role');
                if (lastRole && sessoes[lastRole]) role = lastRole;
                else role = null;
            }
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
                // Fecha a janela de login automaticamente se logar em outra aba!
                const modal = document.getElementById('login-modal');
                if (modal) modal.style.display = 'none';
                
            } else {                     
                divInfo.innerHTML = `
                    <span><i class="fas fa-lock"></i> Acesso Restrito</span>
                    ${btnTema}
                `;
                // Mostra a janela de login se o usuário clicar em "Sair" na outra aba!
                const modal = document.getElementById('login-modal');
                if (modal) modal.style.display = 'flex';
            }
                        
            if (typeof aplicarTemaDoUsuario === 'function') aplicarTemaDoUsuario();
        }
    },

    autenticar: async function(login, senha) {
        try {
            const resposta = await fetch('http://localhost:3000/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login, senha })
            });

            const dados = await resposta.json();

            if (dados.sucesso) {
                // Guarda o Token e os dados no navegador
                localStorage.setItem('embrapac_token', dados.token);
                this.iniciarComDados(dados.user); 
                return true;
            } else {
                alert(dados.erro);
                return false;
            }
        } catch (e) {
            alert("Erro de conexão com o servidor de segurança.");
            return false;
        }
    }
};

/* --- 5. CLASSE MÁQUINA (PLC Virtual Real-Time) --- */
/* --- 5. CLASSE MÁQUINA (PLC Virtual Real-Time) --- */
const Maquina = {
    ler: () => {
        return JSON.parse(localStorage.getItem('embrapac_estado') || JSON.stringify(ESTADO_PADRAO));
    },
    escrever: (novoEstado) => {
        localStorage.setItem('embrapac_estado', JSON.stringify(novoEstado));
        
        if (socket && socket.connected) {
            // Pega o crachá que foi salvo na hora do Login
            const meuToken = localStorage.getItem('embrapac_token');
            
            // Envia para o servidor o Estado + O Crachá
            socket.emit('atualizarEstado', { estado: novoEstado, token: meuToken });
        }
    },
    processarCiclo: function() {
        return this.ler();
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