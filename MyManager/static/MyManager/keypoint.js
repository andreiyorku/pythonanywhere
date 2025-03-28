console.log("📌 keypoint.js loaded");


function getCSRFToken() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'csrftoken') return value;
    }
    return '';
}

function submitAnswer(answerType, keyPointId) {
	console.log("🎯 Inside submitAnswer()", answerType, keyPointId);  // ✅ debug here
	
	
	const formData = new FormData();
	formData.append("key_point_number", keyPointId || 0);
	formData.append("answer", answerType || "filter_applied");


	formData.append("weight_mode", filterManager.filters.weight_mode);
	filterManager.filters.selected_chapters.forEach(ch => {
		formData.append("selected_chapters[]", ch);
	});

	fetch("/MyManager/api/random_keypoint/", {
		method: "POST",
		headers: { "X-CSRFToken": getCSRFToken() },
		body: formData
	})
	.then(response => response.json())
	.then(data => {
		console.log("🧱 Keypoint HTML received:", data.html);
        document.querySelector(".dashboard-content-box").innerHTML = data.html;

		const box = document.querySelector(".dashboard-content-box");
		if (box) {
			box.innerHTML = data.html;
			console.log("✅ Injected into .dashboard-content-box");
		} else {
			console.warn("❗ .dashboard-content-box not found in DOM");
		}
	});

	
	
}

document.addEventListener("click", function (e) {
    if (e.target.classList.contains("show-answer-button")) {
        const box = e.target.closest(".keypoint-box");
        if (box) {
            // Reveal body and answer buttons
            box.querySelector(".keypoint-body").style.display = "block";
            e.target.remove(); // Remove the "Show Answer" button
        }
    }

    if (e.target.classList.contains("answer-button")) {
        const type = e.target.getAttribute("data-answer");
        const kpId = parseInt(e.target.getAttribute("data-kp"));
        console.log("🖱️ Answer button clicked:", type, "for keypoint ID:", kpId);
        submitAnswer(type, kpId);
    }
});


