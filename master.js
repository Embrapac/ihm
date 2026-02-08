/* ============================================================
   MASTER.JS - NÚCLEO DO SISTEMA (Auth e Logs Automáticos)
   Versão Final: Produção Contínua (PLC Real)
   ============================================================ */

/* --- 1. CONFIGURAÇÕES --- */
const CONFIG = {
    AUTH_TIMEOUT: 15,
    USUARIOS: {
        'operador': { pass: 'operador', nome: 'Sr. Agenor', cargo: 'Operador', nivel: 1 },
        'admin':    { pass: 'admin',    nome: 'Sr. Carlos', cargo: 'Supervisor', nivel: 2 }
    }
};

const ESTADO_PADRAO = {
    producao: 0, refugo: 0, meta: 1500, ciclo: 1, status: 'OPERANDO', 
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
        if (divInfo) {
            if (sessao) {
                divInfo.innerHTML = `
                    <span><i class="fas fa-user-circle"></i> ${sessao.nome} (${sessao.cargo})</span>
                    <button onclick="Sessao.sair()" style="margin-left:10px; background:none; border:none; color:white; cursor:pointer; font-size:0.9rem;">
                        <i class="fas fa-sign-out-alt"></i> Sair
                    </button>
                `;
            } else {
                divInfo.innerHTML = `<span><i class="fas fa-lock"></i> Acesso Restrito</span>`;
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