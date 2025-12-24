Here is a comprehensive technical summary of your application's architecture, functions, and logic, designed for your `README.md`.

### **Technical Documentation: Django Study Hub & Quiz Engine**

This application uses a hybrid architecture: a **Django Backend** acting as a raw SQL API and partial-HTML server, and a **Vanilla JavaScript Frontend** operating as a lightweight Single Page Application (SPA).

---

### **1. Backend Architecture (Python & SQL)**

The core logic bypasses the Django ORM in favor of raw SQL for performance and control.

#### **A. Entry Point: `api_handler` (views.py)**

The central dispatch function located at `/school_core/api/`. It accepts JSON or Multipart/Form-Data (for images).

* **Mechanism:** It parses the request, extracts the `action` string, and routes the data to specific handler functions in `logic.py`.
* **Decorator:** `@csrf_exempt` is used to simplify external/JS POST requests.

#### **B. Logic & SQL Handlers (logic.py)**

The application logic is segmented into four distinct domains.

**1. Hub Logic (`handle_hub`)**
Manages the top-level "Courses" (Subjects).

* **`get_courses`**: Executes `SELECT id, name FROM school_course`. Returns a list of courses.
* **`add_course`**: Executes `INSERT INTO school_course`.
* **`delete_course`**: Executes `DELETE FROM school_course WHERE id = %s`. Relying on `ON DELETE CASCADE` in the DB schema to clean up child chapters/notes.

**2. Course Logic (`handle_course`)**
Manages "Chapters" within a course.

* **`get_chapters`**: Fetches chapters for a specific course, ordered by `chapter_index`.
* **`add_chapter`**: Inserts a new chapter with a user-defined sort index.
* **`delete_chapter`**: Deletes a specific chapter.

**3. Note Logic (`handle_note`)**
Manages the Study Cards (Notes) containing headers (questions) and bodies (answers).

* **`get_notes`**: Selects all notes for a specific chapter, including their current `weight`.
* **`add_note`**:
* **Text Mode:** Inserts raw text into the `body` column.
* **Image Mode:** Detects `request.FILES['image_file']`. Saves the file to `media/` using `default_storage`. Stores a reference string `IMG:/media/<filename>` in the DB `body` column.
* **Defaults:** Sets initial `weight` to `10`.


* **`delete_note`**: Removes a specific note.

**4. Quiz Logic (`handle_quiz`) - The Spaced Repetition Engine**

* **`init_quiz`**:
* **Input:** List of `chapter_ids`.
* **SQL:** `SELECT id, weight FROM school_note WHERE chapter_id IN (...)`.
* **Optimization:** Fetches *only* IDs and weights (metadata), avoiding heavy text/image payloads to ensure instant start times.


* **`get_content`**:
* **Input:** `note_id` (selected by the client).
* **SQL:** `SELECT header, body ...`
* **Role:** Just-in-Time (JIT) fetching of the actual question/answer content.


* **`submit_answer`**:
* **Input:** `note_id`, `is_correct` (boolean).
* **Algorithm (SQL Side):**
* **If Correct:** `UPDATE ... SET weight = MAX(2.23e-308, weight / 2.0)`. Halves the probability of seeing this card again.
* **If Wrong:** `UPDATE ... SET wrong_count = wrong_count + 1`. Keeps weight high (or implicitly increases relative probability).





---

### **2. Frontend Architecture (JavaScript)**

The frontend (`app.js`) mimics a reactive framework using vanilla JS.

#### **A. State Management**

Global variables track the user's navigation depth to minimize API calls and manage context:

* `currentCourseId` / `currentChapterId`: Tracks active navigation.
* `quizDeck`: A local array of `{id, weight}` objects used for the client-side quiz algorithm.

#### **B. The "Router" & Partial Loading**

The `router(viewName)` function replaces a full page reload.

1. **Fetch:** Calls `/school_core/partial/<viewName>/` to get an HTML fragment (e.g., `quiz.html`).
2. **Inject:** Inserts the HTML into the main `#content-slot` div.
3. **Hydrate:** Triggers specific data loaders (e.g., `loadNotes()` if entering a chapter).

#### **C. Client-Side Quiz Algorithm**

Unlike many apps where the server picks the question, here the **Client** picks the next question to reduce latency.

1. **Selection (`nextQuestion`)**:
* Iterates through the local `quizDeck`.
* Calculates `score = note.weight * Math.random()`.
* Selects the note with the highest score (Weighted Random Selection).


2. **Render**: Calls API `get_content` for the winner's text.
3. **Feedback**:
* User clicks "I got it" -> Local weight is halved immediately for the session.
* Background API call (`submit_answer`) syncs the new weight to the DB permanent storage.



---

### **3. Views & Templates**

#### **Views (`views.py`)**

* **`school_core`**: Renders the main shell (`index.html`).
* **`get_partial`**: A dynamic view that serves HTML fragments from the `partials/` directory based on the filename argument.

#### **Templates Structure**

* **`index.html`**: The skeleton containing the `<div id="content-slot">` and script references.
* **Partials (`hub.html`, `course.html`, `chapter.html`, `quiz.html`)**:
* These contain **no** `<html>` or `<body>` tags.
* They contain specific UI elements (buttons, inputs) and event listeners (e.g., `onclick="addNote()"`).
* **`chapter.html`**: specifically contains the Drag & Drop zone logic for image uploads.



---

### **4. Database Schema (Implied)**

Based on the raw SQL in `logic.py`, the database requires the following structure:

| Table | Columns | Purpose |
| --- | --- | --- |
| **`school_course`** | `id` (PK), `name` | Top-level subject container. |
| **`school_chapter`** | `id` (PK), `course_id` (FK), `name`, `chapter_index` | Sub-sections, ordered by user index. |
| **`school_note`** | `id` (PK), `chapter_id` (FK), `header`, `body`, `weight`, `correct_count`, `wrong_count` | The flashcards. `body` stores text or `IMG:...` ref. |

---

### **5. Styles (CSS)**

* **Mobile-First Design:** The `#app-container` has a `max-width: 600px` to simulate a mobile app interface even on desktop screens.
* **UI Components:** Custom classes for "Toggle Switches" (Text vs Image mode) and a dashed "Drop Zone" for file uploads.
