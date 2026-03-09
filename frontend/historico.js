/* ========================================================================
   HISTORICO.JS - UTILITÁRIOS (CONTROLE DE HISTÓRICO, FILTROS, EXPORTAÇÃO)
   ======================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof CONFIG === 'undefined') console.error("ALERTA: Módulo 'master.js' não detectado.");
    
    sanitizarBancoDeDados();
    
    if (!localStorage.getItem('embrapac_logs')) {
        localStorage.setItem('embrapac_logs', JSON.stringify([]));
    }
    if (document.getElementById('tabela-alarmes')) renderizarHistoricoCompleto();
});

function sanitizarBancoDeDados() {
    try {
        const rawData = localStorage.getItem('embrapac_logs');
        if (!rawData) return;
        let logs = JSON.parse(rawData);
        
        // Configuração de retenção: Apagar logs com mais de 30 dias
        const DIAS_DE_RETENCAO = 30;
        const limiteTempoMs = Date.now() - (DIAS_DE_RETENCAO * 24 * 60 * 60 * 1000);

        const logsLimpos = logs.filter(log => {
            // 1. Usa sua função existente para converter a data do log em milissegundos
            const timestampLog = converterDataParaNumero(log.data);
            
            // 2. Verifica se o log é mais antigo que o limite de retenção (e ignora logs sem data válida)
            const isDadoAntigo = timestampLog > 0 && timestampLog < limiteTempoMs;
            
            // 3. Verifica se os dados estão corrompidos
            const isCorrompido = log.usuario === 'undefined' || !log.usuario;
            
            // Mantém no banco apenas o que NÃO é antigo e NÃO é corrompido
            return !isDadoAntigo && !isCorrompido;
        });
        
        if (logs.length !== logsLimpos.length) {
            localStorage.setItem('embrapac_logs', JSON.stringify(logsLimpos));
        }
    } catch (e) {
        localStorage.setItem('embrapac_logs', JSON.stringify([]));
    }
}

// ==========================================
// --- CONTROLE DE ABAS, PAGINAÇÃO E FILTROS ---
// ==========================================
let limitePaginacao = 15; 
const ITENS_POR_PAGINA = 15;
let logsFiltradosParaExportacao = []; 
let abaAtual = 'alarmes';

function converterDataParaNumero(dataStr) {
    if(!dataStr) return 0;
    
    // Suporte para formato de dados (ISO)
    if (dataStr.includes('T')) {
        const dt = new Date(dataStr);
        return isNaN(dt.getTime()) ? 0 : dt.getTime();
    }
    
    // Mantém o suporte para logs velhos
    const partes = dataStr.split(/[\s,]+/); 
    if(partes.length >= 2) {
        const diaMesAno = partes[0].split('/');
        const horas = partes[1].split(':');
        if(diaMesAno.length === 3 && horas.length >= 2) {
            return new Date(diaMesAno[2], diaMesAno[1] - 1, diaMesAno[0], horas[0], horas[1], horas[2] || 0).getTime();
        }
    }
    return 0;
}

function mudarAba(aba) {
    abaAtual = aba;
    const btnEventos = document.getElementById('tab-eventos');
    const btnAlarmes = document.getElementById('tab-alarmes');
    const tituloTabela = document.getElementById('titulo-tabela');

    if (aba === 'eventos') {
        if(btnEventos) btnEventos.style.opacity = '1';
        if(btnAlarmes) btnAlarmes.style.opacity = '0.4';
        if(tituloTabela) tituloTabela.innerHTML = '<i class="fas fa-clipboard-list"></i> Histórico de Eventos';
    } else {
        if(btnEventos) btnEventos.style.opacity = '0.4';
        if(btnAlarmes) btnAlarmes.style.opacity = '1';
        if(tituloTabela) tituloTabela.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Histórico de Alarmes';
    }
    
    renderizarHistoricoCompleto(true); 
}

function renderizarHistoricoCompleto(resetarLimite = true) {
    const tbody = document.getElementById('tbody-alarmes');
    if (!tbody) return;

    const rawData = localStorage.getItem('embrapac_logs');
    if (!rawData) return;

    let logs = JSON.parse(rawData);
    if (resetarLimite) limitePaginacao = ITENS_POR_PAGINA;

    // 1: Trata espaços e remove acentos do termo digitado ---
    const inputBusca = document.getElementById('search-input');
    const termo = inputBusca ? inputBusca.value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
    const statusFiltro = document.getElementById('filter-status') ? document.getElementById('filter-status').value : 'all';

    // 2. Captura Filtros de Data e Hora de forma INDEPENDENTE
    const dStart = document.getElementById('filter-date-start') ? document.getElementById('filter-date-start').value : '';
    const tStart = document.getElementById('filter-time-start') ? document.getElementById('filter-time-start').value : '';
    const dEnd = document.getElementById('filter-date-end') ? document.getElementById('filter-date-end').value : '';
    const tEnd = document.getElementById('filter-time-end') ? document.getElementById('filter-time-end').value : '';

    // 3. APLICA TODOS OS FILTROS
    logs = logs.filter(log => {
        const tipo = log.tipo ? log.tipo.toUpperCase() : 'INFORME'; 
        const textoEvento = log.evento ? log.evento.toUpperCase() : '';
        
        // A INTELIGÊNCIA DE ABAS
        const ehCicloAlarme = ['FALHA', 'ATIVO', 'RECONHECIDO'].includes(tipo) || 
                              textoEvento.includes('FALHA') || 
                              textoEvento.includes('ALARME') ||
                              (tipo === 'NORMAL' && (textoEvento.includes('RESET') || textoEvento.includes('MANUTENÇÃO')));

        let matchAba = false;
        if (abaAtual === 'alarmes') matchAba = ehCicloAlarme;
        else if (abaAtual === 'eventos') matchAba = !ehCicloAlarme; 

        // Garante que a busca enxergue as palavras que estão na TELA (ex: "Sistema") ---
        let colOrigemBusca = log.usuario || 'Sistema';
        let colDetalheBusca = log.cargo || '--';

        if (ehCicloAlarme) {
            if (['FALHA', 'ATIVO'].includes(tipo) || textoEvento.includes('FALHA') || textoEvento.includes('ALARME')) {
                colOrigemBusca = 'Sistema'; 
                colDetalheBusca = 'Automático';
            }
        }

        // Adiciona o Status (tipo), e remove acentuação para comparar com o termo ---
        const textoGeral = `${log.data || ''} ${log.evento || ''} ${colOrigemBusca} ${colDetalheBusca} ${tipo}`
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        const matchTermo = termo === '' || textoGeral.includes(termo);
        
        // FILTRO DE STATUS
        const matchStatus = statusFiltro === 'all' || tipo === statusFiltro.toUpperCase();
        
        // FILTRO DE DATA E HORA TOTALMENTE INDEPENDENTES
        let matchDate = true;
        if (dStart || dEnd || tStart || tEnd) {
            let logDateObj = null;
            const dataString = log.data || '';
            
            // Processa as datas com precisão absoluta
            if (dataString.includes('T')) {
                logDateObj = new Date(dataString);
            } else {
                const partes = dataString.split(/[\s,]+/);
                if (partes.length >= 2) {
                    const diaMesAno = partes[0].split('/');
                    const horas = partes[1].split(':');
                    if (diaMesAno.length === 3 && horas.length >= 2) {
                        logDateObj = new Date(diaMesAno[2], diaMesAno[1] - 1, diaMesAno[0], horas[0], horas[1]);
                    }
                }
            }

            if (logDateObj && !isNaN(logDateObj.getTime())) {
                const logYear = logDateObj.getFullYear();
                const logMonth = String(logDateObj.getMonth() + 1).padStart(2, '0');
                const logDay = String(logDateObj.getDate()).padStart(2, '0');
                const logHour = String(logDateObj.getHours()).padStart(2, '0');
                const logMin = String(logDateObj.getMinutes()).padStart(2, '0');

                const rowDateISO = `${logYear}-${logMonth}-${logDay}`;
                const rowTime = `${logHour}:${logMin}`;

                // Se informou apenas datas, ignora horas. Se informou apenas horas, ignora datas!
                if (dStart && rowDateISO < dStart) matchDate = false;
                if (dEnd && rowDateISO > dEnd) matchDate = false;
                if (tStart && rowTime < tStart) matchDate = false;
                if (tEnd && rowTime > tEnd) matchDate = false;
            } else {
                matchDate = false; // Ignora logs corrompidos sem data
            }
        }
        
        return matchAba && matchTermo && matchStatus && matchDate;
    }); 
    
    logsFiltradosParaExportacao = logs;
    const logsPaginados = logs.slice(0, limitePaginacao);

    // 4. DESENHA A TABELA COM OS BADGES ORIGINAIS RESTAURADOS
    tbody.innerHTML = '';
    logsPaginados.forEach(l => {
        let badgeClass = 'badge-info';
        const tipo = l.tipo ? l.tipo.toUpperCase() : 'INFORME';

        if (tipo === 'INFORME') badgeClass = 'badge-blue';
        else if (tipo === 'NORMAL') badgeClass = 'badge-norm';
        else if (tipo === 'ALERTA') badgeClass = 'badge-orange';
        else if (tipo === 'FALHA') badgeClass = 'badge-active';
        else if (tipo === 'ATIVO') badgeClass = 'badge-active';
        else if (tipo === 'RECONHECIDO') badgeClass = 'badge-ack';

        const textoEvento = l.evento ? l.evento.toUpperCase() : '';
        const ehCicloAlarme = ['FALHA', 'ATIVO', 'RECONHECIDO'].includes(tipo) || 
                              textoEvento.includes('FALHA') || 
                              textoEvento.includes('ALARME') ||
                              (tipo === 'NORMAL' && (textoEvento.includes('RESET') || textoEvento.includes('MANUTENÇÃO')));

        let colOrigem, colDetalhe;
        const usuarioSeguro = l.usuario || 'Sistema'; 
        const cargoSeguro = l.cargo || '--';

        if (ehCicloAlarme) {
            if (['FALHA', 'ATIVO'].includes(tipo) || textoEvento.includes('FALHA') || textoEvento.includes('ALARME')) {
                colOrigem = 'Sistema'; colDetalhe = 'Automático';
            } else {
                colOrigem = usuarioSeguro; colDetalhe = cargoSeguro;  
            }
        } else {
            colOrigem = usuarioSeguro; colDetalhe = cargoSeguro;
        }

        const tr = document.createElement('tr');
        tr.className = 'table-row';
        tr.innerHTML = `
            <td>${(l.data && l.data.includes('T')) ? new Date(l.data).toLocaleString('pt-BR') : l.data}</td>
            <td style="font-weight: bold;">${l.evento}</td>
            <td>${colOrigem}</td>
            <td>${colDetalhe}</td>
            <td><span class="badge ${badgeClass}">${tipo}</span></td>
        `;
        tbody.appendChild(tr);
    });

    const btnCarregarMais = document.getElementById('btn-carregar-mais');
    if (btnCarregarMais) {
        if (limitePaginacao >= logs.length) btnCarregarMais.style.display = 'none'; 
        else btnCarregarMais.style.display = 'block'; 
    }
}

function carregarMaisLogs() {
    limitePaginacao += ITENS_POR_PAGINA; 
    renderizarHistoricoCompleto(false);  
}

function filtrarTabela() {
    renderizarHistoricoCompleto(true);
}

function limparFiltros() {
    const ids = ['search-input', 'filter-status', 'filter-date-start', 'filter-time-start', 'filter-date-end', 'filter-time-end'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = id === 'filter-status' ? 'all' : '';
    });
    renderizarHistoricoCompleto(true);
}

function exportarDados() {
    const nomeArquivo = abaAtual === 'alarmes' ? 'alarmes_embrapac.csv' : 'eventos_embrapac.csv';
    exportTableToCSV(nomeArquivo);
}

function exportTableToCSV(filename) {
    if (logsFiltradosParaExportacao.length === 0) {
        alert("Não há dados para exportar.");
        return;
    }

    // Mantém o BOM para compatibilidade de acentuação no Excel
    let csvContent = "\uFEFF"; 
    csvContent += "Data/Hora;Descrição do Evento;Usuário;Cargo;Status\r\n"; 
    
    logsFiltradosParaExportacao.forEach(l => {
        // 1. Formata a data igual à tabela visual antes de enviar para o CSV
        let dataFormatada = l.data || '';
        if (dataFormatada.includes('T')) {
            dataFormatada = new Date(dataFormatada).toLocaleString('pt-BR');
        }

        let row = [
            dataFormatada,
            (l.evento || '').replace(/;/g, ",").replace(/\n/g, " "), // Proteção extra contra quebra de linha
            l.usuario || '',
            l.cargo || '',
            l.tipo || 'INFORME' 
        ];
        csvContent += row.join(";") + "\r\n";
    });

    // 2. Método Blob: Seguro para arquivos grandes e não trava o navegador
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Libera a memória alocada pelo objeto URL após o download
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

window.addEventListener('storage', (event) => {
    if (event.key === 'embrapac_logs') {
        if (typeof renderizarHistoricoCompleto === 'function') {
            renderizarHistoricoCompleto(false); 
        }
    }
});