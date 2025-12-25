<div align="center">

# 🎓 School Core
### A Personalized Learning System with Spaced Repetition

<img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" />
<img src="https://img.shields.io/badge/Django-5.0-092E20?style=for-the-badge&logo=django&logoColor=white" />
<img src="https://img.shields.io/badge/SQLite-Raw_SQL-003B57?style=for-the-badge&logo=sqlite&logoColor=white" />
<img src="https://img.shields.io/badge/Frontend-Vanilla_JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />

<br/><br/>

**School Core** is a dynamic Single-Page Application (SPA) designed to revolutionize how you study. It combines a robust **Multi-User Permission System** with an intelligent **Infinite Quiz Engine** that adapts to your learning progress using weighted probabilities.



</div>

---

## 🚀 Key Features

| Feature | Description |
| :--- | :--- |
| **🧠 Smart Quiz Engine** | Uses a **weighted probability algorithm**. Questions you miss appear more often (1.5x weight), while questions you get right fade away (0.5x weight). |
| **👥 Multi-User System** | Users can register, log in, and manage their own private content. **Admins** have global oversight. |
| **🔒 Granular Permissions** | • **Admins:** Can delete any content.<br>• **Owners:** Can delete their own content.<br>• **Public:** Everyone can learn from shared courses. |
| **⚡ Single Page App** | Built with Vanilla JavaScript, the app feels instant. No page reloads when navigating between Hub, Courses, and Quizzes. |
| **📸 Rich Media Support** | Upload images directly to your notes via **Paste** or **Drag-and-Drop**. |

---

## 📂 Backend Documentation
The backend bypasses the Django ORM for **Raw SQL** performance, giving us fine-grained control over the complex weighting logic.

### 🛠️ Core Logic (`school_core/logic.py`)
<details>
<summary><b>Click to expand detailed function reference</b></summary>
<br>

| Function | Description |
| :--- | :--- |
| **`handle_auth`** | • **Login/Register:** Hashes passwords using Django's `make_password`.<br>• **Session:** Stores `user_id` in `request.session`.<br>• **`get_current_user`:** Returns `{id, username, is_admin}`. |
| **`handle_hub`** | • **Get:** Fetches all courses with `owner_id`.<br>• **Add:** Creates a course linked to the logged-in user.<br>• **Delete:** Checks if `user_id == owner_id` OR `is_admin` before deleting. |
| **`handle_course`** | • Manages Chapters. Returns them sorted by `chapter_index`.<br>• Enforces ownership checks for deletion. |
| **`handle_note`** | • **Smart Fetch:** Uses a **LEFT JOIN** to merge Global Notes with the User's Personal Progress (`school_progress` table).<br>• **Images:** UUID-renames uploaded files and saves them to `/media/`. |
| **`handle_quiz`** | • **`init_quiz`:** Generates a lightweight "Deck" of IDs and Weights.<br>• **`submit_answer`:** Updates the user's personal weight in the `school_progress` table (Halves on success, increases 1.5x on failure). |

</details>

### 🔌 API Gateway (`school_core/views.py`)
<details>
<summary><b>Click to expand API details</b></summary>
<br>

This file acts as the bridge between the Frontend and the Logic layer.

* **`api_handler(request)`**: The single entry point for all JSON requests.
    * **Crucial:** It injects the `request` object into every logic function (e.g., `logic.handle_note(..., request)`), ensuring the logic layer always knows *who* is making the request.
    * Handles both `application/json` and `multipart/form-data` (for images).
* **`get_partial(request)`**: Serves raw HTML templates to the Javascript Router.

</details>

### 🔗 Routing (`school_core/urls.py`)
Maps the essential endpoints:
* `path('api/', ...)` → **The JSON API**
* `path('partial/<str:filename>/', ...)` → **HTML Fragment Loader**
* `path('', ...)` → **SPA Entry Point**

---

## 🎨 Frontend Documentation
A dependency-free JavaScript application located in `static/school_core/`.

### 🧠 Application Logic (`js/app.js`)
<details>
<summary><b>Click to expand JavaScript modules</b></summary>
<br>

#### 1. Router Engine
* **`router(viewName)`**: Dynamically fetches HTML from `/partial/` and injects it into the DOM.
* **Lazy Loading**: Only loads data (Courses, Chapters) when the view is actually requested.

#### 2. Authentication Module
* **`checkLogin()`**: Runs on app start. If not logged in, redirects to the Auth screen.
* **`currentUserIsAdmin`**: A global state flag that dynamically shows/hides "Delete" buttons in the UI.

#### 3. Quiz Client
* **`nextQuestion()`**: The heart of the app. It uses a **Weighted Random Selector** to pick the next card from the local deck.
* **Optimistic UI**: It updates the weight *locally* immediately after you answer, while syncing with the server in the background for a lag-free experience.

#### 4. Image Handler
* **`attachImageHandlers()`**: Adds listeners for `paste` and `drop` events, allowing seamless image uploading.

</details>

### 📄 Templates (`templates/partials/`)
We use **HTML5 `<template>` tags** for efficient cloning.

| Template | Usage |
| :--- | :--- |
| **`auth.html`** | A unified Login / Register card that toggles modes instantly. |
| **`hub.html`** | The main dashboard. Contains the `<template id="course-template">`. |
| **`course.html`** | Lists chapters. Features a "Select All" checkbox for mass-quizzing. |
| **`chapter.html`** | The note editor. Contains the Drag-and-Drop dropzone. |
| **`quiz.html`** | The Flashcard interface with "Show Answer" and Feedback buttons. |

---

## 🗄️ Database Schema

The system uses a **Hybrid Ownership Model** stored in SQLite:

| Table | Description |
| :--- | :--- |
| **`school_user`** | `id`, `username`, `password` (Hashed) |
| **`school_course`** | Content hierarchy. Includes `owner_id` to track the creator. |
| **`school_note`** | Stores the **Base Weight** (Default difficulty: 10.0). |
| **`school_progress`** | **The Magic Table.** Links `user_id` + `note_id`. Stores the *Personalized Weight* for that specific user. |

---

<div align="center">
    <sub>Built with ❤️ using Django & Vanilla JS</sub>
</div>
