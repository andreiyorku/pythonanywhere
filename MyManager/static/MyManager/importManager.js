console.log("ðŸ“¥ importManager.js loaded");

const importManager = {
	init() {
		console.log("ðŸ“¥ Initializing importManager...");
		this.bindEvents();
	},

	bindEvents() {
		document.getElementById("contentSelector").addEventListener("change", (e) =>
			this.handleContentChange(e)
		);
		document.getElementById("importSubmitButton")?.addEventListener("click", () =>
			this.submit()
		);
	},

	handleContentChange(e) {
		const selected = e.target.value;
		const contextContainer = document.getElementById("contentContextContainer");
		const courseContainer = document.getElementById("courseSelectorContainer");
		const chapterContainer = document.getElementById("chapterSelectorContainer");

		contextContainer.innerHTML = "";
		courseContainer.innerHTML = "";
		chapterContainer.innerHTML = "";

		if (selected === "school") {
			// No extra UI needed for school, just fetch its courses directly
			this.loadCourses("school");
		} else if (selected === "existing_project") {
			contextContainer.innerHTML = `
				<label>Select Project:</label>
				<select id="projectSelector"></select>
			`;
			this.fetchProjects();
		} else if (selected === "new_project") {
			contextContainer.innerHTML = `
				<label>New Project Name:</label>
				<input type="text" id="newProjectInput" placeholder="Enter project name..." />
			`;
			this.renderCourseAndChapterInputs(); // New project: show both
		}
	},

	fetchProjects() {
		fetch("/MyManager/api/import/fetch_contexts/")
			.then(res => res.json())
			.then(data => {
				const projectSelector = document.getElementById("projectSelector");
				data.projects.forEach(p => {
					const opt = document.createElement("option");
					opt.value = p;
					opt.textContent = p;
					projectSelector.appendChild(opt);
				});
				projectSelector.addEventListener("change", () => {
					this.loadCourses(projectSelector.value);
				});
			});
	},

	loadCourses(context) {
	fetch(`/MyManager/api/import/get_courses/?project=${encodeURIComponent(context)}`)
		.then(res => res.json())
		.then(data => {
			const container = document.getElementById("courseSelectorContainer");

			// Build HTML: existing courses first, then "New Course"
			container.innerHTML = `
				<label>Select Course:</label>
				<select id="courseSelector">
					${data.courses.map(c => `<option value="${c}">${c}</option>`).join("")}
					<option value="new">New Course</option>
				</select>
				<input type="text" id="newCourseInput" placeholder="New course name..." style="display:none" />
			`;

			// Add change listener to dropdown
			const courseSelector = document.getElementById("courseSelector");
			const newCourseInput = document.getElementById("newCourseInput");

			courseSelector.addEventListener("change", (e) => {
				const isNew = e.target.value === "new";  // check if "New Course" is selected
				newCourseInput.style.display = isNew ? "block" : "none";  // toggle textbox

				if (isNew) {
					importManager.renderChapterInput();  // if new course, show blank chapter input
				} else {
					importManager.loadChapters(e.target.value);  // if existing, load chapters
				}
			});

			// Trigger change manually so correct state loads by default (especially when no courses exist)
			courseSelector.dispatchEvent(new Event("change"));
		});
    }

	
	loadChapters(courseName) {
		fetch(`/MyManager/api/import/get_chapters/?course=${encodeURIComponent(courseName)}`)
			.then(res => res.json())
			.then(data => {
				const container = document.getElementById("chapterSelectorContainer");

				// âœ… Sort chapters naturally based on numeric suffix
				const sortedChapters = data.chapters.sort((a, b) => {
					const aMatch = a.title.match(/\d+/);
					const bMatch = b.title.match(/\d+/);
					const aNum = aMatch ? parseInt(aMatch[0]) : 0;
					const bNum = bMatch ? parseInt(bMatch[0]) : 0;
					return aNum - bNum;
				});

				container.innerHTML = `
					<label>Select Chapter:</label>
					<select id="chapterSelector">
						${sortedChapters.map(ch => `<option value="${ch.title}">${ch.title}</option>`).join("")}
						<option value="new">âž• New Chapter</option>
					</select>
					<input type="text" id="newChapterInput" placeholder="New chapter name..." style="display:none" />
				`;

				document.getElementById("chapterSelector").addEventListener("change", (e) => {
					const isNew = e.target.value === "new";
					document.getElementById("newChapterInput").style.display = isNew ? "block" : "none";
				});
			});
	},

	renderCourseAndChapterInputs() {
		document.getElementById("courseSelectorContainer").innerHTML = `
			<label>New Course Name:</label>
			<input type="text" id="newCourseInput" placeholder="Enter course name..." />
		`;
		this.renderChapterInput();
	},

	renderChapterInput() {
		document.getElementById("chapterSelectorContainer").innerHTML = `
			<label>New Chapter Name:</label>
			<input type="text" id="newChapterInput" placeholder="Enter chapter name..." />
		`;
	},

	submit() {
		const ctx = document.getElementById("contentSelector").value;
		const bulkHTML = document.getElementById("bulkContentInput").value;

		let project = "";
		if (ctx === "existing_project") {
			project = document.getElementById("projectSelector")?.value;
		} else if (ctx === "new_project") {
			project = document.getElementById("newProjectInput")?.value;
		} else if (ctx === "school") {
			project = "SCHOOL_CONTEXT";  // âœ… Dummy placeholder to satisfy backend
		}


		let course = document.getElementById("courseSelector")?.value;
		if (course === "new" || !course) {
			course = document.getElementById("newCourseInput")?.value;
		}

		let chapterSelector = document.getElementById("chapterSelector")?.value;
		let chapter = chapterSelector === "new"
			? document.getElementById("newChapterInput")?.value
			: chapterSelector;


		const formData = new FormData();
		formData.append("project_name", project);
		formData.append("course_name", course);
		formData.append("chapter_name", chapter);
		formData.append("bulk_html", bulkHTML);

		fetch("/MyManager/api/import/bulk_submit/", {
			method: "POST",
			headers: { "X-CSRFToken": getCSRFToken() },
			body: formData
		})
		.then(async res => {
			const data = await res.json();
			if (res.ok) {
				document.getElementById("importStatus").innerText = data.message || "âœ… Imported!";
			} else {
				document.getElementById("importStatus").innerText = `âŒ Error: ${data.error || "Unknown error"}`;
				console.error("âŒ Import error:", data);
			}
		})
		.catch(err => {
			console.error("âŒ Network or server error:", err);
			document.getElementById("importStatus").innerText = "âŒ Import failed (network/server error)";
		});
	}

};

function getCSRFToken() {
	const cookie = document.cookie.split(";").find(c => c.trim().startsWith("csrftoken="));
	return cookie ? cookie.split("=")[1] : "";
}

document.addEventListener("DOMContentLoaded", () => {
	importManager.init();
});

