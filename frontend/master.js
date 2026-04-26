/* ============================================================
   MASTER.JS - NÚCLEO DO SISTEMA (Auth e Logs Automáticos)
   Versão Final: Produção Contínua (PLC Real)
   ============================================================ */

/* --- 1. CONEXÃO COM O SERVIDOR NODE.JS (TOLERÂNCIA A FALHAS) --- */
let socket = null;

if (typeof io !== 'undefined') {
    socket = io('http://localhost:3000');

    socket.on('connect', () => {
        console.log('[+] Conectado ao Servidor Node.js:', socket.id);
    });

    socket.on('estadoAtualizado', (estadoServidor) => {
        localStorage.setItem('embrapac_estado', JSON.stringify(estadoServidor));
        window.dispatchEvent(new CustomEvent('IHM_Update', { detail: estadoServidor }));
    });

    socket.on('historicoAtualizado', (logsServidor) => {
        localStorage.setItem('embrapac_logs', JSON.stringify(logsServidor));
        if (typeof renderizarHistoricoCompleto === 'function') {
            renderizarHistoricoCompleto(false);
        }
    });

} else {
    console.warn('[!] Servidor Node.js Offline. O Login e a navegação local continuarão funcionando.');
}

/* --- 2. CONFIGURAÇÕES --- */
const CONFIG = {
    AUTH_TIMEOUT: {
        'operador': 480, // 8 horas
        'admin': 15      // 15 minutos
    },
    USUARIOS: {
        'operador': { pass: 'operador', nome: 'Sr. Agenor', cargo: 'Operador', nivel: 1 },
        'admin':    { pass: 'admin',    nome: 'Sr. Carlos', cargo: 'Supervisor', nivel: 2 },
        'manutencao': { pass: 'manu123', nome: 'Equipa Técnica', cargo: 'Manutenção', nivel: 3 }
    }
};

const ESTADO_PADRAO = {
    producao: 0, producaoP: 0, producaoM: 0, producaoG: 0, 
    refugo: 0, meta: 5000, ciclo: 3, status: 'PARADO',    
    ultimoUpdate: Date.now(), turnoAtivo: false, horaInicioTurno: '--:--', 
    horaFimTurno: '--:--', horaFalha: '--:--', downtime: 0, oee: 0
};

/* --- 3. LOGGER --- */
const Logger = {
    registrar: (evento, tipo = 'NORMAL') => {
        let user = { nome: 'Sistema', cargo: 'Automático' };
        
        if (typeof Sessao !== 'undefined') {
            const sessaoAtual = Sessao.validar();
            if (sessaoAtual) {
                user = sessaoAtual;
            }
        }
        
        const novoLog = {
            timestamp: Date.now(), 
            data: new Date().toISOString(),
            evento: evento, 
            tipo: tipo, 
            usuario: user.nome, 
            cargo: user.cargo
        };

        if (socket && socket.connected) {
            socket.emit('registrarLog', novoLog);
        } else {
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

/* --- 4. SISTEMA DE SESSÃO (Isolamento Total + Timer + Modo Offline) --- */
const Sessao = {
    iniciar: function(usuarioKey) {
        if (typeof CONFIG === 'undefined' || !CONFIG.USUARIOS[usuarioKey]) return false;
        const dados = CONFIG.USUARIOS[usuarioKey];
        
        const role = dados.nivel === 2 ? 'admin' : 'operador';
        const userData = { ...dados, id: role, ultimoAcesso: Date.now() };

        sessionStorage.setItem('embrapac_token', 'token_local_offline');
        sessionStorage.setItem('embrapac_user', JSON.stringify(userData));
        
        Logger.registrar(`Login Local (Offline): ${dados.nome}`, "INFORME");
        return true;
    },

    iniciarComDados: function(userApi, token) {
        const role = userApi.nivel === 2 ? 'admin' : 'operador';
        const userData = { ...userApi, id: role, ultimoAcesso: Date.now() };

        sessionStorage.setItem('embrapac_token', token);
        sessionStorage.setItem('embrapac_user', JSON.stringify(userData));
        
        Logger.registrar(`Login API realizado: ${userApi.nome}`, "INFORME");
        return true;
    },

    sair: function() {
        const userStr = sessionStorage.getItem('embrapac_user');
        if (userStr) {
            const user = JSON.parse(userStr);
            Logger.registrar(`Logout realizado: ${user.nome}`, "INFORME");
        }
        
        sessionStorage.removeItem('embrapac_token');
        sessionStorage.removeItem('embrapac_user');

        if (window.location.pathname.includes('Tela_')) {
            window.location.reload();
        }
    },

    validar: function() {
        const userStr = sessionStorage.getItem('embrapac_user');
        if (!userStr) return null; 
        
        const sessao = JSON.parse(userStr);
        const pathname = window.location.pathname;

        if (pathname.includes('Tela_3_supervisor') && sessao.nivel !== 2) {
            return null; 
        }

        const tempoLimite = (typeof CONFIG !== 'undefined' && CONFIG.AUTH_TIMEOUT[sessao.id]) 
                            ? CONFIG.AUTH_TIMEOUT[sessao.id] 
                            : 15; 
                            
        const minutosInativo = (Date.now() - sessao.ultimoAcesso) / 60000;

        if (minutosInativo > tempoLimite) {
            console.warn(`[!] Sessão expirada por inatividade.`);
            this.sair(); 
            return null;
        }

        if (Date.now() - sessao.ultimoAcesso > 60000) {
            sessao.ultimoAcesso = Date.now();
            sessionStorage.setItem('embrapac_user', JSON.stringify(sessao));
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

        const navLockIcon = document.querySelector('nav a[href="Tela_3_supervisor.html"] i');

        if (divInfo) {
            if (sessao) {                            
                divInfo.innerHTML = `
                    <span><i class="fas fa-user-circle"></i> ${sessao.nome} (${sessao.cargo})</span>
                    ${btnTema}
                    <button onclick="Sessao.sair()" style="margin-left:10px; background:none; border:none; color:white; cursor:pointer; font-size:1.1rem;">
                        <i class="fas fa-sign-out-alt"></i> Sair
                    </button>
                `;
                
                const modal = document.getElementById('login-modal');
                if (modal) modal.style.display = 'none';
                
                if (navLockIcon) {
                    navLockIcon.className = (sessao.nivel === 2 || sessao.cargo === 'Supervisor') ? "fas fa-lock-open" : "fas fa-lock";
                }
            } else {                     
                divInfo.innerHTML = `
                    <span><i class="fas fa-lock"></i> Acesso Restrito</span>
                    ${btnTema}
                `;
                const modal = document.getElementById('login-modal');
                if (modal) modal.style.display = 'flex';

                if (navLockIcon) navLockIcon.className = "fas fa-lock";
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
                this.iniciarComDados(dados.user, dados.token); 
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
const Maquina = {
    ler: () => {
        return JSON.parse(localStorage.getItem('embrapac_estado') || JSON.stringify(ESTADO_PADRAO));
    },
    escrever: (novoEstado) => {
        localStorage.setItem('embrapac_estado', JSON.stringify(novoEstado));
        
        if (socket && socket.connected) {
            // A CORREÇÃO MÁGICA: Agora a máquina pega o Token do cofre correto!
            const meuToken = sessionStorage.getItem('embrapac_token');
            if (meuToken) {
                socket.emit('atualizarEstado', { estado: novoEstado, token: meuToken });
            } else {
                console.warn("[!] Sem permissão para enviar comando.");
            }
        }
    },
    processarCiclo: function() {
        return this.ler();
    }
};

// --- 6. SISTEMA DE TEMAS (Sincronizado com o Isolamento de Abas) ---
function obterChaveTema() {
    let cargo = 'visitante';
    
    // Busca o usuário logado NESTA aba específica
    const userStr = sessionStorage.getItem('embrapac_user');
    if (userStr) {
        const user = JSON.parse(userStr);
        cargo = user.cargo;
    }
    
    return 'embrapac_theme_' + cargo; 
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
    const chave = obterChaveTema(); 
    
    document.documentElement.setAttribute('data-theme', novo);
    localStorage.setItem(chave, novo); // Salva a preferência globalmente para este cargo
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

// 5. Sincronização de Temas entre abas do mesmo cargo
window.addEventListener('storage', (event) => {
    const chaveAtual = obterChaveTema();
    if (event.key === chaveAtual) {
        const novoTema = event.newValue || 'light';
        document.documentElement.setAttribute('data-theme', novoTema);
        if (typeof atualizarIconeTema === 'function') atualizarIconeTema(novoTema);
    }
});

// 6. Verificação de visibilidade para garantir que o cabeçalho esteja atualizado
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && typeof Sessao !== 'undefined') {
        Sessao.atualizarHeader(); 
    }
});

// --- 7. FACILITADORES DE LOGIN (TECLA ENTER) ---
document.addEventListener('DOMContentLoaded', () => {
    // Escuta o Enter no campo de login do Operador (Tela 1)
    const passInputOperador = document.getElementById('operador-pass');
    if (passInputOperador) {
        passInputOperador.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // A função attemptLoginOperator() já existe no seu operador.js
                if (typeof attemptLoginOperator === 'function') {
                    attemptLoginOperator();
                }
            }
        });
    }

   
    const passInputSupervisor = document.getElementById('supervisor-pass');
    if (passInputSupervisor) {
        passInputSupervisor.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // A função attemptLoginAdmin() já existe no seu supervisor.js
                if (typeof attemptLoginAdmin === 'function') {
                    attemptLoginAdmin();
                }
            }
        });
    }
});