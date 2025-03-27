let filterOptions = {
    weight_mode: "early",
    selected_chapters: []
};

function toggleFilterPopup() {
    const popup = document.getElementById("filterPopup");
    popup.style.display = popup.style.display === "none" ? "block" : "none";
}

function applyFilters() {
    const selectedMode = document.getElementById("weightMode").value;
    const chapterCheckboxes = document.querySelectorAll("#chapterCheckboxes input:checked");
    const selectedChapters = Array.from(chapterCheckboxes).map(cb => parseInt(cb.value));

    const courseCheckboxes = document.querySelectorAll("#courseCheckboxes input:checked");
    const selectedCourses = Array.from(courseCheckboxes).map(cb => cb.value);

    filterOptions.weight_mode = selectedMode;
    filterOptions.selected_chapters = selectedChapters;
    filterOptions.selected_courses = selectedCourses;

    // ✅ Send filter to backend for saving
    const saveData = new FormData();
    filterOptions.selected_chapters.forEach(ch => saveData.append("selected_chapters[]", ch));
    filterOptions.selected_courses.forEach(c => saveData.append("selected_courses[]", c));
    saveData.append("weight_mode", filterOptions.weight_mode);

    fetch("/MyManager/api/save_filters/", {
        method: "POST",
        headers: { 'X-CSRFToken': getCSRFToken() },
        body: saveData
    });

    toggleFilterPopup();
    submitAnswer("filter_only", 0);  // Trigger a new keypoint
}


function submitAnswer(type, keyPointId) {
    const formData = new FormData();
    formData.append("key_point_number", keyPointId);
    formData.append("answer", type);

    // Send filter options with every request
    formData.append("weight_mode", filterOptions.weight_mode);
    filterOptions.selected_chapters.forEach(chap => {
        formData.append("selected_chapters", chap);
    });

    fetch("/MyManager/api/random_keypoint/", {
        method: "POST",
        headers: { 'X-CSRFToken': getCSRFToken() },
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        document.querySelector(".dashboard-content-box").innerHTML = data.html;
    });
}

function getCSRFToken() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'csrftoken') return value;
    }
}

function loadFilterOptions() {
    fetch("/MyManager/api/filter_options/")
        .then(response => response.json())
        .then(data => {
            // Courses
            const courseContainer = document.getElementById("courseCheckboxes");
            courseContainer.innerHTML = "";
            data.courses.forEach(course => {
                const checkbox = document.createElement("label");
                checkbox.innerHTML = `<input type="checkbox" value="${course}" onchange="updateChapters()"> ${course}`;
                courseContainer.appendChild(checkbox);
                courseContainer.appendChild(document.createElement("br"));
            });

            // Initial chapter load (empty or all)
            updateChapters();
        })
        .catch(() => {
            document.getElementById("chapterCheckboxes").innerHTML = "<p style='color:red'>Failed to load options.</p>";
        });
}

function updateChapters() {
    const selectedCourses = Array.from(document.querySelectorAll("#courseCheckboxes input:checked"))
        .map(cb => cb.value);

    const params = new URLSearchParams();
    selectedCourses.forEach(c => params.append("courses[]", c));

    fetch(`/MyManager/api/chapters_by_course/?${params.toString()}`)
        .then(response => response.json())
        .then(data => {
            const chapterContainer = document.getElementById("chapterCheckboxes");
            chapterContainer.innerHTML = "";
            data.chapters.forEach(ch => {
                const checkbox = document.createElement("label");
                checkbox.innerHTML = `<input type="checkbox" value="${ch}"> Chapter ${ch}`;
                chapterContainer.appendChild(checkbox);
                chapterContainer.appendChild(document.createElement("br"));
            });
        });
}

document.addEventListener("DOMContentLoaded", () => {
    loadFilterOptions();

    if (savedFilters?.selected_chapters?.length > 0) {
        filterOptions = savedFilters;
        applyFilters();
    } else {
        document.getElementById("filterPopup").style.display = "block";
    }
});

document.addEventListener("click", function (e) {
    if (e.target.classList.contains("answer-button")) {
        const type = e.target.getAttribute("data-answer");
        const kpId = parseInt(e.target.getAttribute("data-kp"));
        submitAnswer(type, kpId);
    }
});
