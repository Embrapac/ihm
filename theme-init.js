(function() {
    try {
        let roleId = sessionStorage.getItem('embrapac_active_role');
        let cargo = 'visitante';
        
        const sessoesStr = localStorage.getItem('embrapac_sessions');
        const sessoes = sessoesStr ? JSON.parse(sessoesStr) : {};        
       
        const isDeslogada = sessionStorage.getItem('embrapac_aba_deslogada') === 'true';       
   
        if (!roleId && !isDeslogada) {
            const pathname = window.location.pathname;
            if (pathname.includes('Tela_1_operador')) {
                if (sessoes['operador']) roleId = 'operador';
                else if (sessoes['admin']) roleId = 'admin';
            } else if (pathname.includes('Tela_3_supervisor')) {
                if (sessoes['admin']) roleId = 'admin';
            } else {
                roleId = localStorage.getItem('embrapac_last_role');
            }
        }

        if (roleId && sessoes[roleId]) {
            cargo = sessoes[roleId].cargo;
        }

        const key = 'embrapac_theme_' + cargo;
        const savedTheme = localStorage.getItem(key) || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    } catch (e) { 
        console.error("Erro ao aplicar tema prévio:", e); 
    }
})();