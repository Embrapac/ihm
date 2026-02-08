/* ============================================================
   SUPERVISOR.JS - GESTÃO RICA (Conectado ao Master)
   ============================================================ */

let estado = {}; 
let stepFalha = 0; // Variável de controle (Igual ao Operador)

function attemptLogin() {
    const pass = document.getElementById('admin-pass').value;
    if (typeof CONFIG === 'undefined') { alert("Erro: master.js ausente."); return; }

    if (pass === CONFIG.USUARIOS['admin'].pass) {
        Sessao.iniciar('admin');
        document.getElementById('login-modal').style.display = 'none';
        Sessao.atualizarHeader();
    } else {
        alert('Senha Incorreta!');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Garante que o nome do usuário apareça ao carregar (F5)
    Sessao.atualizarHeader();

    // 2. Validação de Acesso
    const sessao = Sessao.validar();
    if (sessao && sessao.nivel === 2) {
        document.getElementById('login-modal').style.display = 'none';
    } else {
        document.getElementById('login-modal').style.display = 'flex';
    }

    // 3. Carga Inicial
    estado = Maquina.ler();
    if(document.getElementById('meta-input')) document.getElementById('meta-input').value = estado.meta;
    if(document.getElementById('ciclo-input')) document.getElementById('ciclo-input').value = estado.ciclo;
    
    atualizarInterface();

    // 4. Loops de Monitoramento
    setInterval(() => {
        estado = Maquina.processarCiclo(); // Lógica unificada (Master.js)
        atualizarInterface();
    }, 500);

    setInterval(contarDowntime, 1000);

    // Atalho de Enter no Login
    const passInput = document.getElementById('admin-pass');
    if(passInput) passInput.addEventListener('keypress', (e) => { if(e.key==='Enter') attemptLogin(); });
});

function contarDowntime() {
    if (estado.turnoAtivo && (estado.status === 'PARADO' || estado.status === 'FALHA')) {
        estado.downtime++;
        Maquina.escrever(estado);
        const kpi = document.getElementById('kpi-downtime');
        if(kpi) kpi.innerText = formatTime(estado.downtime);
    }
}

function formatTime(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
}

function salvarParametros() {
    const meta = parseInt(document.getElementById('meta-input').value);
    const ciclo = parseInt(document.getElementById('ciclo-input').value);
    
    if (!meta || meta < 1) { alert("Meta inválida."); return; }
    if (!ciclo || ciclo < 1 || ciclo > 60) { alert("Ciclo inválido (Máx 60s)."); return; }
    
    estado.meta = meta;
    estado.ciclo = ciclo;
    Maquina.escrever(estado);
    
    Logger.registrar(`Parâmetros Alterados (Meta: ${meta}, Ciclo: ${ciclo}s)`, "ALERTA");
    alert("Parâmetros de produção atualizados com sucesso!");
    atualizarInterface();
}

function toggleTurno(iniciar) {
    if (iniciar) {
        estado.turnoAtivo = true;
        estado.horaInicioTurno = new Date().toLocaleString('pt-BR');
        estado.relatorioPendente = false;
        Logger.registrar("Turno Iniciado", "NORMAL"); 
    } else {
        if (!confirm('Tem certeza que deseja ENCERRAR o turno atual?')) return;
        estado.turnoAtivo = false;
        estado.horaFimTurno = new Date().toLocaleString('pt-BR'); 
        estado.relatorioPendente = true;
        Logger.registrar("Turno Encerrado", "NORMAL"); 
    }
    Maquina.escrever(estado);
    atualizarInterface();
}

function zerarTurno() {
    if (estado.status !== 'PARADO' && estado.status !== 'PRONTO') { 
        alert("A linha precisa estar PARADA para zerar os dados."); 
        return; 
    }
    
    if (confirm("ATENÇÃO: Isso apagará toda a Produção, Refugo e OEE do turno.\n\nConfirmar zeramento?")) {
        estado.producao = 0; estado.refugo = 0; estado.downtime = 0; estado.oee = 0;
        Maquina.escrever(estado);
        Logger.registrar("Dados de Turno Zerados", "ALERTA"); 
        atualizarInterface();
    }
}

function startLine() {
    if (estado.status === 'FALHA') { alert("Sistema em Falha. Realize o reset."); return; }
    if (estado.producao >= estado.meta) { alert("Meta atingida! Aumente a meta para continuar."); return; }
    
    estado.status = 'OPERANDO';
    estado.ultimoUpdate = Date.now();
    Maquina.escrever(estado);
    Logger.registrar("Comando Remoto: Iniciar", "NORMAL");
    atualizarInterface();
}

function stopLine() {
    estado.status = 'PARADO';
    Maquina.escrever(estado);
    Logger.registrar("Comando Remoto: Parar", "NORMAL");
    atualizarInterface();
}

function registrarRefugo() {
    if (estado.producao > 0) {
        estado.producao--;
        estado.refugo++;
        Maquina.escrever(estado);
        Logger.registrar("Apontamento Manual de Refugo", "ALERTA"); 
        atualizarInterface();
    }
}

// --- FUNÇÕES DE FALHA (Protocolo Unificado) ---

function simularFalha() {
    if (estado.status !== 'OPERANDO') { alert("Simulação de falha apenas em modo operando."); return; }
    estado.status = 'FALHA';
    estado.horaFalha = new Date().toLocaleString('pt-BR');
    Maquina.escrever(estado);
    Logger.registrar("Simulação de Falha (Supervisor)", "FALHA");
    atualizarInterface();
}

// LÓGICA DE 2 PASSOS (Igual ao Operador)
function resetarFalhas() {
    // Passo 1: Reconhecer
    if (stepFalha === 0) {
        stepFalha = 1;
        Logger.registrar("Falha Reconhecida (Supervisor)", "RECONHECIDO");
        atualizarInterface(); 
    } 
    // Passo 2: Resetar/Confirmar
    else if (stepFalha === 1) {
        if (confirm("Confirmar que o reparo foi realizado?")) {
            estado.status = 'PRONTO';
            Maquina.escrever(estado);
            Logger.registrar("Reset Forçado (Supervisor)", "NORMAL");
            stepFalha = 0; // Reseta ciclo
            atualizarInterface();
        }
    }
}

function exportarRelatorio() {
    const msg = `RELATÓRIO DE TURNO ENVIADO!\n\n` +
                `Período: ${estado.horaInicioTurno} - ${estado.horaFimTurno}\n` +
                `Produção Total: ${estado.producao}\n` +
                `Tempo Parado: ${formatTime(estado.downtime)}\n` +
                `Refugo: ${estado.refugo}`;
    alert(msg);
    estado.relatorioPendente = false;
    Maquina.escrever(estado);
    Logger.registrar("Relatório de Turno Enviado", "INFORME"); 
    atualizarInterface();
}

function atualizarInterface() {
    const display = document.getElementById('status-display');
    const btnStart = document.getElementById('btn-man-start');
    const btnStop = document.getElementById('btn-man-stop');
    const btnZerar = document.getElementById('btn-zerar-turno');

    if (!display) return; 

    // Sincronia de reset externo
    if (estado.status !== 'FALHA') {
        stepFalha = 0;
    }

    // Status Badge
    display.className = "status-badge";
    if (estado.status === 'OPERANDO') {
        display.classList.add('status-pulsing'); display.innerText = "OPERANDO";
        if(btnStart) { btnStart.disabled = true; btnStart.className = "btn-action btn-disabled"; }
        if(btnStop) { btnStop.disabled = false; btnStop.className = "btn-action btn-red"; }
    } else {
        display.classList.add(estado.status === 'FALHA' ? 'status-error' : 'status-stopped');
        display.innerText = estado.status === 'FALHA' ? "FALHA" : estado.status;
        
        if(btnStart) {
            btnStart.disabled = (estado.status === 'FALHA'); 
            btnStart.className = (estado.status === 'FALHA') ? "btn-action btn-disabled" : "btn-action btn-green";
        }
        if(btnStop) {
            btnStop.disabled = true;
            btnStop.className = "btn-action btn-disabled";
        }
    }

    // --- BLOCO DO RELÓGIO (MOVIDO PARA CÁ) ---
    // Agora ele roda sempre, independente do if/else abaixo
    const elTime = document.getElementById('shift-time');
    if (elTime) {
        if (estado.turnoAtivo) {
            // Relógio rodando ao vivo
            elTime.innerHTML = '<i class="fas fa-clock"></i> ' + new Date().toLocaleString('pt-BR');
            elTime.style.color = "var(--primary-blue)";
            elTime.style.fontWeight = "bold";
        } else {
            // Data estática do encerramento
            elTime.innerHTML = '<i class="fas fa-history"></i> Encerrado em: ' + (estado.horaFimTurno || "--");
            elTime.style.color = "#7f8c8d";
            elTime.style.fontWeight = "normal";
        }
    }
    // ------------------------------------------

    // Controles de Turno (Visibilidade dos Botões)
    if (estado.turnoAtivo) {
        document.getElementById('active-shift-controls').style.display = 'block';
        document.getElementById('btn-start-shift').style.display = 'none';
        document.getElementById('btn-export').style.display = 'none';
        document.getElementById('shift-status').innerText = "EM ANDAMENTO";
        document.getElementById('shift-status').style.color = "var(--success-color)";
        
        if(btnZerar) { btnZerar.disabled = true; btnZerar.className = "btn-action btn-disabled"; }
    } else {
        document.getElementById('active-shift-controls').style.display = 'none';
        document.getElementById('btn-start-shift').style.display = estado.relatorioPendente ? 'none' : 'block';
        document.getElementById('btn-export').style.display = estado.relatorioPendente ? 'block' : 'none';
        document.getElementById('shift-status').innerText = "TURNO ENCERRADO";
        document.getElementById('shift-status').style.color = "#7f8c8d";
        
        const podeZerar = (estado.status === 'PARADO' || estado.status === 'PRONTO');
        if(btnZerar) {
            btnZerar.disabled = !podeZerar;
            btnZerar.className = podeZerar ? "btn-action btn-warning" : "btn-action btn-disabled";
        }
    }

    // KPIs
    document.getElementById('kpi-production').innerText = estado.producao;
    document.getElementById('kpi-downtime').innerText = formatTime(estado.downtime);
    
    let oee = (estado.meta > 0) ? (estado.producao / estado.meta) * 100 : 0;
    document.getElementById('kpi-oee').innerText = (oee > 100 ? 100 : oee).toFixed(1) + "%";
    
    let total = estado.producao + estado.refugo;
    let taxa = (total > 0) ? (estado.refugo / total) * 100 : 0;
    document.getElementById('kpi-refugo').innerText = taxa.toFixed(1) + "%";
    
    // --- UI ALARME INTELIGENTE (2 PASSOS) ---
    const alarmPanel = document.getElementById('alarm-panel');
    const alarmTime = document.getElementById('alarm-time');
    const btnResetText = document.getElementById('btn-reset-text');
    const alarmMsg = document.getElementById('alarm-msg');
    
    if (estado.status === 'FALHA') {
        if(alarmPanel) alarmPanel.classList.add('active');
        if(alarmTime) alarmTime.innerText = "Atualizado às: " + (estado.horaFalha || '--:--');
        
        // Texto dinâmico do botão
        if (stepFalha === 0) {
            if(btnResetText) btnResetText.innerText = "RESTAURAR FALHAS";
            if(alarmMsg) alarmMsg.innerText = "ALARME: MOTOR DA ESTEIRA TRAVADO";
        } else {
            if(btnResetText) btnResetText.innerText = "CONFIRMAR RESTAURAÇÃO";
            if(alarmMsg) alarmMsg.innerText = "MANUTENÇÃO NECESSÁRIA - Aguardando...";
        }
    } else {
        if(alarmPanel) alarmPanel.classList.remove('active');
    }
}