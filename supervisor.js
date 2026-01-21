// supervisor.js

// 1. Lógica de Login
function attemptLogin() {
    const passInput = document.getElementById('admin-pass');
    const modal = document.getElementById('login-modal');
    
    // Senha simples para demonstração
    if (passInput.value === 'admin') {
        // Efeito de fade-out (opcional)
        modal.style.opacity = '0';
        modal.style.transition = 'opacity 0.5s';
        
        setTimeout(() => {
            modal.style.display = 'none';
        }, 500);
    } else {
        alert('Senha Incorreta! Tente novamente.');
        passInput.value = '';
        passInput.focus();
    }
}

// Permitir login com a tecla Enter
document.getElementById('admin-pass').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        attemptLogin();
    }
});

// 2. Lógica de Gestão de Turno
function toggleTurno(iniciar) {
    const statusSpan = document.getElementById('shift-status');
    const timeSpan = document.getElementById('shift-time');
    const btnStart = document.getElementById('btn-start-shift');
    const controlsActive = document.getElementById('active-shift-controls');
    
    const now = new Date();

    if (iniciar) {
        // --- Iniciando o Turno ---
        statusSpan.innerText = "EM ANDAMENTO";
        statusSpan.style.color = "var(--success-color)";
        timeSpan.innerText = "Início: " + now.toLocaleTimeString('pt-BR');

        // Alterna botões
        btnStart.style.display = 'none';
        controlsActive.style.display = 'block';
        
        console.log(`Turno iniciado em: ${now}`);

    } else {
        // --- Encerrando o Turno ---
        if(confirm('ATENÇÃO: Deseja encerrar o turno e consolidar os dados?')) {
            statusSpan.innerText = "TURNO FINALIZADO";
            statusSpan.style.color = "#7f8c8d";
            timeSpan.innerText = "Finalizado às: " + now.toLocaleTimeString('pt-BR');

            // Alterna botões
            controlsActive.style.display = 'none';
            btnStart.style.display = 'flex'; // Flex para alinhar ícone e texto
            btnStart.innerHTML = '<i class="fas fa-play-circle"></i> Iniciar Próximo Turno';
            
            alert("Turno encerrado com sucesso. Relatório gerado.");
        }
    }
}