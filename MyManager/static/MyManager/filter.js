console.log("📦 filter.js loaded");

const filterManager = {
    filters: {
        selected_courses: [],
        selected_chapters: [],
        weight_mode: "early"
    },

    init() {
        console.log("🧪 filterManager.init() running...");

        fetch("/MyManager/api/filter_options/")
            .then(response => response.json())
            .then(data => {
                const { courses, saved_filters } = data;

                this.filters = {
                    selected_courses: saved_filters.selected_courses || [],
                    selected_chapters: (saved_filters.selected_chapters || []).map(Number),
                    weight_mode: saved_filters.weight_mode || "early"
                };

                console.log("✅ Loaded filters:", this.filters);

                const hasValidFilters =
                    this.filters.selected_courses.length > 0 &&
                    this.filters.selected_chapters.length > 0;

                if (hasValidFilters) {
					console.log("✅ Filters valid, applying immediately on load...");
					setTimeout(() => this.applyFilters(true), 100);  // slight delay to ensure DOM readiness
				} else {
                    console.log("❌ Filters missing or incomplete, showing popup...");
                    this.show();
                }

                this.renderCourses(courses);
            })
            .catch(err => {
                console.warn("⚠️ Failed to load filters:", err);
                this.show();
            });
    },

    renderCourses(courses) {
        const container = document.getElementById("courseCheckboxes");
        container.innerHTML = "";

        courses.forEach(course => {
            const isChecked = this.filters.selected_courses.includes(course);
            const label = document.createElement("label");
            label.innerHTML = `<input type="checkbox" value="${course}" ${isChecked ? 'checked' : ''} onchange="filterManager.loadChapters()"> ${course}`;
            container.appendChild(label);
            container.appendChild(document.createElement("br"));
        });

        this.loadChapters();
    },

    loadChapters() {
        const selectedCourses = Array.from(document.querySelectorAll("#courseCheckboxes input:checked"))
            .map(cb => cb.value);

        this.filters.selected_courses = selectedCourses;

        const params = new URLSearchParams();
        selectedCourses.forEach(c => params.append("courses[]", c));

        fetch(`/MyManager/api/chapters_by_course/?${params.toString()}`)
            .then(response => response.json())
            .then(data => {
                const container = document.getElementById("chapterContainer");
                container.innerHTML = "";

                const chapterGroups = data.chapters_by_course;
                const groupWrapper = document.createElement("div");
                groupWrapper.style.display = "flex";
                groupWrapper.style.gap = "30px";

                for (const course in chapterGroups) {
                    const box = document.createElement("div");
                    box.classList.add("chapter-section");

                    const title = document.createElement("h4");
                    title.textContent = course;
                    box.appendChild(title);

                    chapterGroups[course].forEach(ch => {
                        const isChecked = this.filters.selected_chapters.includes(parseInt(ch));
                        const label = document.createElement("label");
                        label.innerHTML = `<input type="checkbox" value="${ch}" ${isChecked ? 'checked' : ''}> Chapter ${ch}`;
                        box.appendChild(label);
                        box.appendChild(document.createElement("br"));
                    });

                    groupWrapper.appendChild(box);
                }

                container.appendChild(groupWrapper);

                document.getElementById("weightMode").value = this.filters.weight_mode || "early";
            });
    },

    saveFilters() {
        const selectedChapters = Array.from(document.querySelectorAll("#chapterContainer input:checked"))
            .map(cb => parseInt(cb.value));
        const selectedMode = document.getElementById("weightMode").value;

        this.filters.selected_chapters = selectedChapters;
        this.filters.weight_mode = selectedMode;

        const formData = new FormData();
        this.filters.selected_courses.forEach(c => formData.append("selected_courses[]", c));
        this.filters.selected_chapters.forEach(ch => formData.append("selected_chapters[]", ch));
        formData.append("weight_mode", selectedMode);

        fetch("/MyManager/api/save_filters/", {
            method: "POST",
            headers: { 'X-CSRFToken': getCSRFToken() },
            body: formData
        });
    },

    applyFilters(skipSave = false) {
        console.log("📤 applyFilters called (skipSave:", skipSave, ")");
        if (!skipSave) this.saveFilters();
        this.hide();

        if (typeof this._submitAnswer === "function") {
            this._submitAnswer("filter_applied", 0);
        } else {
            console.warn("⚠️ No submitAnswer registered");
        }
    },

    show() {
        console.warn("📣 filterManager.show() CALLED!");
        document.getElementById("filterPopup").style.display = "block";
    },

    hide() {
        document.getElementById("filterPopup").style.display = "none";
    },

    setSubmitHandler(fn) {
        this._submitAnswer = fn;
        console.log("✅ submitAnswer registered");

        if (this._deferredApply) {
            console.log("🚀 deferred apply triggered");
            this.applyFilters(true);
            this._deferredApply = false;
        }
    },
};

// CSRF
function getCSRFToken() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'csrftoken') return value;
    }
    return '';
}

// ✅ Register after DOM + keypoint.js fully loaded
document.addEventListener("DOMContentLoaded", () => {
    const retry = setInterval(() => {
        if (typeof filterManager !== "undefined" && typeof submitAnswer === "function") {
            console.log("🔗 Found submitAnswer — registering...");
            filterManager.setSubmitHandler(submitAnswer);
            filterManager.init();
            clearInterval(retry);
        }
    }, 100);
});
