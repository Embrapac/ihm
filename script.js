/* ============================================================
   SCRIPT.JS - Funções Gerais (Histórico e Utilitários)
   ============================================================ */

// --- FILTRAR TABELA (DATA E STATUS) ---
function filterTable() {
    const statusFilter = document.getElementById('filter-status').value;
    
    // Captura o intervalo de datas
    const dateStart = document.getElementById('filter-date-start').value; // YYYY-MM-DD
    const dateEnd = document.getElementById('filter-date-end').value;     // YYYY-MM-DD
    
    const rows = document.querySelectorAll('.table-row');

    rows.forEach(row => {
        let showRow = true;

        // 1. Verificação de Status
        const badge = row.querySelector('.badge');
        if (badge) {
            const statusText = badge.innerText;
            if (statusFilter !== 'all' && statusText !== statusFilter) {
                showRow = false;
            }
        }

        // 2. Verificação de Data (Intervalo)
        if (showRow) { 
            // Pega a data da primeira célula (ex: "14/12/2025 09:42:10")
            const cellFullText = row.cells[0].innerText.trim();
            const cellDatePart = cellFullText.split(' ')[0]; // Pega só "14/12/2025"
            
            // Converte de DD/MM/YYYY para YYYY-MM-DD para poder comparar
            const [day, month, year] = cellDatePart.split('/');
            const rowDateFormatted = `${year}-${month}-${day}`;

            // Se tem data inicial e a linha é menor que ela, esconde
            if (dateStart && rowDateFormatted < dateStart) {
                showRow = false;
            }

            // Se tem data final e a linha é maior que ela, esconde
            if (dateEnd && rowDateFormatted > dateEnd) {
                showRow = false;
            }
        }

        row.style.display = showRow ? '' : 'none';
    });
}

// --- RESETAR FILTROS ---
function resetFilters() {
    // 1. Limpa os valores dos inputs
    document.getElementById('filter-date-start').value = '';
    document.getElementById('filter-date-end').value = '';
    document.getElementById('filter-status').value = 'all';

    // 2. Chama o filtro novamente (que agora vai mostrar tudo)
    filterTable();
}

// --- EXPORTAR PARA CSV ---
function exportTableToCSV(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;

    const rows = table.querySelectorAll("tr");
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // BOM para acentuação no Excel

    rows.forEach(row => {
        // Só exporta linhas visíveis
        if (row.style.display !== 'none') {
            const cols = row.querySelectorAll("td, th");
            let rowData = [];
            
            cols.forEach(col => {
                // Limpa quebras de linha dentro da célula
                let text = col.innerText.replace(/(\r\n|\n|\r)/gm, " ").trim();
                rowData.push(text);
            });
            
            csvContent += rowData.join(";") + "\r\n";
        }
    });

    // Cria link de download invisível e clica nele
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}