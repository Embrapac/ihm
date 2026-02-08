/* ============================================================
   OPERADOR.JS - INTERFACE (Conectado ao Master)
   * Com mensagens detalhadas recuperadas do código antigo *
   ============================================================ */

let estadoLocal = {}; 
let alarmActive = false;
let stepFalha = 0;

// --- LOGIN (Mantém supervisor na tela) ---
function attemptLoginOperator() {
    const passInput = document.getElementById('operador-pass');
    
    if (typeof CONFIG === 'undefined') {
        alert("Erro Crítico: master.js não encontrado!");
        return;
    }

    const senhaDigitada = passInput.value;

    if (senhaDigitada === CONFIG.USUARIOS['operador'].pass) {
        Sessao.iniciar('operador');
        fecharModalLogin();
    } 
    else if (senhaDigitada === CONFIG.USUARIOS['admin'].pass) {
        Sessao.iniciar('admin'); 
        fecharModalLogin(); 
    } 
    else {
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
    // --- CORREÇÃO APLICADA: ATUALIZA CABEÇALHO AO CARREGAR ---
    Sessao.atualizarHeader(); 
    // ---------------------------------------------------------

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
        estadoLocal = Maquina.processarCiclo('MASTER'); // Mantemos compatibilidade
        if (typeof gerenciarAlarmesUI === 'function') gerenciarAlarmesUI();
        renderizar();
    }, 500);

    const passInput = document.getElementById('operador-pass');
    if(passInput) passInput.addEventListener('keypress', (e) => { if(e.key==='Enter') attemptLoginOperator(); });
});

// --- COMANDOS ---
function startLine() {
    if (estadoLocal.status === 'FALHA') return;
    estadoLocal.status = 'OPERANDO';
    estadoLocal.ultimoUpdate = Date.now();
    Maquina.escrever(estadoLocal);
    Logger.registrar("Produção Iniciada", "NORMAL");
    renderizar();
}

function stopLine() {
    estadoLocal.status = 'PARADO';
    Maquina.escrever(estadoLocal);
    Logger.registrar("Parada Manual", "NORMAL");
    renderizar();
}

function simulateFault() {
    if (estadoLocal.status !== 'OPERANDO') { alert("Apenas em modo operando."); return; }
    estadoLocal.status = 'FALHA';
    estadoLocal.horaFalha = new Date().toLocaleString('pt-BR');
    Maquina.escrever(estadoLocal);
    
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
            
            // Log de Reset (Vai para tabela de Alarmes - Verde)
            Logger.registrar("Manutenção OK / Reset", "NORMAL");
            
            renderizar();
        }
    }
}

function renderizar() {
    // Verifica se os elementos existem antes de tentar escrever neles
    const elCounter = document.getElementById('counter');
    if(elCounter) elCounter.innerText = estadoLocal.producao;
    
    const elMeta = document.getElementById('meta-text');
    if(elMeta) elMeta.innerText = `Meta de Produção: ${estadoLocal.meta} (un)`;
    
    const elBar = document.getElementById('progress-bar');
    if(elBar) {
        const pct = (estadoLocal.producao > 0 && estadoLocal.meta > 0) ? (estadoLocal.producao / estadoLocal.meta) * 100 : 0;
        elBar.style.width = (pct > 100 ? 100 : pct) + "%";
    }
    
    const display = document.getElementById('status-display');
    const detail = document.getElementById('status-detail');
    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');

    if(!display) return; // Se não estiver na tela correta, sai.

    display.className = "status-badge";
    
    if (estadoLocal.status === 'OPERANDO') {
        display.classList.add('status-pulsing'); display.innerText = "OPERANDO";
        if(detail) detail.innerText = `Tempo do Ciclo: ${estadoLocal.ciclo} (s)`;
        if(btnStart) btnStart.disabled = true; 
        if(btnStop) btnStop.disabled = false;

    } else if (estadoLocal.status === 'PARADO') {
        display.classList.add('status-stopped'); display.innerText = "PARADO";
        if(detail) detail.innerText = "Linha parada. Aguardando comando.";
        if(btnStart) btnStart.disabled = false; 
        if(btnStop) btnStop.disabled = true;

    } else if (estadoLocal.status === 'FALHA') {
        display.classList.add('status-error'); display.innerText = "FALHA";
        if(detail) detail.innerText = "Erro #502: Motor M2 Travado";
        if(btnStart) btnStart.disabled = true; 
        if(btnStop) btnStop.disabled = true;

    } else { // PRONTO
        display.classList.add('status-stopped'); display.innerText = estadoLocal.status;
        if(detail) detail.innerText = "Falha normalizada. Pronto para iniciar.";
        if(btnStart) btnStart.disabled = false; 
        if(btnStop) btnStop.disabled = true;
    }
}