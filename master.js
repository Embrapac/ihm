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

/* --- 2. LOGGER (Movido para cima para estar disponível na Sessão) --- */
const Logger = {
    registrar: (evento, tipo = 'NORMAL') => {
        // Tenta pegar usuário logado, senão assume Sistema
        const sessaoStr = sessionStorage.getItem('embrapac_user_session');
        const user = sessaoStr ? JSON.parse(sessaoStr) : { nome: 'Sistema', cargo: 'Automático' };
        
        const logs = JSON.parse(localStorage.getItem('embrapac_logs') || '[]');
        
        logs.unshift({
            data: new Date().toLocaleString('pt-BR'),
            evento: evento, 
            tipo: tipo, 
            usuario: user.nome, 
            cargo: user.cargo
        });
        
        // Limita a 300 logs para performance
        if (logs.length > 300) logs.pop();
        
        localStorage.setItem('embrapac_logs', JSON.stringify(logs));
        
        // Se estiver na tela de histórico, atualiza na hora
        if (typeof renderizarHistoricoCompleto === 'function') {
            renderizarHistoricoCompleto();
        }
    }
};

/* --- 3. SISTEMA DE SESSÃO (Logs Automáticos de Acesso) --- */
const Sessao = {
    iniciar: function(usuarioKey) {
        const dados = CONFIG.USUARIOS[usuarioKey];
        if (!dados) return false;
        
        const sessao = { ...dados, id: usuarioKey, ultimoAcesso: Date.now() };
        sessionStorage.setItem('embrapac_user_session', JSON.stringify(sessao));
        
        // --- LOG AUTOMÁTICO DE LOGIN ---
        Logger.registrar(`Login realizado: ${dados.nome}`, "INFORME");
        return true;
    },

    sair: function() {
        const sessaoAntiga = JSON.parse(sessionStorage.getItem('embrapac_user_session'));
        const nome = sessaoAntiga ? sessaoAntiga.nome : 'Usuário';

        sessionStorage.removeItem('embrapac_user_session');
        
        // --- LOG AUTOMÁTICO DE LOGOUT ---
        // Forçamos o registro lendo o banco atualizado
        const logs = JSON.parse(localStorage.getItem('embrapac_logs') || '[]');
        logs.unshift({
            data: new Date().toLocaleString('pt-BR'),
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

    validar: function() {
        const sessao = JSON.parse(sessionStorage.getItem('embrapac_user_session'));
        if (!sessao) return false;
        
        const minutos = (Date.now() - sessao.ultimoAcesso) / 60000;
        if (minutos > CONFIG.AUTH_TIMEOUT) {
            this.sair();
            return false;
        }
        
        sessao.ultimoAcesso = Date.now();
        sessionStorage.setItem('embrapac_user_session', JSON.stringify(sessao));
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
                    <button onclick="Sessao.sair()" style="margin-left:10px; background:none; border:none; color:white; cursor:pointer; font-size:0.9rem;">
                        <i class="fas fa-sign-out-alt"></i> Sair
                    </button>
                `;
                    
            } else {                     
                divInfo.innerHTML = `
                    <span><i class="fas fa-lock"></i> Acesso Restrito</span>
                    ${btnTema}
                `;
            }
                        
            // Garante que o tema e o ícone sejam os corretos PARA ESTE USUÁRIO
            if (typeof aplicarTemaDoUsuario === 'function') {
                aplicarTemaDoUsuario();
            }
        }
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
    processarCiclo: function(origem) {
        let estado = this.ler();
        let houveMudanca = false;

        // A produção é calculada pelo tempo decorrido.
        // Qualquer tela aberta (Supervisor ou Operador) processa o estado corretamente.
        if (estado.status === 'OPERANDO') {
            const agora = Date.now();
            const cicloMs = estado.ciclo * 1000;
            
            // Verifica se passou tempo suficiente (Delta Time)
            if (agora - estado.ultimoUpdate >= cicloMs) {
                const delta = agora - estado.ultimoUpdate;

                // Se o tempo decorrido for maior que 30 minutos (1800.000ms),
                // o sistema entende que a fábrica (navegador) estava fechada.
                if (delta > 1800000) { 
                    console.warn("Salto de tempo > 30min detectado. Ajustando relógio...");
                    
                    // Pula o tempo perdido e sincroniza com o momento atual
                    estado.ultimoUpdate = agora; 
                    
                    this.escrever(estado); // Salva a correção
                    return estado; // Sai da função SEM somar produção falsa
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
                        // Atualiza o relógio virtual da máquina para sincronizar
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

/* ============================================================
   CONTROLE DE TEMA (CLARO / ESCURO) - INDIVIDUAL POR USUÁRIO
   ============================================================ */
// 1. Descobre qual é a chave do banco de dados baseada em quem está logado
function obterChaveTema() {
    const sessaoStr = sessionStorage.getItem('embrapac_user_session');
    if (sessaoStr) {
        const user = JSON.parse(sessaoStr);
        return 'embrapac_theme_' + user.cargo; // Ex: embrapac_theme_Operador ou embrapac_theme_Supervisor
    }
    return 'embrapac_theme_visitante'; // Para quem ainda não fez login
}

// 2. Aplica o tema específico daquele usuário na tela
function aplicarTemaDoUsuario() {
    const chave = obterChaveTema();
    const temaSalvo = localStorage.getItem(chave) || 'light';
    document.documentElement.setAttribute('data-theme', temaSalvo);
    atualizarIconeTema(temaSalvo);
}

// 3. Chama a função assim que a página carrega
document.addEventListener('DOMContentLoaded', () => {
    aplicarTemaDoUsuario();
});

// 4. Função para alternar (chamada pelo botão)
function alternarTema() {
    const atual = document.documentElement.getAttribute('data-theme');
    const novo = atual === 'dark' ? 'light' : 'dark';
    const chave = obterChaveTema(); // Pega a gaveta do usuário logado
    
    document.documentElement.setAttribute('data-theme', novo);
    localStorage.setItem(chave, novo); // Salva apenas na gaveta dele
    atualizarIconeTema(novo);
}

// 5. Atualiza o ícone do botão (Lua ou Sol)
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

// 6. Sincronização Inteligente entre Abas
window.addEventListener('storage', (event) => {
    const chaveAtual = obterChaveTema();
    // Só muda a cor da aba se a alteração for do MESMO perfil de usuário
    if (event.key === chaveAtual) {
        const novoTema = event.newValue || 'light';
        document.documentElement.setAttribute('data-theme', novoTema);
        atualizarIconeTema(novoTema);
    }
});