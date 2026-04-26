/* ============================================================
   SUPERVISOR.JS (Conectado ao Master)
   ============================================================ */

let estado = {}; 
let stepFalha = 0; // Variável de controle (Igual ao Operador)

let elDisplay, elDetail, elBtnStart, elBtnStop, elBtnZerar;
let elKpiProd, elKpiOee, elKpiRefugo, elMetaText, elProgressBar;
let elAlarmPanel, elAlarmTime, elBtnResetText, elAlarmMsg;
let elActiveShiftControls, elBtnStartShift, elBtnExport, elShiftStatus, elShiftTime, elKpiDowntime;

// --- LÓGICA DE LOGIN (Atualizada para JWT/API) ---
async function attemptLogin() {
    const passInput = document.getElementById('admin-pass');
    
    // Como a tela não tem campo de "Usuário", forçamos o envio do ID do banco 'admin'
    const sucesso = await Sessao.autenticar('admin', passInput.value);

    if (sucesso) {
        document.getElementById('login-modal').style.display = 'none';
        Sessao.atualizarHeader();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    Sessao.atualizarHeader();

    // --- CACHEAMENTO ---
    elDisplay = document.getElementById('status-display');
    elDetail = document.getElementById('status-detail');
    elBtnStart = document.getElementById('btn-man-start');
    elBtnStop = document.getElementById('btn-man-stop');
    elBtnZerar = document.getElementById('btn-zerar-turno');
    elKpiProd = document.getElementById('kpi-production');
    elKpiOee = document.getElementById('kpi-oee');
    elKpiRefugo = document.getElementById('kpi-refugo');
    elMetaText = document.getElementById('meta-text');
    elProgressBar = document.getElementById('progress-bar');
    elAlarmPanel = document.getElementById('alarm-panel');
    elAlarmTime = document.getElementById('alarm-time');
    elBtnResetText = document.getElementById('btn-reset-text');
    elAlarmMsg = document.getElementById('alarm-msg');
    elActiveShiftControls = document.getElementById('active-shift-controls');
    elBtnStartShift = document.getElementById('btn-start-shift');
    elBtnExport = document.getElementById('btn-export');
    elShiftStatus = document.getElementById('shift-status');
    elShiftTime = document.getElementById('shift-time');
    elKpiDowntime = document.getElementById('kpi-downtime');

    const sessao = Sessao.validar();
    if (sessao && sessao.nivel === 2) {
        document.getElementById('login-modal').style.display = 'none';
    } else {
        document.getElementById('login-modal').style.display = 'flex';
    }

    estado = Maquina.ler();
    if(document.getElementById('meta-input')) document.getElementById('meta-input').value = estado.meta;
    if(document.getElementById('ciclo-input')) document.getElementById('ciclo-input').value = estado.ciclo;
    
    atualizarInterface();

    setInterval(() => {
        estado = Maquina.processarCiclo(); 
        atualizarInterface();
    }, 500);

    setInterval(() => {
        atualizarRelogio(); 
    }, 1000);

    const passInput = document.getElementById('admin-pass');
    if(passInput) passInput.addEventListener('keypress', (e) => { 
        if(e.key === 'Enter') {
            e.preventDefault();
            attemptLogin(); 
        }
    });
});

function formatTime(s) {
    s = Math.floor(s); 
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return h === '00' ? `${m}:${sec}` : `${h}:${m}:${sec}`;
}

function salvarParametros() {
    const meta = parseInt(document.getElementById('meta-input').value);
    const ciclo = parseInt(document.getElementById('ciclo-input').value);
    
    if (!meta || meta < 1) { alert("Meta inválida."); return; }
    if (!ciclo || ciclo < 1 || ciclo > 60) { alert("Ciclo inválido (Máx 60s)."); return; }
    
    estado.meta = meta;
    estado.ciclo = ciclo;
    Maquina.escrever(estado);
    estado = Maquina.processarCiclo(); // ACELERAÇÃO DA UI
    
    Logger.registrar(`Parâmetros Alterados (Meta: ${meta}, Ciclo: ${ciclo}s)`, "ALERTA");
    alert("Parâmetros de produção atualizados com sucesso!");
    atualizarInterface();
}

function toggleTurno(iniciar) {
    estado = Maquina.ler();
    if (iniciar) {
        estado.turnoAtivo = true;
        estado.horaInicioTurno = new Date().toLocaleString('pt-BR');       
        estado.tsInicio = Date.now(); 
        estado.relatorioPendente = false;
        Logger.registrar("Turno Iniciado", "NORMAL"); 
    } else {
        if (!confirm('Tem certeza que deseja ENCERRAR o turno atual?')) return;
        estado.turnoAtivo = false;
        estado.horaFimTurno = new Date().toLocaleString('pt-BR');    
        estado.tsFim = Date.now();
        estado.relatorioPendente = true;
        Logger.registrar("Turno Encerrado", "NORMAL"); 
    }
    Maquina.escrever(estado);
    estado = Maquina.processarCiclo(); // ACELERAÇÃO DA UI
    atualizarInterface();
}

function zerarTurno() {
    if (estado.status !== 'PARADO' && estado.status !== 'PRONTO') { 
        alert("A linha precisa estar PARADA para zerar os dados."); 
        return; 
    }
    
    if (confirm("ATENÇÃO: Isso apagará toda a Produção, Refugo e OEE do turno.\n\nConfirmar zeramento?")) {
        // CORREÇÃO: Agora as caixas P, M e G também são zeradas!
        estado.producao = 0; 
        estado.producaoP = 0; 
        estado.producaoM = 0; 
        estado.producaoG = 0; 
        estado.refugo = 0; 
        estado.downtime = 0; 
        estado.oee = 0;
        
        Maquina.escrever(estado);
        estado = Maquina.processarCiclo(); 
        Logger.registrar("Dados de Turno Zerados", "ALERTA"); 
        atualizarInterface();
    }
}

function startLine() {
    estado = Maquina.ler();
    if (estado.status === 'FALHA') { alert("Sistema em Falha. Realize o reset."); return; }
    if (estado.producao >= estado.meta) { alert("Meta atingida! Aumente a meta para continuar."); return; }
    
    estado.status = 'OPERANDO';
    estado.ultimoUpdate = Date.now();
    Maquina.escrever(estado);
    estado = Maquina.processarCiclo(); // ACELERAÇÃO DA UI
    Logger.registrar("Comando Remoto: Iniciar", "NORMAL");
    atualizarInterface();
}

function stopLine() {
    estado = Maquina.ler();
    estado.status = 'PARADO';
    Maquina.escrever(estado);
    estado = Maquina.processarCiclo(); // ACELERAÇÃO DA UI
    Logger.registrar("Comando Remoto: Parar", "NORMAL");
    atualizarInterface();
}

function registrarRefugo() {
    if (estado.producao > 0) {
        estado.producao--;
        estado.refugo++;

        // CORREÇÃO: Mantém a matemática do Total = P + M + G perfeita
        if (estado.producaoP > 0) estado.producaoP--;
        else if (estado.producaoM > 0) estado.producaoM--;
        else if (estado.producaoG > 0) estado.producaoG--;

        Maquina.escrever(estado);
        estado = Maquina.processarCiclo(); // ACELERAÇÃO DA UI
        Logger.registrar("Apontamento Manual de Refugo", "ALERTA"); 
        atualizarInterface();
    }
}

function simularFalha() {
    if (estado.status !== 'OPERANDO') { alert("Simulação de falha apenas em modo operando."); return; }
    estado.status = 'FALHA';
    estado.horaFalha = new Date().toLocaleString('pt-BR');
    Maquina.escrever(estado);
    estado = Maquina.processarCiclo(); // ACELERAÇÃO DA UI
    Logger.registrar("Simulação de Falha (Supervisor)", "FALHA");
    atualizarInterface();
}

function resetarFalhas() {
    if (stepFalha === 0) {
        stepFalha = 1;
        Logger.registrar("Falha Reconhecida (Supervisor)", "RECONHECIDO");
        atualizarInterface(); 
    } 
    else if (stepFalha === 1) {
        if (confirm("Confirmar que o reparo foi realizado?")) {
            estado.status = 'PRONTO';
            Maquina.escrever(estado);
            estado = Maquina.processarCiclo(); // ACELERAÇÃO DA UI
            Logger.registrar("Reset Forçado (Supervisor)", "NORMAL");
            stepFalha = 0; 
            atualizarInterface();
        }
    }
}

function exportarRelatorio() {
    let duracaoTotal = "00h 00m 00s";
    let tempoTotalSegundos = 0;

    if (estado.tsFim && estado.tsInicio) {
        tempoTotalSegundos = (estado.tsFim - estado.tsInicio) / 1000;
        duracaoTotal = msParaTempo(estado.tsFim - estado.tsInicio);
    }

    let oeeNum = 0;
    if (tempoTotalSegundos > 0) {
        let currentDowntimeSegundos = estado.downtime || 0;
        if (estado.inicioDowntimeMs && estado.turnoAtivo && estado.status !== 'OPERANDO') {
            currentDowntimeSegundos += (Date.now() - estado.inicioDowntimeMs) / 1000;
        }
        let tempoPerdido = currentDowntimeSegundos + (estado.refugo * estado.ciclo);
        let tempoValioso = tempoTotalSegundos - tempoPerdido;
        if (tempoValioso < 0) tempoValioso = 0;
        
        oeeNum = (tempoValioso / tempoTotalSegundos) * 100;
    }
    let oeeVal = (oeeNum > 100 ? 100 : oeeNum).toFixed(1);

    let refugoVal = (estado.producao + estado.refugo > 0) 
        ? ((estado.refugo / (estado.producao + estado.refugo)) * 100).toFixed(1) 
        : "0.0";

    const csvHeader = "DATA;INICIO;FIM;DURACAO;PRODUCAO;REFUGO (un);REFUGO (%);OEE;PARADAS\r\n";
    const csvData   = [
        new Date().toLocaleDateString('pt-BR'), 
        estado.horaInicioTurno,
        estado.horaFimTurno,
        duracaoTotal,
        estado.producao,
        estado.refugo,
        refugoVal.replace('.', ',') + "%", 
        oeeVal.replace('.', ',') + "%",
        formatTime(estado.downtime)
    ].join(";");

    const csvContent = "\uFEFF" + csvHeader + csvData;

    const msg = `RELATÓRIO GERADO!\n\n` +
                `Duração: ${duracaoTotal}\n` +
                `Produção: ${estado.producao} un\n` +
                `OEE: ${oeeVal}%\n\n` +
                `O download do arquivo CSV iniciará automaticamente.`;
    alert(msg);

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const nomeArquivo = `Relatorio_Turno_${new Date().toISOString().slice(0,10)}.csv`;
    link.setAttribute("download", nomeArquivo);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 100);

    estado.relatorioPendente = false;
    Maquina.escrever(estado);
    estado = Maquina.processarCiclo(); // ACELERAÇÃO DA UI
    Logger.registrar("Relatório CSV Exportado", "INFORME"); 
    atualizarInterface();
}

function atualizarInterface() {
    if (!elDisplay) return; 

    if (estado.status !== 'FALHA') {
        stepFalha = 0;
    }

    elDisplay.className = "status-badge";

    if (estado.status === 'OPERANDO') {
        elDisplay.classList.add('status-pulsing'); 
        elDisplay.innerText = "OPERANDO";
        if(elDetail) elDetail.innerText = `Tempo do Ciclo: ${estado.ciclo} (s)`;        
        if(elBtnStart) { elBtnStart.disabled = true; elBtnStart.className = "btn-action btn-disabled"; }
        if(elBtnStop) { elBtnStop.disabled = false; elBtnStop.className = "btn-action btn-red"; }

    } else if (estado.status === 'PARADO') {
        elDisplay.classList.add('status-stopped'); 
        elDisplay.innerText = "PARADO";        
        
        // NOVO: Verifica se parou porque bateu a meta
        if (estado.producao >= estado.meta && estado.meta > 0) {
            if(elDetail) {
                elDetail.innerHTML = "<strong style='color: var(--success-color);'><i class='fas fa-trophy'></i> META ATINGIDA!</strong> A linha parou automaticamente.";
            }
        } else {
            if(elDetail) elDetail.innerText = "Linha parada. Aguardando comando."; 
        }
        
        if(elBtnStart) { elBtnStart.disabled = false; elBtnStart.className = "btn-action btn-green"; }
        if(elBtnStop) { elBtnStop.disabled = true; elBtnStop.className = "btn-action btn-disabled"; }

    } else if (estado.status === 'FALHA') {
        elDisplay.classList.add('status-error'); 
        elDisplay.innerText = "FALHA";        
        if(elDetail) elDetail.innerText = "Erro #502: Motor M2 Travado";        
        if(elBtnStart) { elBtnStart.disabled = true; elBtnStart.className = "btn-action btn-disabled"; }
        if(elBtnStop) { elBtnStop.disabled = true; elBtnStop.className = "btn-action btn-disabled"; }

    } else { 
        elDisplay.classList.add('status-stopped'); 
        elDisplay.innerText = estado.status;        
        if(elDetail) elDetail.innerText = "Falha normalizada. Pronto para iniciar.";        
        if(elBtnStart) { elBtnStart.disabled = false; elBtnStart.className = "btn-action btn-green"; }
        if(elBtnStop) { elBtnStop.disabled = true; elBtnStop.className = "btn-action btn-disabled"; }
    }
    
    atualizarRelogio();

    if (estado.turnoAtivo) {
        if(elActiveShiftControls) elActiveShiftControls.style.display = 'block';
        if(elBtnStartShift) elBtnStartShift.style.display = 'none';
        if(elBtnExport) elBtnExport.style.display = 'none';
        if(elShiftStatus) {
            elShiftStatus.innerText = "EM ANDAMENTO";
            elShiftStatus.style.color = "var(--success-color)";
        }
        if(elBtnZerar) { elBtnZerar.disabled = true; elBtnZerar.className = "btn-action btn-disabled"; }
    } else {
        if(elActiveShiftControls) elActiveShiftControls.style.display = 'none';
        if(elBtnStartShift) elBtnStartShift.style.display = estado.relatorioPendente ? 'none' : 'block';
        if(elBtnExport) elBtnExport.style.display = estado.relatorioPendente ? 'block' : 'none';
        if(elShiftStatus) {
            elShiftStatus.innerText = "TURNO ENCERRADO";
            elShiftStatus.style.color = "#7f8c8d";
        }
        const podeZerar = (estado.status === 'PARADO' || estado.status === 'PRONTO');
        if(elBtnZerar) {
            elBtnZerar.disabled = !podeZerar;
            elBtnZerar.className = podeZerar ? "btn-action btn-warning" : "btn-action btn-disabled";
        }
    }

    if (elKpiProd) elKpiProd.innerText = estado.producao;
    const elKpiP = document.getElementById('kpi-prod-p');
    const elKpiM = document.getElementById('kpi-prod-m');
    const elKpiG = document.getElementById('kpi-prod-g');

    if (elKpiP) elKpiP.innerText = estado.producaoP || 0;
    if (elKpiM) elKpiM.innerText = estado.producaoM || 0;
    if (elKpiG) elKpiG.innerText = estado.producaoG || 0;
    let oee = 0;
    let tempoTotalSegundos = 0;

    if (estado.turnoAtivo && estado.tsInicio) {
        tempoTotalSegundos = (Date.now() - estado.tsInicio) / 1000;
    } else if (!estado.turnoAtivo && estado.tsFim && estado.tsInicio) {
        tempoTotalSegundos = (estado.tsFim - estado.tsInicio) / 1000;
    }

    if (tempoTotalSegundos > 0) {
        let currentDowntimeSegundos = estado.downtime || 0;
        if (estado.inicioDowntimeMs && estado.turnoAtivo && estado.status !== 'OPERANDO') {
            currentDowntimeSegundos += (Date.now() - estado.inicioDowntimeMs) / 1000;
        }
        
        let tempoPerdido = currentDowntimeSegundos + (estado.refugo * estado.ciclo);
        let tempoValioso = tempoTotalSegundos - tempoPerdido;
        if (tempoValioso < 0) tempoValioso = 0;

        oee = (tempoValioso / tempoTotalSegundos) * 100;
    }
    
    if (elKpiOee) elKpiOee.innerText = (oee > 100 ? 100 : oee).toFixed(1) + "%";
    
    let total = estado.producao + estado.refugo;
    let taxa = (total > 0) ? (estado.refugo / total) * 100 : 0;
    if (elKpiRefugo) elKpiRefugo.innerText = taxa.toFixed(1) + "%";
    
    if (elMetaText) elMetaText.innerText = `Meta de Produção: ${estado.meta} (un)`;

    if (elProgressBar) {
        let percent = (estado.meta > 0) ? (estado.producao / estado.meta) * 100 : 0;
        if (percent > 100) percent = 100;
        elProgressBar.style.width = percent + "%";
        
        if (percent >= 100) {
            elProgressBar.style.backgroundColor = "var(--success-color)";
        } else {
            elProgressBar.style.backgroundColor = "var(--primary-blue)";
        }
    }

    if (estado.status === 'FALHA') {
        if(elAlarmPanel) elAlarmPanel.classList.add('active');
        if(elAlarmTime) elAlarmTime.innerText = "Atualizado às: " + (estado.horaFalha || '--:--');
        
        if (stepFalha === 0) {
            if(elBtnResetText) elBtnResetText.innerText = "RESTAURAR FALHAS";
            if(elAlarmMsg) elAlarmMsg.innerText = "ALARME: MOTOR DA ESTEIRA TRAVADO";
        } else {
            if(elBtnResetText) elBtnResetText.innerText = "CONFIRMAR RESTAURAÇÃO";
            if(elAlarmMsg) elAlarmMsg.innerText = "MANUTENÇÃO NECESSÁRIA - Aguardando...";
        }
    } else {
        if(elAlarmPanel) elAlarmPanel.classList.remove('active');
    }
}

// --- Sincronização via Servidor Node.js ---
window.addEventListener('IHM_Update', (event) => {
    estado = event.detail;
    atualizarInterface();
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        estado = Maquina.ler();
        atualizarInterface();
    }
});

function msParaTempo(duration) {
    if (!duration || duration < 0) return "00h 00m 00s";
    
    let seconds = Math.floor((duration / 1000) % 60);
    let minutes = Math.floor((duration / (1000 * 60)) % 60);
    let hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

    hours = (hours < 10) ? "0" + hours : hours;
    minutes = (minutes < 10) ? "0" + minutes : minutes;
    seconds = (seconds < 10) ? "0" + seconds : seconds;

    return hours + "h " + minutes + "m " + seconds + "s";
}

function atualizarRelogio() {
    if (!elShiftTime) return;

    if (estado.turnoAtivo) {
        const duracaoAtual = Date.now() - (estado.tsInicio || Date.now());
        
        elShiftTime.innerHTML = `
            <i class="fas fa-clock"></i> ${new Date().toLocaleString('pt-BR')}<br>
            <span style="font-size: 0.9em; color: var(--secondary-blue);">
                Duração: ${msParaTempo(duracaoAtual)}
            </span>
        `;
        elShiftTime.style.color = "var(--primary-blue)";
        elShiftTime.style.fontWeight = "bold";
    } else {
        let textoDuracao = "--";
        if (estado.tsFim && estado.tsInicio) {
            textoDuracao = msParaTempo(estado.tsFim - estado.tsInicio);
        }

        elShiftTime.innerHTML = `
            <i class="fas fa-history"></i> Encerrado em: ${estado.horaFimTurno || "--"}<br>
            <span style="font-size: 0.9em;">
                Duração Total: ${textoDuracao}
            </span>
        `;
        elShiftTime.style.color = "#7f8c8d";
        elShiftTime.style.fontWeight = "normal";
    }

    if (elKpiDowntime) {
        let currentDowntime = estado.downtime || 0;
        if (estado.inicioDowntimeMs && estado.turnoAtivo && estado.status !== 'OPERANDO') {
            currentDowntime += (Date.now() - estado.inicioDowntimeMs) / 1000;
        }
        elKpiDowntime.innerText = formatTime(currentDowntime);
    }
}