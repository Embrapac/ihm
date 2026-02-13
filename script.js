/* ============================================================
   SCRIPT.JS - UTILITÁRIOS (Versão: Saneamento de Dados Profissional)
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof CONFIG === 'undefined') {
        console.error("ALERTA: Módulo 'master.js' não detectado.");
    }
    
    // --- SANEAMENTO DE DADOS (PROFISSIONAL) ---
    // Em vez de apagar tudo, filtra apenas o que é inválido ou antigo.
    sanitizarBancoDeDados();
    
    // Inicializa vazio se não existir nada
    if (!localStorage.getItem('embrapac_logs')) {
        localStorage.setItem('embrapac_logs', JSON.stringify([]));
    }

    if (document.getElementById('tabela-eventos')) {
        renderizarHistoricoCompleto();
    }
});

// Função Inteligente de Limpeza
function sanitizarBancoDeDados() {
    try {
        const rawData = localStorage.getItem('embrapac_logs');
        if (!rawData) return;

        let logs = JSON.parse(rawData);
        
        // FILTRO: Mantém apenas o que NÃO é lixo
        const logsLimpos = logs.filter(log => {
            // 1. Identifica dados de teste antigos (Dezembro/2025)
            const isDadoAntigo = log.data && (log.data.includes('/12/2025') || log.data.includes('14/12/2025'));
            
            // 2. Identifica dados corrompidos (undefined)
            const isCorrompido = log.usuario === 'undefined' || !log.usuario;

            // Retorna TRUE para manter (Se NÃO for antigo E NÃO for corrompido)
            return !isDadoAntigo && !isCorrompido;
        });

        // Salva apenas os dados limpos de volta
        if (logs.length !== logsLimpos.length) {
            console.log(`Limpeza realizada: ${logs.length - logsLimpos.length} registros inválidos removidos.`);
            localStorage.setItem('embrapac_logs', JSON.stringify(logsLimpos));
        }
    } catch (e) {
        console.error("Erro ao sanitizar dados, resetando por segurança.", e);
        localStorage.setItem('embrapac_logs', JSON.stringify([]));
    }
}

// --- RENDERIZAÇÃO (Lógica Híbrida Mantida) ---
function renderizarHistoricoCompleto() {
    const tbodyEventos = document.querySelector('#tabela-eventos tbody');
    const tbodyAlarmes = document.querySelector('#tabela-alarmes tbody');

    if (!tbodyEventos || !tbodyAlarmes) return;

    const logs = JSON.parse(localStorage.getItem('embrapac_logs') || '[]');
    
    tbodyEventos.innerHTML = '';
    tbodyAlarmes.innerHTML = '';

    if (logs.length === 0) {
        const msg = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#999; font-style:italic;">Histórico vazio.</td></tr>';
        tbodyEventos.innerHTML = msg;
        tbodyAlarmes.innerHTML = msg;
        return;
    }

    logs.forEach(l => {
        // Cores
        let badgeClass = 'badge-info';
        const tipo = l.tipo ? l.tipo.toUpperCase() : 'INFORME';

        if (tipo === 'INFORME') badgeClass = 'badge-blue';
        else if (tipo === 'NORMAL') badgeClass = 'badge-norm';
        else if (tipo === 'ALERTA') badgeClass = 'badge-orange';
        else if (tipo === 'FALHA') badgeClass = 'badge-active';
        else if (tipo === 'ATIVO') badgeClass = 'badge-active';
        else if (tipo === 'RECONHECIDO') badgeClass = 'badge-ack';

        // Lógica de Destino
        const textoEvento = l.evento ? l.evento.toUpperCase() : '';
        const ehCicloAlarme = ['FALHA', 'ATIVO', 'RECONHECIDO'].includes(tipo) || 
                              textoEvento.includes('FALHA') || 
                              textoEvento.includes('ALARME') ||
                              (tipo === 'NORMAL' && (textoEvento.includes('RESET') || textoEvento.includes('MANUTENÇÃO')));
        
        // Tratamento de Colunas (Fallback seguro)
        let colOrigem, colDetalhe;
        const usuarioSeguro = l.usuario || 'Sistema'; 
        const cargoSeguro = l.cargo || '--';

        if (ehCicloAlarme) {
            if (['FALHA', 'ATIVO'].includes(tipo) || textoEvento.includes('FALHA') || textoEvento.includes('ALARME')) {
                colOrigem = 'Sistema';
                colDetalhe = 'Automático';
            } else {
                colOrigem = usuarioSeguro; 
                colDetalhe = cargoSeguro;  
            }
        } else {
            colOrigem = usuarioSeguro;
            colDetalhe = cargoSeguro;
        }

        const row = `
            <tr class="table-row">
                <td>${l.data}</td>
                <td>${l.evento}</td>
                <td>${colOrigem}</td>
                <td>${colDetalhe}</td>
                <td><span class="badge ${badgeClass}">${tipo}</span></td>
            </tr>`;

        if (ehCicloAlarme) tbodyAlarmes.innerHTML += row;
        else tbodyEventos.innerHTML += row;
    });
}

// --- FILTRO E EXPORTAÇÃO ---
function filterTable() {
    const statusFilter = document.getElementById('filter-status').value;
    const dStart = document.getElementById('filter-date-start').value; 
    const dEnd = document.getElementById('filter-date-end').value;
    const tStart = document.getElementById('filter-time-start').value || '00:00';
    const tEnd = document.getElementById('filter-time-end').value || '23:59';

    const rows = document.querySelectorAll('.table-row');

    rows.forEach(row => {
        let showRow = true;
        const badge = row.querySelector('.badge');
        
        if (badge && statusFilter !== 'all') {
            if (badge.innerText !== statusFilter) showRow = false;
        }

        if (showRow && (dStart || dEnd)) {
            const cellFullText = row.cells[0].innerText.trim(); 
            // Regex que aceita qualquer separador entre data e hora
            const match = cellFullText.match(/^(\d{2})\/(\d{2})\/(\d{4}).*?(\d{2}):(\d{2})/);
            
            if (match) {
                const [_, day, month, year, hour, min] = match;
                const rowISO = `${year}-${month}-${day}T${hour}:${min}`;
                const startISO = dStart ? `${dStart}T${tStart}` : null;
                const endISO = dEnd ? `${dEnd}T${tEnd}` : null;

                if (startISO && rowISO < startISO) showRow = false;
                if (endISO && rowISO > endISO) showRow = false;
            }
        }
        row.style.display = showRow ? '' : 'none';
    });
}

function resetFilters() {
    document.getElementById('filter-date-start').value = '';
    document.getElementById('filter-time-start').value = '';
    document.getElementById('filter-date-end').value = '';
    document.getElementById('filter-time-end').value = '';
    document.getElementById('filter-status').value = 'all';
    const rows = document.querySelectorAll('.table-row');
    rows.forEach(row => row.style.display = '');
}

function exportTableToCSV(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const rows = table.querySelectorAll("tr");
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
    rows.forEach(row => {
        if (row.style.display !== 'none') {
            const cols = row.querySelectorAll("td, th");
            let rowData = [];
            cols.forEach(col => {
                let text = col.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim();
                rowData.push(text);
            });
            csvContent += rowData.join(";") + "\r\n";
        }
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/* --- SINCRONIZAÇÃO DE HISTÓRICO --- */
window.addEventListener('storage', (event) => {
    // Se o banco de dados de logs mudou em outra aba...
    if (event.key === 'embrapac_logs') {
        // ... e se a função de renderizar tabela existe nesta página
        if (typeof renderizarHistoricoCompleto === 'function') {
            console.log("Novos logs detectados. Atualizando tabela...");
            renderizarHistoricoCompleto();
        }
    }
});