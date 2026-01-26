// supervisor.js - Versão Final (Reset no Relatório)

// VARIÁVEIS DE ESTADO
let productionCount = 0; 
let refugoCount = 0; 
let productionInterval = null;

let downtimeSeconds = 0;
let downtimeInterval = null;
let isShiftActive = false;

// 1. LOGIN
function attemptLogin() {
    const passInput = document.getElementById('admin-pass');
    const modal = document.getElementById('login-modal');
    if (passInput.value === 'admin') {
        modal.style.opacity = '0';
        setTimeout(() => { modal.style.display = 'none'; }, 500);
    } else {
        alert('Senha Incorreta!');
    }
}
document.getElementById('admin-pass').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') attemptLogin();
});


// 2. GESTÃO DE TURNO
function toggleTurno(iniciar) {
    const statusSpan = document.getElementById('shift-status');
    const timeSpan = document.getElementById('shift-time');
    const btnStart = document.getElementById('btn-start-shift');
    const controlsActive = document.getElementById('active-shift-controls');
    const btnExport = document.getElementById('btn-export');
    const display = document.getElementById('status-display');
    const btnManStart = document.getElementById('btn-man-start');
    const btnManStop = document.getElementById('btn-man-stop');
    const btnRefugo = document.getElementById('btn-refugo');
    const btnSave = document.getElementById('btn-save-params');

    if (iniciar) {
        // --- INICIAR TURNO ---
        isShiftActive = true;
        
        // Garante que começa zerado (caso venha de um reload)
        // O reset principal agora acontece ao exportar o relatório anterior
        if(document.getElementById('kpi-production').innerText !== '0') {
             productionCount = 0; refugoCount = 0; downtimeSeconds = 0;
             atualizarKPIs();
             atualizarDisplayDowntime();
             document.getElementById('kpi-production').innerText = 0;
        }
        
        statusSpan.innerText = "EM ANDAMENTO";
        statusSpan.style.color = "var(--success-color)";
        timeSpan.innerText = "Início: " + new Date().toLocaleTimeString();
        
        display.className = "status-badge status-stopped";
        display.innerHTML = 'PARADO';

        startDowntimeTimer(); 

        btnStart.style.display = 'none';
        controlsActive.style.display = 'block';
        btnExport.style.display = 'none';

        // Libera Controle Manual
        btnManStart.disabled = false;
        btnManStart.className = "btn-action btn-green";
        btnManStop.disabled = true;
        btnManStop.className = "btn-action btn-disabled";
        
        btnRefugo.disabled = true;
        btnRefugo.className = "btn-action btn-disabled";

        btnSave.disabled = false;
        btnSave.className = "btn-action btn-blue";

    } else {
        // --- ENCERRAR TURNO ---
        if(confirm('Confirma o encerramento do turno?')) {
            isShiftActive = false;
            
            statusSpan.innerText = "TURNO FINALIZADO";
            statusSpan.style.color = "#7f8c8d";
            timeSpan.innerText = "Fim: " + new Date().toLocaleTimeString();
            
            stopProductionTimer();
            stopDowntimeTimer();
            
            display.className = "status-badge status-stopped";
            display.innerHTML = 'PARADO';

            controlsActive.style.display = 'none';
            btnExport.style.display = 'flex';      
            btnExport.className = "btn-action btn-blue";
            btnExport.innerHTML = '<i class="fas fa-file-csv"></i> ENVIAR RELATÓRIO';
            
            // Trava tudo
            btnManStart.disabled = true;
            btnManStart.className = "btn-action btn-disabled";
            btnManStop.disabled = true;
            btnManStop.className = "btn-action btn-disabled";
            btnRefugo.disabled = true;
            btnRefugo.className = "btn-action btn-disabled";
            
            btnSave.disabled = false;
            btnSave.className = "btn-action btn-blue";

            // NÃO ZERA AQUI. APENAS PARA E MOSTRA MENSAGEM.
            alert("Turno encerrado. \nOs dados estão congelados para conferência.");
        }
    }
}

// 3. CONTROLE MANUAL
function startLine() {
    const meta = parseInt(document.getElementById('meta-input').value) || 0;
    if (productionCount >= meta && meta > 0) {
        alert("A meta de produção já foi atingida (" + meta + ").");
        return;
    }

    const display = document.getElementById('status-display');
    const btnManStart = document.getElementById('btn-man-start');
    const btnManStop = document.getElementById('btn-man-stop');
    const btnRefugo = document.getElementById('btn-refugo');
    const btnSave = document.getElementById('btn-save-params');

    display.className = "status-badge status-running";
    display.innerHTML = 'OPERANDO';
    
    stopDowntimeTimer();
    startProductionTimer();

    btnManStart.disabled = true;
    btnManStart.className = "btn-action btn-disabled";
    
    btnManStop.disabled = false;
    btnManStop.className = "btn-action btn-red";

    btnRefugo.disabled = false;
    btnRefugo.className = "btn-action btn-orange";

    btnSave.disabled = true;
    btnSave.className = "btn-action btn-disabled";
}

function stopLine() {
    const display = document.getElementById('status-display');
    const btnManStart = document.getElementById('btn-man-start');
    const btnManStop = document.getElementById('btn-man-stop');
    const btnRefugo = document.getElementById('btn-refugo');
    const btnSave = document.getElementById('btn-save-params');

    display.className = "status-badge status-stopped";
    display.innerHTML = 'PARADO';
    
    stopProductionTimer();
    if (isShiftActive) startDowntimeTimer();

    const statusSpan = document.getElementById('shift-status');
    if (statusSpan.innerText === "EM ANDAMENTO") {
        btnManStart.disabled = false;
        btnManStart.className = "btn-action btn-green";
    }
    
    btnManStop.disabled = true;
    btnManStop.className = "btn-action btn-disabled";

    btnRefugo.disabled = true;
    btnRefugo.className = "btn-action btn-disabled";

    btnSave.disabled = false;
    btnSave.className = "btn-action btn-blue";
}

// 3.1 REGISTRO DE REFUGO
function registrarRefugo() {
    if (productionCount > 0) {
        productionCount--; 
        document.getElementById('kpi-production').innerText = productionCount;
        refugoCount++;
        atualizarKPIs();
    } else {
        alert("Não é possível apontar refugo: A produção está zerada.");
    }
}

// 3.2 SALVAR PARÂMETROS
function salvarParametros() {
    const display = document.getElementById('status-display');
    if (display.innerText === 'OPERANDO' || display.innerText === 'FALHA') {
        alert("ERRO: Pare a linha antes de alterar parâmetros!");
        return;
    }
    alert("Parâmetros salvos com sucesso!");
}

// --- LÓGICA DE PRODUÇÃO ---
function startProductionTimer() {
    stopProductionTimer();
    let cicloInput = document.getElementById('ciclo-input').value;
    let velocidadeMs = parseFloat(cicloInput) * 1000;
    if (isNaN(velocidadeMs) || velocidadeMs < 100) velocidadeMs = 1000;

    productionInterval = setInterval(() => {
        const meta = parseInt(document.getElementById('meta-input').value) || 0;

        if (productionCount >= meta && meta > 0) {
            stopLine(); 
            alert("META DE PRODUÇÃO ATINGIDA!\nSistema parado automaticamente.");
            return;
        }

        productionCount++;
        document.getElementById('kpi-production').innerText = productionCount;
        atualizarKPIs();

    }, velocidadeMs);
}

function stopProductionTimer() {
    if (productionInterval) {
        clearInterval(productionInterval);
        productionInterval = null;
    }
}

// --- CÁLCULO DE KPIs ---
function atualizarKPIs() {
    const meta = parseInt(document.getElementById('meta-input').value) || 1; 
    let oee = (productionCount / meta) * 100;
    document.getElementById('kpi-oee').innerText = oee.toFixed(1) + "%";

    let totalProduzido = productionCount + refugoCount;
    let taxa = 0;
    if (totalProduzido > 0) {
        taxa = (refugoCount / totalProduzido) * 100;
    }
    document.getElementById('kpi-refugo').innerText = taxa.toFixed(1) + "%";
}


// --- LÓGICA DE DOWNTIME ---
function startDowntimeTimer() {
    if (!downtimeInterval && isShiftActive) {
        downtimeInterval = setInterval(() => {
            downtimeSeconds++;
            atualizarDisplayDowntime();
        }, 1000);
    }
}

function stopDowntimeTimer() {
    if (downtimeInterval) {
        clearInterval(downtimeInterval);
        downtimeInterval = null;
    }
}

function actualizarDisplayDowntime() { 
    const display = document.getElementById('kpi-downtime');
    display.innerText = formatTime(downtimeSeconds);
}
const atualizarDisplayDowntime = actualizarDisplayDowntime; 

function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// --- AUXILIARES ---
function atualizarVelocidade() {
    const display = document.getElementById('status-display');
    if (display.innerText === 'OPERANDO') {
        startProductionTimer();
    }
}

// --- FUNÇÃO EXPORTAR (MUDANÇA AQUI: ZERA DEPOIS DE ENVIAR) ---
function exportarRelatorio() {
    const btnExport = document.getElementById('btn-export');
    const btnStart = document.getElementById('btn-start-shift');
    const taxaRefugo = document.getElementById('kpi-refugo').innerText;
    
    // 1. Envia Relatório (Simulação)
    alert(`Relatório Enviado com Sucesso!\n\n-- DADOS FINAIS --\nProdução (Boas): ${productionCount}\nRefugo: ${refugoCount} (${taxaRefugo})\nTempo Parado: ${formatTime(downtimeSeconds)}\nOEE Final: ${document.getElementById('kpi-oee').innerText}\n\nO sistema será zerado agora.`);
    
    // 2. Zera as variáveis
    productionCount = 0;
    refugoCount = 0;
    downtimeSeconds = 0;

    // 3. Atualiza a tela para 0
    document.getElementById('kpi-production').innerText = 0;
    atualizarKPIs();
    atualizarDisplayDowntime();

    // 4. Prepara botões para novo turno
    btnExport.style.display = 'none';
    btnStart.style.display = 'flex';
    btnStart.innerHTML = '<i class="fas fa-play-circle"></i> Iniciar Próximo Turno';
}

// 5. FALHA E RESET
function simularFalha() {
    const currentStatus = document.getElementById('status-display').innerText;

    if (currentStatus !== "OPERANDO") {
        alert("Atenção: A simulação de falhas só pode ser realizada com a linha em operação (Ciclo Iniciado).");
        return; 
    }

    const display = document.getElementById('status-display');
    const btnReset = document.getElementById('btn-reset');
    const alarmPanel = document.getElementById('alarm-panel');
    const btnSave = document.getElementById('btn-save-params');
    const hora = new Date().toLocaleTimeString();

    stopProductionTimer();
    startDowntimeTimer();

    display.className = "status-badge status-error";
    display.innerHTML = '<i class="fas fa-exclamation-triangle"></i> FALHA';
    
    document.getElementById('btn-man-start').disabled = true;
    document.getElementById('btn-man-start').className = "btn-action btn-disabled";
    document.getElementById('btn-man-stop').disabled = true;
    document.getElementById('btn-man-stop').className = "btn-action btn-disabled";
    document.getElementById('btn-refugo').disabled = true;
    document.getElementById('btn-refugo').className = "btn-action btn-disabled";

    btnSave.disabled = true;
    btnSave.className = "btn-action btn-disabled";

    document.getElementById('alarm-msg').innerText = "ALARME CRÍTICO: MOTOR TRAVADO";
    document.getElementById('alarm-time').innerText = "Ocorrido às: " + hora;
    alarmPanel.classList.add('active'); 
    
    btnReset.disabled = false;
}

function resetarFalhas() {
    const display = document.getElementById('status-display');
    const btnReset = document.getElementById('btn-reset');
    const alarmPanel = document.getElementById('alarm-panel');
    const btnManStart = document.getElementById('btn-man-start');
    const btnRefugo = document.getElementById('btn-refugo');
    const btnSave = document.getElementById('btn-save-params');

    if (confirm('Confirma manutenção realizada?')) {
        display.className = "status-badge status-stopped";
        display.innerHTML = 'PRONTO';
        
        alarmPanel.classList.remove('active');
        btnReset.disabled = true;

        const statusSpan = document.getElementById('shift-status');
        if (statusSpan.innerText === "EM ANDAMENTO") {
            btnManStart.disabled = false;
            btnManStart.className = "btn-action btn-green";
            
            btnRefugo.disabled = true;
            btnRefugo.className = "btn-action btn-disabled";

            btnSave.disabled = false;
            btnSave.className = "btn-action btn-blue";
        }

        alert('Sistema resetado. Pronto para iniciar.');
    }
}

// 6. VALIDAÇÃO
function validarNumero(input) { input.value = input.value.replace(/[^0-9]/g, ''); }
function validarCiclo(input) {
    input.value = input.value.replace(/[^0-9]/g, '');
    if (input.value !== '') {
        let v = parseInt(input.value);
        if (v > 60) input.value = 60;
        if (v === 0) input.value = 1;
    }
}