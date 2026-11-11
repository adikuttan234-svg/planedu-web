// planEDU Shared Theme Engine
(function () {
    function getTheme() {
        return localStorage.getItem('theme') || 'light';
    }

    function updateIcons(theme) {
        document.querySelectorAll('#theme-toggle i, .theme-toggle-btn i').forEach(function (icon) {
            icon.className = theme === 'dark' ? 'ri-sun-line' : 'ri-moon-line';
        });
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        updateIcons(theme);
    }

    window.toggleTheme = function () {
        var current = getTheme();
        var next = current === 'dark' ? 'light' : 'dark';
        try {
            localStorage.setItem('theme', next);
        } catch (e) { }
        applyTheme(next);
    };

    // Apply theme immediately
    applyTheme(getTheme());

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            applyTheme(getTheme());
        });
    } else {
        applyTheme(getTheme());
    }
})();
