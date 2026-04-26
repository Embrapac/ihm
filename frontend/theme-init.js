(function() {
    try {
        let cargo = 'visitante';
        const userStr = sessionStorage.getItem('embrapac_user');
        
        if (userStr) {
            const user = JSON.parse(userStr);
            cargo = user.cargo;
        }

        const key = 'embrapac_theme_' + cargo;
        const savedTheme = localStorage.getItem(key) || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    } catch (e) { 
        console.error("Erro ao aplicar tema prévio:", e); 
    }
})();