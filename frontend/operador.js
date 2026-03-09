/* ============================================================
   OPERADOR.JS - INTERFACE (Conectado ao Master)
   ============================================================ */

let estadoLocal = {}; 
let alarmActive = false;
let stepFalha = 0;

let elDisplay, elDetail, elBtnStart, elBtnStop;
let elKpiProd, elKpiRefugo, elMetaText, elProgressBar;

// --- LÓGICA DE LOGIN ---
function attemptLoginOperator() {
    const passInput = document.getElementById('operador-pass');
    if (typeof CONFIG === 'undefined') {
        alert("Erro Crítico: master.js não encontrado!");
        return;
    }

    const perfilLogado = Sessao.autenticar(passInput.value);

    // O Operador aceita login tanto do nível 1 quanto do nível 2
    if (perfilLogado === 'operador' || perfilLogado === 'admin') {
        fecharModalLogin();
    } else {
        alert('Senha Incorreta!');
    }
}

function fecharModalLogin() {
    const modal = document.getElementById('login-modal');
    if(modal) {
        modal.style.opacity = '0';
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    }
    Sessao.atualizarHeader();
}

document.addEventListener('DOMContentLoaded', () => {
    Sessao.atualizarHeader(); 
    
    elDisplay = document.getElementById('status-display');
    elDetail = document.getElementById('status-detail');
    elBtnStart = document.getElementById('btn-start');
    elBtnStop = document.getElementById('btn-stop');
    elKpiProd = document.getElementById('kpi-production');
    elKpiRefugo = document.getElementById('kpi-refugo');
    elMetaText = document.getElementById('meta-text');
    elProgressBar = document.getElementById('progress-bar');
    // -----------------------------------------------

    if (Sessao.validar()) {    
        const modal = document.getElementById('login-modal');
        if(modal) modal.style.display = 'none';
    }
    
    // Renderização Imediata
    estadoLocal = Maquina.ler(); 
    if (typeof gerenciarAlarmesUI === 'function') gerenciarAlarmesUI(); // Segurança extra
    renderizar(); 

    // Loop Principal
    setInterval(() => {
        estadoLocal = Maquina.processarCiclo();
        if (typeof gerenciarAlarmesUI === 'function') gerenciarAlarmesUI();
        renderizar();
    }, 500);

    const passInput = document.getElementById('operador-pass');
    if(passInput) passInput.addEventListener('keypress', (e) => { if(e.key==='Enter') attemptLoginOperator(); });
});

// --- COMANDOS ---
function startLine() {
    estadoLocal = Maquina.ler(); 
    if (estadoLocal.status === 'FALHA') return;
    estadoLocal.status = 'OPERANDO';
    estadoLocal.ultimoUpdate = Date.now();
    Maquina.escrever(estadoLocal);
    estadoLocal = Maquina.processarCiclo();
    Logger.registrar("Produção Iniciada", "NORMAL");
    renderizar();
}

function stopLine() {
    estadoLocal = Maquina.ler();
    estadoLocal.status = 'PARADO';
    Maquina.escrever(estadoLocal);
    estadoLocal = Maquina.processarCiclo();
    Logger.registrar("Parada Manual", "NORMAL");
    renderizar();
}

function registrarRefugo() {
    estadoLocal = Maquina.ler();
    
    if (estadoLocal.producao > 0) {
        estadoLocal.producao--;
        estadoLocal.refugo++;
        Maquina.escrever(estadoLocal);
        estadoLocal = Maquina.processarCiclo();
        Logger.registrar("Apontamento Manual de Refugo (Operador)", "ALERTA"); 
        renderizar();
    } else {
        alert("Não há produção suficiente para registrar refugo.");
    }
}

function simulateFault() {
    if (estadoLocal.status !== 'OPERANDO') { alert("Apenas em modo operando."); return; }
    estadoLocal.status = 'FALHA';
    estadoLocal.horaFalha = new Date().toLocaleString('pt-BR');
    Maquina.escrever(estadoLocal);
    estadoLocal = Maquina.processarCiclo();    
    // Log correto na tabela de Alarmes (Vermelho)
    Logger.registrar("FALHA CRÍTICA: Motor M2", "FALHA");
    
    gerenciarAlarmesUI();
    renderizar();
}

// --- UI E ALERTAS ---
function gerenciarAlarmesUI() {
    if (estadoLocal.status === 'FALHA' && !alarmActive) {
        alarmActive = true; stepFalha = 1;
        mostrarAlarme("ALARME: MOTOR TRAVADO", estadoLocal.horaFalha, "RECONHECER ALARMES");
    } else if (estadoLocal.status !== 'FALHA') {
        alarmActive = false;
        const panel = document.getElementById('alarm-panel');
        if(panel) panel.classList.remove('active');
    }
}

function mostrarAlarme(msg, time, btn) {
    const elMsg = document.getElementById('alarm-msg');
    const elTime = document.getElementById('alarm-time');
    const elBtn = document.getElementById('btn-ack-text');
    const panel = document.getElementById('alarm-panel');

    if(elMsg) elMsg.innerText = msg;
    if(elTime) elTime.innerText = "Hora: " + time;
    if(elBtn) elBtn.innerText = btn;
    if(panel) panel.classList.add('active');
}

function acknowledgeAlarm() {
    if (stepFalha === 1) {
        stepFalha = 2;
        // Detalhe recuperado: Mensagem mais instrutiva
        mostrarAlarme("MANUTENÇÃO NECESSÁRIA", estadoLocal.horaFalha, "CONFIRMAR CONSERTO");
        
        // Log de Reconhecimento (Vai para tabela de Alarmes - Amarelo)
        Logger.registrar("Alarme Reconhecido", "RECONHECIDO");
        
    } else if (stepFalha === 2) {
        // Detalhe recuperado: Confirmação mais específica
        if (confirm("O técnico consertou o motor fisicamente?")) {
            estadoLocal.status = 'PRONTO';
            Maquina.escrever(estadoLocal);
            estadoLocal = Maquina.processarCiclo();
            
            // Log de Reset (Vai para tabela de Alarmes - Verde)
            Logger.registrar("Manutenção OK / Reset", "NORMAL");
            
            renderizar();
        }
    }
}

function renderizar() {
    
    if (elDisplay) {
        elDisplay.className = "status-badge";
        
        // --- ESTADO: OPERANDO ---
        if (estadoLocal.status === 'OPERANDO') {
            elDisplay.classList.add('status-pulsing');
            elDisplay.innerText = "OPERANDO";
            
            // Texto detalhado
            if(elDetail) elDetail.innerText = `Tempo do Ciclo: ${estadoLocal.ciclo} (s)`;
            
            // Botões: Start Cinza (Desativado) / Stop Vermelho (Ativo)
            if(elBtnStart) { 
                elBtnStart.disabled = true; 
                elBtnStart.className = "btn-action btn-disabled"; 
            }
            if(elBtnStop) { 
                elBtnStop.disabled = false; 
                elBtnStop.className = "btn-action btn-red"; 
            }

        // --- ESTADO: PARADO ---
        } else if (estadoLocal.status === 'PARADO') {
            elDisplay.classList.add('status-stopped');
            elDisplay.innerText = "PARADO";
            
            // Texto detalhado
            if(elDetail) elDetail.innerText = "Linha parada. Aguardando comando.";
            
            // Botões: Start Verde (Ativo) / Stop Cinza (Desativado)
            if(elBtnStart) { 
                elBtnStart.disabled = false; 
                elBtnStart.className = "btn-action btn-green"; 
            }
            if(elBtnStop) { 
                elBtnStop.disabled = true; 
                elBtnStop.className = "btn-action btn-disabled"; 
            }

        // --- ESTADO: FALHA ---
        } else if (estadoLocal.status === 'FALHA') {
            elDisplay.classList.add('status-error');
            elDisplay.innerText = "FALHA";
            
            // Texto detalhado
            if(elDetail) elDetail.innerText = "Erro #502: Motor M2 Travado";
            
            // Botões: Ambos Cinzas (Travados)
            if(elBtnStart) { 
                elBtnStart.disabled = true; 
                elBtnStart.className = "btn-action btn-disabled"; 
            }
            if(elBtnStop) { 
                elBtnStop.disabled = true; 
                elBtnStop.className = "btn-action btn-disabled"; 
            }

        // --- ESTADO: PRONTO (Default) ---
        } else { 
            elDisplay.classList.add('status-stopped');
            elDisplay.innerText = estadoLocal.status;
            
            if(elDetail) elDetail.innerText = "Falha normalizada. Pronto para iniciar.";
            
            // Botões: Start Verde / Stop Cinza
            if(elBtnStart) { 
                elBtnStart.disabled = false; 
                elBtnStart.className = "btn-action btn-green"; 
            }
            if(elBtnStop) { 
                elBtnStop.disabled = true; 
                elBtnStop.className = "btn-action btn-disabled"; 
            }
        }
    }

    // --- ATUALIZAÇÃO DOS KPIS USANDO CACHE ---

    // 1. Atualiza Produção
    if (elKpiProd) elKpiProd.innerText = estadoLocal.producao;

    // 2. Atualiza Taxa de Refugo (%)
    if (elKpiRefugo) {
        let total = estadoLocal.producao + estadoLocal.refugo;
        let taxa = (total > 0) ? (estadoLocal.refugo / total) * 100 : 0;
        elKpiRefugo.innerText = taxa.toFixed(1) + "%";
    }

    // 3. Atualiza Meta Texto
    if (elMetaText) elMetaText.innerText = `Meta de Produção: ${estadoLocal.meta} (un)`;

    // 4. Atualiza Barra de Progresso
    if (elProgressBar) {
        let percent = (estadoLocal.meta > 0) ? (estadoLocal.producao / estadoLocal.meta) * 100 : 0;
        if (percent > 100) percent = 100;
        elProgressBar.style.width = percent + "%";
        
        // Muda cor da barra se completar
        if (percent >= 100) {
            elProgressBar.style.backgroundColor = "var(--success-color)";
        } else {
            elProgressBar.style.backgroundColor = "var(--primary-blue)";
        }
    }
}

// --- Sincronização entre Abas ---
window.addEventListener('storage', (event) => {
    if (event.key === 'embrapac_estado') {
        estadoLocal = JSON.parse(event.newValue);
        if (typeof gerenciarAlarmesUI === 'function') gerenciarAlarmesUI();
        renderizar();
    }
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        estadoLocal = Maquina.ler();
        renderizar();
    }
});