// supervisor.js

// --- 1. LÓGICA DE LOGIN ---
function attemptLogin() {
    const passInput = document.getElementById('admin-pass');
    const modal = document.getElementById('login-modal');
    
    if (passInput.value === 'admin') {
        modal.style.opacity = '0';
        setTimeout(() => { modal.style.display = 'none'; }, 500);
    } else {
        alert('Senha Incorreta! Tente novamente.');
        passInput.value = '';
        passInput.focus();
    }
}
document.getElementById('admin-pass').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') attemptLogin();
});


// --- 2. LÓGICA DE STATUS, MANUTENÇÃO E RELATÓRIO ---

// Função: SIMULAR FALHA
function simularFalha() {
    const display = document.getElementById('status-display');
    const detail = document.getElementById('status-detail');
    const btnReset = document.getElementById('btn-reset');
    const btnExport = document.getElementById('btn-export');

    // 1. Muda para FALHA (Vermelho)
    display.className = "status-badge status-error";
    display.innerHTML = '<i class="fas fa-exclamation-triangle"></i> FALHA CRÍTICA';
    
    const hora = new Date().toLocaleTimeString();
    detail.innerText = `Erro #502: Motor Travado às ${hora}. Aguardando Reset.`;
    detail.style.color = "var(--danger-color)";
    detail.style.fontWeight = "bold";

    // 2. Habilita Reset
    btnReset.className = "btn-action btn-warning"; 
    btnReset.disabled = false;

    // 3. Garante que Exportar esteja INVISÍVEL
    btnExport.style.display = 'none';
    
    alert("ALERTA: Falha simulada. O sistema parou.");
}

// Função: RESETAR FALHAS
function resetarFalhas() {
    const display = document.getElementById('status-display');
    const detail = document.getElementById('status-detail');
    const btnReset = document.getElementById('btn-reset');
    const btnExport = document.getElementById('btn-export');

    if (confirm('Confirma o reset das falhas e liberação da linha?')) {
        // 1. Vai para PARADO / PRONTO (Cinza) - Conforme solicitado
        display.className = "status-badge status-stopped";
        display.innerHTML = 'PARADO / PRONTO';
        
        // Mensagem temporária antes do envio do relatório
        detail.innerText = "Falha corrigida. Sistema pronto. Relatório disponível.";
        detail.style.color = "var(--success-color)";
        detail.style.fontWeight = "bold";
        
        // 2. Trava Reset
        btnReset.className = "btn-action btn-disabled";
        btnReset.disabled = true;

        // 3. FAZ O BOTÃO DE RELATÓRIO APARECER
        btnExport.style.display = 'flex';
        btnExport.className = "btn-action btn-blue";
        btnExport.innerText = 'EXPORTAR RELATÓRIO (CSV)';
        btnExport.disabled = false;

        alert('Sistema Resetado');
    }
}

// Função: EXPORTAR RELATÓRIO
function exportarRelatorio() {
    const btnExport = document.getElementById('btn-export');
    const detail = document.getElementById('status-detail');
    
    // Simula envio
    const nomeArquivo = `incidente_${Date.now()}.csv`;
    alert(`Sucesso!\n\nRelatório "${nomeArquivo}" enviado por email.`);
    
    // 1. O botão SOME
    btnExport.style.display = 'none';

    // 2. A frase de "Falha corrigida" SOME e volta ao padrão neutro
    detail.innerText = "Aguardando o Operador reiniciar.";
    detail.style.color = "#666"; 
    detail.style.fontWeight = "normal";
}


// --- 3. VALIDAÇÃO DE PARÂMETROS ---
function validarNumero(input) {
    input.value = input.value.replace(/[^0-9]/g, '');
}

function validarCiclo(input) {
    input.value = input.value.replace(/[^0-9]/g, '');
    if (input.value !== '') {
        let valor = parseInt(input.value);
        if (valor > 60) input.value = 60;
        if (valor === 0) input.value = 1;
    }
}