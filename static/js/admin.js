/**
 * Rezsi Figyelo - Admin Frontend JS
 */

// Mobile sidebar toggle
document.addEventListener('DOMContentLoaded', function() {
    // Add mobile menu button if on mobile
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.admin-sidebar');
        if (sidebar) {
            const toggleBtn = document.createElement('button');
            toggleBtn.innerHTML = '&#9776;';
            toggleBtn.className = 'mobile-menu-btn';
            toggleBtn.style.cssText = 'position:fixed;top:0.5rem;left:0.5rem;z-index:101;background:var(--primary);color:white;border:none;padding:0.5rem 0.75rem;border-radius:8px;font-size:1.25rem;cursor:pointer;';
            document.body.appendChild(toggleBtn);

            toggleBtn.addEventListener('click', function() {
                sidebar.classList.toggle('open');
            });

            // Close sidebar when clicking outside
            document.addEventListener('click', function(e) {
                if (!sidebar.contains(e.target) && e.target !== toggleBtn) {
                    sidebar.classList.remove('open');
                }
            });
        }
    }
});

// Format numbers with Hungarian locale
function formatHuf(num) {
    return new Intl.NumberFormat('hu-HU').format(Math.round(num)) + ' Ft';
}
