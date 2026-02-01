/* ============================================================
   OPERADOR.JS - ESPELHO INTELIGENTE (Com Login e Alertas)
   ============================================================ */

let estadoLocal = {
    producao: 0,
    meta: 1500,
    ciclo: 1,
    status: 'OPERANDO',
    turnoAtivo: true 
};

let syncInterval = null;
let alarmActive = false;
let stepFalha = 0;
let metaAlertShown = false; // Controle para exibir alerta de meta apenas uma vez

// --- LOGIN DO OPERADOR ---
function attemptLoginOperator() {
    const input = document.getElementById('operador-pass');
    const modal = document.getElementById('login-modal');
    
    if (input && input.value === 'operador') {
        modal.style.opacity = '0';
        setTimeout(() => { modal.style.display = 'none'; }, 500);
    } else {
        alert('Senha Incorreta! (Dica: operador)');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    sincronizar(); 
    syncInterval = setInterval(sincronizar, 500);
    renderizar();

    const passInput = document.getElementById('operador-pass');
    if(passInput) {
        passInput.addEventListener('keypress', (e) => { 
            if(e.key === 'Enter') attemptLoginOperator(); 
        });
    }
});

function sincronizar() {
    try {
        const salvo = localStorage.getItem('embrapac_db');
        if (salvo) {
            estadoLocal = JSON.parse(salvo);
        }
    } catch (e) {
        console.error("Erro na sincronia", e);
    }
    
    // Detector de Falha (Lógica dos Popups)
    if (estadoLocal.status === 'FALHA' && !alarmActive) {
        ativarModoFalha();
    } else if (estadoLocal.status !== 'FALHA' && alarmActive) {
        alarmActive = false;
        stepFalha = 0;
        document.getElementById('alarm-panel').classList.remove('active');
    }

    // --- LÓGICA DE ALERTA DE META ATINGIDA (OPERADOR) ---
    // Reseta o flag se a produção for zerada ou meta aumentada
    if (estadoLocal.producao < estadoLocal.meta) {
        metaAlertShown = false;
    }

    // Se atingiu a meta, parou e ainda não mostramos o alerta
    if (estadoLocal.producao >= estadoLocal.meta && estadoLocal.status === 'PARADO' && !metaAlertShown && estadoLocal.meta > 0) {
        alert("META ATINGIDA! Linha parada automaticamente.");
        metaAlertShown = true; // Impede que o alerta apareça repetidamente
    }
    
    renderizar();
}

function startLine() {
    if (estadoLocal.status === 'FALHA') return;
    estadoLocal.status = 'OPERANDO';
    estadoLocal.ultimoUpdate = Date.now();
    salvarLocal();
    renderizar();
}

function stopLine() {
    estadoLocal.status = 'PARADO';
    salvarLocal();
    renderizar();
}

function simulateFault() {
    // Verificação padronizada com o Supervisor
    if (estadoLocal.status !== 'OPERANDO') {
        alert("Simulação de falha apenas em modo operando.");
        return;
    }
    
    estadoLocal.status = 'FALHA';
    estadoLocal.horaFalha = new Date().toLocaleTimeString();
    salvarLocal();
}

function salvarLocal() {
    localStorage.setItem('embrapac_db', JSON.stringify(estadoLocal));
}

function ativarModoFalha() {
    alarmActive = true;
    stepFalha = 1;
    const hora = estadoLocal.horaFalha || new Date().toLocaleTimeString();
    mostrarAlarme("ALARME: MOTOR DA ESTEIRA TRAVADO", "Ocorrido às: " + hora, "RECONHECER ALARME");
}

function mostrarAlarme(msg, time, btnText) {
    const panel = document.getElementById('alarm-panel');
    document.getElementById('alarm-msg').innerText = msg;
    document.getElementById('alarm-time').innerText = time;
    
    const btnSpan = document.getElementById('btn-ack-text');
    if(btnSpan) btnSpan.innerText = btnText;
    
    panel.classList.add('active');
}

function acknowledgeAlarm() {
    const hora = estadoLocal.horaFalha || new Date().toLocaleTimeString();

    if (stepFalha === 1) {
        alert("Alarme Reconhecido. O som foi silenciado. A falha persiste até manutenção.");
        stepFalha = 2;
        mostrarAlarme("MANUTENÇÃO NECESSÁRIA", "Ocorrido às: " + hora, "CONFIRMAR CONSERTO");
    } else if (stepFalha === 2) {
        if (confirm("O técnico consertou o motor fisicamente?")) {
            stepFalha = 0;
            alarmActive = false;
            document.getElementById('alarm-panel').classList.remove('active');
            
            estadoLocal.status = 'PRONTO';
            salvarLocal();
            renderizar();
        }
    }
}

function renderizar() {
    document.getElementById('counter').innerText = estadoLocal.producao;
    
    const pMeta = document.getElementById('meta-text'); 
    if (pMeta) {
        pMeta.innerText = `Meta de Produção: ${estadoLocal.meta} (un)`;
    }
    
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        let pct = (estadoLocal.producao / estadoLocal.meta) * 100;
        progressBar.style.width = (pct > 100 ? 100 : pct) + "%";
    }

    const display = document.getElementById('status-display');
    const detail = document.getElementById('status-detail');
    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');

    display.className = "status-badge"; 

    if (estadoLocal.status === 'OPERANDO') {
        display.classList.add('status-pulsing');
        display.innerText = "OPERANDO";
        if(detail) detail.innerText = `Tempo do Ciclo: ${estadoLocal.ciclo} (s)`;
        
        if(btnStart) btnStart.disabled = true;
        if(btnStop) btnStop.disabled = false;

    } else if (estadoLocal.status === 'PARADO') {
        display.classList.add('status-stopped');
        display.innerText = "PARADO";
        if(detail) detail.innerText = "Linha parada. Aguardando comando.";

        if(btnStart) btnStart.disabled = false;
        if(btnStop) btnStop.disabled = true;

    } else if (estadoLocal.status === 'PRONTO') {
        display.classList.add('status-stopped');
        display.innerText = "PRONTO";
        if(detail) detail.innerText = "Falha normalizada. Pronto para iniciar.";

        if(btnStart) btnStart.disabled = false;
        if(btnStop) btnStop.disabled = true;

    } else if (estadoLocal.status === 'FALHA') {
        display.classList.add('status-error');
        display.innerText = "FALHA";
        if(detail) detail.innerText = "Erro #502: Motor M2 Travado";

        if(btnStart) btnStart.disabled = true;
        if(btnStop) btnStop.disabled = true;
    }
}