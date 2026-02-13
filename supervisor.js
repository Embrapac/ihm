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
    estado = Maquina.ler();
    if (iniciar) {
        estado.turnoAtivo = true;
              
        estado.horaInicioTurno = new Date().toLocaleString('pt-BR');       
        estado.tsInicio = Date.now(); 
        // ------------------------------------------------
        
        estado.relatorioPendente = false;
        Logger.registrar("Turno Iniciado", "NORMAL"); 
    } else {
        if (!confirm('Tem certeza que deseja ENCERRAR o turno atual?')) return;
        estado.turnoAtivo = false;
                
        estado.horaFimTurno = new Date().toLocaleString('pt-BR');    
        estado.tsFim = Date.now();
        // ------------------------------------------------
        
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
    estado = Maquina.ler();
    if (estado.status === 'FALHA') { alert("Sistema em Falha. Realize o reset."); return; }
    if (estado.producao >= estado.meta) { alert("Meta atingida! Aumente a meta para continuar."); return; }
    
    estado.status = 'OPERANDO';
    estado.ultimoUpdate = Date.now();
    Maquina.escrever(estado);
    Logger.registrar("Comando Remoto: Iniciar", "NORMAL");
    atualizarInterface();
}

function stopLine() {
    estado = Maquina.ler();
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
    // 1. Cálculos Finais (Duração e OEE)
    let duracaoTotal = "00h 00m 00s";
    if (estado.tsFim && estado.tsInicio) {
        duracaoTotal = msParaTempo(estado.tsFim - estado.tsInicio);
    }

    let oeeVal = (estado.meta > 0) ? ((estado.producao / estado.meta) * 100).toFixed(1) : "0.0";
    let refugoVal = (estado.producao + estado.refugo > 0) 
        ? ((estado.refugo / (estado.producao + estado.refugo)) * 100).toFixed(1) 
        : "0.0";

    // 2. Montagem do Conteúdo CSV
    // Usamos ponto-e-vírgula (;) que é o padrão do Excel no Brasil
    const csvHeader = "DATA;INICIO;FIM;DURACAO;PRODUCAO;REFUGO (un);REFUGO (%);OEE;PARADAS\n";
    const csvData   = [
        new Date().toLocaleDateString('pt-BR'), // Data do dia
        estado.horaInicioTurno,
        estado.horaFimTurno,
        duracaoTotal,
        estado.producao,
        estado.refugo,
        refugoVal.replace('.', ',') + "%", // Troca ponto por vírgula pro Excel BR
        oeeVal.replace('.', ',') + "%",
        formatTime(estado.downtime)
    ].join(";");

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvHeader + csvData;

    // 3. Feedback Visual (Alerta rápido)
    const msg = `RELATÓRIO GERADO!\n\n` +
                `Duração: ${duracaoTotal}\n` +
                `Produção: ${estado.producao} un\n` +
                `OEE: ${oeeVal}%\n\n` +
                `O download do arquivo CSV iniciará automaticamente.`;
    alert(msg);

    // 4. Disparar Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    // Nome do arquivo com data e hora para não sobrescrever
    const nomeArquivo = `Relatorio_Turno_${new Date().toISOString().slice(0,10)}.csv`;
    link.setAttribute("download", nomeArquivo);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 5. Finalizar Turno no Sistema
    estado.relatorioPendente = false;
    Maquina.escrever(estado);
    Logger.registrar("Relatório CSV Exportado", "INFORME"); 
    atualizarInterface();
}

function atualizarInterface() {
    const display = document.getElementById('status-display');
    const detail = document.getElementById('status-detail');
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
        display.classList.add('status-pulsing'); 
        display.innerText = "OPERANDO";
        if(detail) detail.innerText = `Tempo do Ciclo: ${estado.ciclo} (s)`;        
        if(btnStart) { btnStart.disabled = true; btnStart.className = "btn-action btn-disabled"; }
        if(btnStop) { btnStop.disabled = false; btnStop.className = "btn-action btn-red"; }

    } else if (estado.status === 'PARADO') {
        display.classList.add('status-stopped'); 
        display.innerText = "PARADO";        
        if(detail) detail.innerText = "Linha parada. Aguardando comando."; 
        if(btnStart) { btnStart.disabled = false; btnStart.className = "btn-action btn-green"; }
        if(btnStop) { btnStop.disabled = true; btnStop.className = "btn-action btn-disabled"; }

    } else if (estado.status === 'FALHA') {
        display.classList.add('status-error'); 
        display.innerText = "FALHA";        
        if(detail) detail.innerText = "Erro #502: Motor M2 Travado";        
        if(btnStart) { btnStart.disabled = true; btnStart.className = "btn-action btn-disabled"; }
        if(btnStop) { btnStop.disabled = true; btnStop.className = "btn-action btn-disabled"; }

    } else { // PRONTO (Resetado)
        display.classList.add('status-stopped'); 
        display.innerText = estado.status;        
        if(detail) detail.innerText = "Falha normalizada. Pronto para iniciar.";        
        if(btnStart) { btnStart.disabled = false; btnStart.className = "btn-action btn-green"; }
        if(btnStop) { btnStop.disabled = true; btnStop.className = "btn-action btn-disabled"; }
    }
    
    // --- BLOCO DO RELÓGIO (MOVIDO PARA CÁ) ---
    const elTime = document.getElementById('shift-time');
    if (elTime) {
        if (estado.turnoAtivo) {
            // CÁLCULO AO VIVO: Agora - Inicio
            const duracaoAtual = Date.now() - (estado.tsInicio || Date.now());
            
            elTime.innerHTML = `
                <i class="fas fa-clock"></i> ${new Date().toLocaleString('pt-BR')}<br>
                <span style="font-size: 0.9em; color: var(--secondary-blue);">
                    Duração: ${msParaTempo(duracaoAtual)}
                </span>
            `;
            elTime.style.color = "var(--primary-blue)";
            elTime.style.fontWeight = "bold";
        } else {
            // CÁLCULO ESTÁTICO: Fim - Inicio
            let textoDuracao = "--";
            if (estado.tsFim && estado.tsInicio) {
                textoDuracao = msParaTempo(estado.tsFim - estado.tsInicio);
            }

            elTime.innerHTML = `
                <i class="fas fa-history"></i> Encerrado em: ${estado.horaFimTurno || "--"}<br>
                <span style="font-size: 0.9em;">
                    Duração Total: ${textoDuracao}
                </span>
            `;
            elTime.style.color = "#7f8c8d";
            elTime.style.fontWeight = "normal";
        }
    }

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
    
    // Atualiza Meta Texto (Adaptado para o Supervisor)
    const metaText = document.getElementById('meta-text');
    if (metaText) metaText.innerText = `Meta de Produção: ${estado.meta} (un)`;

    // Atualiza Barra de Progresso (Adaptado para o Supervisor)
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) {
        let percent = (estado.meta > 0) ? (estado.producao / estado.meta) * 100 : 0;
        if (percent > 100) percent = 100;
        progressBar.style.width = percent + "%";
        
        // Muda cor da barra se completar
        if (percent >= 100) {
            progressBar.style.backgroundColor = "var(--success-color)";
        } else {
            progressBar.style.backgroundColor = "var(--primary-blue)";
        }
    }

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

// --- Sincronização entre Abas ---
window.addEventListener('storage', (event) => {
    if (event.key === 'embrapac_estado') {
        estado = JSON.parse(event.newValue);
        atualizarInterface();
    }
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        estado = Maquina.ler();
        atualizarInterface();
    }
});

// --- Converte Milissegundos em Texto ---
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