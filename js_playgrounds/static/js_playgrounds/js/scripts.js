document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('changer-btn');
    const container = document.getElementById('display-container');

    if (btn) {
        btn.addEventListener('click', () => {
            fetch('/page-2-content/')
                .then(response => response.text())
                .then(html => {
                    container.innerHTML = html;
                })
                .catch(err => console.error("Error:", err));
        });
    }
});