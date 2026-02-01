/* ============================================================
   SUPERVISOR.JS - MASTER (Completo: Relatório, Meta, Downtime, 2 Tempos)
   ============================================================ */

const ESTADO_PADRAO = {
    producao: 0,
    refugo: 0,
    meta: 1500,
    ciclo: 1,
    status: 'OPERANDO',
    ultimoUpdate: Date.now(),
    turnoAtivo: false,
    relatorioPendente: false, // Controla o botão azul
    downtime: 0,              // Contador de tempo parado
    horaInicioTurno: '--:--',
    horaFimTurno: '--:--',
    horaFalha: '--:--'
};

let estado = { ...ESTADO_PADRAO };
let productionInterval = null;
let syncInterval = null;
let clockInterval = null;
let stepFalha = 0; // Controle dos passos da falha no Supervisor

function attemptLogin() {
    const input = document.getElementById('admin-pass');
    const modal = document.getElementById('login-modal');
    if (input && input.value === 'admin') {
        modal.style.opacity = '0';
        setTimeout(() => { modal.style.display = 'none'; }, 500);
        salvarEstado(); 
    } else {
        alert('Senha Incorreta!');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    carregarEstado();
    const passInput = document.getElementById('admin-pass');
    if(passInput) passInput.addEventListener('keypress', (e) => { if(e.key==='Enter') attemptLogin(); });

    document.getElementById('meta-input').value = estado.meta;
    document.getElementById('ciclo-input').value = estado.ciclo;

    iniciarRelogioTurno();
    syncInterval = setInterval(cicloPrincipal, 500);
    atualizarInterface();
});

function carregarEstado() {
    try {
        const salvo = localStorage.getItem('embrapac_db');
        if (salvo) estado = { ...ESTADO_PADRAO, ...JSON.parse(salvo) };
        else salvarEstado();
    } catch (e) {
        estado = { ...ESTADO_PADRAO };
        salvarEstado();
    }
    
    // Sincronia de Reset Externo (Se operador resolveu, reseta aqui)
    if (estado.status !== 'FALHA' && stepFalha > 0) {
        stepFalha = 0;
        document.getElementById('alarm-panel').classList.remove('active');
        document.getElementById('btn-reset-text').innerText = "RESETAR FALHAS";
    }
}

function salvarEstado() {
    localStorage.setItem('embrapac_db', JSON.stringify(estado));
}

// --- CICLO PRINCIPAL (PRODUÇÃO) ---
function cicloPrincipal() {
    carregarEstado();
    const agora = Date.now();

    if (estado.status === 'OPERANDO') {
        if (agora - estado.ultimoUpdate >= (estado.ciclo * 1000)) {
            // Verifica Meta
            if (estado.producao >= estado.meta) {
                estado.status = 'PARADO';
                salvarEstado();
                alert("META ATINGIDA! Linha parada automaticamente.");
                atualizarInterface();
            } else {
                estado.producao++;
                estado.ultimoUpdate = agora;
                salvarEstado();
            }
        }
    }
    atualizarInterface();
}

// --- RELÓGIO + DOWNTIME (OTIMIZADO) ---
function iniciarRelogioTurno() {
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(() => {
        // Relógio Visual
        const elTime = document.getElementById('shift-time');
        if (elTime) {
            if (!estado.turnoAtivo) {
                elTime.innerText = "Início: " + new Date().toLocaleTimeString();
            } else {
                elTime.innerText = "Início: " + estado.horaInicioTurno;
            }
        }

        // Lógica de Tempo Parado (Downtime)
        // Conta apenas se: Turno ATIVO + (PARADO ou FALHA)
        if (estado.turnoAtivo && (estado.status === 'PARADO' || estado.status === 'FALHA')) {
            estado.downtime++;
            salvarEstado();
            // Atualiza KPI na hora para fluidez
            const kpiDowntime = document.getElementById('kpi-downtime');
            if(kpiDowntime) kpiDowntime.innerText = formatTime(estado.downtime);
        }
    }, 1000);
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// --- GESTÃO DE TURNO ---
function toggleTurno(iniciar) {
    if (iniciar) {
        estado.turnoAtivo = true;
        estado.relatorioPendente = false; // Reseta estado do relatório
        estado.horaInicioTurno = new Date().toLocaleTimeString();
        salvarEstado();
    } else {
        if (confirm('Confirma o encerramento do turno?')) {
            estado.turnoAtivo = false;
            estado.relatorioPendente = true; // Ativa botão azul
            estado.horaFimTurno = new Date().toLocaleTimeString();
            salvarEstado();
        }
    }
    atualizarInterface();
}

function exportarRelatorio() {
    alert(`Relatório CSV enviado com sucesso!\n\nPeríodo: ${estado.horaInicioTurno} - ${estado.horaFimTurno}\nProdução Total: ${estado.producao}\nTempo Parado: ${formatTime(estado.downtime)}`);
    
    estado.relatorioPendente = false; // Libera para iniciar próximo turno
    salvarEstado();
    atualizarInterface();
}

function zerarTurno() {
    if (estado.status !== 'PARADO') {
        alert("Pare a linha para zerar dados."); return;
    }
    if (confirm("Zerar todos os contadores (Produção, Refugo, Tempo)?")) {
        estado.producao = 0;
        estado.refugo = 0;
        estado.downtime = 0;
        salvarEstado();
        atualizarInterface();
    }
}

// --- CONTROLES ---
function startLine() {
    if (estado.status === 'FALHA') { alert("Resete a falha primeiro."); return; }
    if (estado.producao >= estado.meta) { alert("Meta atingida! Aumente a meta para continuar."); return; }
    
    estado.status = 'OPERANDO';
    estado.ultimoUpdate = Date.now();
    salvarEstado();
    atualizarInterface();
}

function stopLine() {
    estado.status = 'PARADO';
    salvarEstado();
    atualizarInterface();
}

function registrarRefugo() {
    if (estado.producao > 0) {
        estado.producao--;
        estado.refugo++;
        salvarEstado();
        atualizarInterface();
    }
}

function salvarParametros() {
    const meta = parseInt(document.getElementById('meta-input').value);
    const ciclo = parseInt(document.getElementById('ciclo-input').value);
    if (!meta || meta < 1) { alert("Meta inválida."); return; }
    if (!ciclo || ciclo < 1 || ciclo > 60) { alert("Ciclo inválido."); return; }
    estado.meta = meta;
    estado.ciclo = ciclo;
    salvarEstado();
    alert("Parâmetros Atualizados!");
}

// --- FALHAS (2 TEMPOS) ---
function simularFalha() {
    if (estado.status !== 'OPERANDO') { 
        alert("Simulação de falha apenas em modo operando."); 
        return; 
    }
    estado.status = 'FALHA';
    estado.horaFalha = new Date().toLocaleTimeString();
    salvarEstado();
    
    stepFalha = 1;
    document.getElementById('btn-reset-text').innerText = "RESETAR FALHAS";
    
    document.getElementById('alarm-msg').innerText = "ALARME: MOTOR DA ESTEIRA TRAVADO";
    document.getElementById('alarm-time').innerText = "Ocorrido às: " + estado.horaFalha;
    document.getElementById('alarm-panel').classList.add('active');
}

function resetarFalhas() {
    if (stepFalha === 1) {
        // Passo 1
        alert("Falha em análise, aguarde a manutenção.");
        document.getElementById('btn-reset-text').innerText = "CONFIRMAR CONSERTO";
        stepFalha = 2;
    } else if (stepFalha === 2) {
        // Passo 2
        if (confirm("O técnico realizou a manutenção?")) {
            document.getElementById('alarm-panel').classList.remove('active');
            estado.status = 'PRONTO';
            salvarEstado();
            
            stepFalha = 0; 
            document.getElementById('btn-reset-text').innerText = "RESETAR FALHAS";
            
            atualizarInterface();
            alert("Falha resetada. Sistema PRONTO.");
        }
    }
}

function atualizarInterface() {
    const display = document.getElementById('status-display');
    const btnStart = document.getElementById('btn-man-start');
    const btnStop = document.getElementById('btn-man-stop');
    const btnZerar = document.getElementById('btn-zerar-turno');

    // Status
    display.className = "status-badge";
    if (estado.status === 'OPERANDO') {
        display.classList.add('status-pulsing');
        display.innerHTML = 'OPERANDO';
        btnStart.disabled = true; btnStart.className = "btn-action btn-disabled";
        btnStop.disabled = false; btnStop.className = "btn-action btn-red";
    } else if (estado.status === 'PARADO' || estado.status === 'PRONTO') {
        display.classList.add('status-stopped');
        display.innerHTML = estado.status === 'PRONTO' ? 'PRONTO' : 'PARADO';
        btnStart.disabled = false; btnStart.className = "btn-action btn-green";
        btnStop.disabled = true; btnStop.className = "btn-action btn-disabled";
    } else if (estado.status === 'FALHA') {
        display.classList.add('status-error');
        display.innerHTML = 'FALHA';
        btnStart.disabled = true; btnStart.className = "btn-action btn-disabled";
        btnStop.disabled = true; btnStop.className = "btn-action btn-disabled";
        
        const panel = document.getElementById('alarm-panel');
        if(!panel.classList.contains('active')) {
            document.getElementById('alarm-msg').innerText = "ALARME: MOTOR DA ESTEIRA TRAVADO";
            document.getElementById('alarm-time').innerText = "Ocorrido às: " + (estado.horaFalha || '--:--');
            panel.classList.add('active');
            stepFalha = 1; 
        }
    } else {
        document.getElementById('alarm-panel').classList.remove('active');
    }

    // Turno e Botões
    const btnStartShift = document.getElementById('btn-start-shift');
    const controlsShift = document.getElementById('active-shift-controls');
    const btnExport = document.getElementById('btn-export');
    
    if (estado.turnoAtivo) {
        // Turno Ativo
        btnStartShift.style.display = 'none';
        controlsShift.style.display = 'block';
        btnExport.style.display = 'none';
        document.getElementById('shift-status').innerText = "EM ANDAMENTO";
        document.getElementById('shift-status').style.color = "var(--success-color)";
        btnZerar.disabled = true;
        btnZerar.className = "btn-action btn-disabled";
    } else {
        // Turno Encerrado
        controlsShift.style.display = 'none';
        document.getElementById('shift-status').innerText = "TURNO ENCERRADO";
        document.getElementById('shift-status').style.color = "#7f8c8d";

        if (estado.relatorioPendente) {
            // Estado: Relatório Pendente (Mostra botão Azul)
            btnStartShift.style.display = 'none';
            btnExport.style.display = 'block';
        } else {
            // Estado: Aguardando Início (Mostra botão Verde)
            btnStartShift.style.display = 'block';
            btnExport.style.display = 'none';
            document.getElementById('shift-status').innerText = "";
        }

        // Regra Zerar: Só se estiver parado
        if (estado.status === 'PARADO' || estado.status === 'PRONTO') {
            btnZerar.disabled = false;
            btnZerar.className = "btn-action btn-warning";
        } else {
            btnZerar.disabled = true;
            btnZerar.className = "btn-action btn-disabled";
        }
    }

    // KPIs Updates
    document.getElementById('kpi-production').innerText = estado.producao;
    // KPI Downtime já atualizado no loop do relógio, mas garantimos aqui também
    if(document.getElementById('kpi-downtime')) {
        document.getElementById('kpi-downtime').innerText = formatTime(estado.downtime);
    }
    
    let oee = (estado.producao / estado.meta) * 100;
    document.getElementById('kpi-oee').innerText = (oee > 100 ? 100 : oee).toFixed(1) + "%";
    
    let total = estado.producao + estado.refugo;
    let taxa = total > 0 ? (estado.refugo / total) * 100 : 0;
    document.getElementById('kpi-refugo').innerText = taxa.toFixed(1) + "%";
}