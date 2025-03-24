console.log("menu.js loaded");

// ✅ Fetch only the courses and load into the accordion submenu
function loadCoursesIntoAccordion() {
    console.log("Fetching courses...");
    fetch('/MyManager/api/courses_menu/')  // <-- Adjust this if your courses API is different
        .then(response => response.json())
        .then(data => {
            console.log("Courses data:", data);
            const submenu = document.getElementById('accordion-submenu');
            submenu.innerHTML = '';
            data.forEach(course => {
                submenu.innerHTML += `<li><a href="${course.url}">${course.title}</a></li>`;
            });
        })
        .catch(error => console.error('Error loading courses:', error));
}

// ✅ Toggle accordion open/close
function toggleAccordion() {
    const submenu = document.getElementById('accordion-submenu');
    submenu.style.display = submenu.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    loadCoursesIntoAccordion();              // ✅ Initial load of courses
    setInterval(loadCoursesIntoAccordion, 5000);  // Optional: Refresh every 5 sec
});
