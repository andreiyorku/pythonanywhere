🎓 School Core - Personalized Learning System

School Core is a dynamic, single-page application (SPA) designed for personalized learning. It allows users to create courses, chapters, and notes, while an intelligent "Infinite Quiz" engine adapts to their learning progress using a weighted probability algorithm.


🚀 Key Features

Multi-User Architecture: Secure Login/Register system where users manage their own content.
Smart Quiz Engine: Uses a Spaced Repetition inspired algorithm. Questions you answer correctly appear less often (lower weight), while difficult questions appear more frequently.
Granular Permissions:
Admins: Can delete any content and view all data.
Users: Can only delete content they created.
Public Read Access: All users can view and learn from all shared courses.
Rich Media Notes: Support for text and image uploads (via paste or drag-and-drop).
Single Page Application: Fast, fluid navigation without page reloads, built with vanilla JavaScript and Django.


📂 Backend Documentation (school_core/)

The backend is built on Django but bypasses standard ORM models for high-performance Raw SQL queries to handle the complex weighting logic efficiently.

1. Logic Layer (logic.py)
This file contains the core business rules and direct database interactions.
handle_auth(action, data, request)
Manages Session-based Authentication.
Handles login, register (with password hashing), and logout.
get_current_user: Returns the user's ID, Username, and Admin status.
handle_hub(action, data, request)
Get: Fetches all available Courses.
Add: Creates a new Course and assigns ownership to the creator.
Delete: Enforces security—only Admins or the Course Owner can delete.
handle_course(action, data, request)
Manages Chapters within a Course.
Ensures Chapters are returned in the correct index order.
handle_note(action, data, files, request)
Smart Fetching: Uses a SQL LEFT JOIN to merge the Global Note Data with the User's Personal Progress.
Image Handling: Saves uploaded images to the media directory and stores the reference path.
handle_quiz(action, data, request)
init_quiz: Returns a lightweight "Deck" of Question IDs and Weights. It prioritizes the user's personal history (school_progress table) over default values.
submit_answer: Updates the user's personal weight for a question.
Correct: Weight is halved (appears less).
Wrong: Weight is increased by 1.5x (appears more).

2. API Gateway (views.py)
Acts as the bridge between the Frontend and the Logic Layer.
api_handler(request): A single endpoint (/api/) that routes all JSON requests to the appropriate function in logic.py. It injects the request object into every call to ensure Session Security.
get_partial(request, filename): Securely serves HTML fragments (templates) to the frontend router.
school_core(request): Renders the main entry point (index.html).

3. URL Routing (urls.py)
Maps the essential endpoints:
path('', ...): Loads the App.
path('api/', ...): The JSON API Gateway.
path('partial/<str:filename>/', ...): The HTML Fragment loader.


🎨 Frontend Documentation (static/)

The frontend is a lightweight, dependency-free JavaScript application that handles routing, state, and UI rendering.

1. Application Logic (app.js)
Router Engine (router(viewName)):
Dynamically fetches HTML fragments from the server.
Injects them into the main container (#content-slot).
Triggers specific initialization logic (e.g., loadCourses, startQuiz) based on the view.
State Management:
Maintains global state for currentUser, isAdmin, currentCourseId, and the active quizDeck.
Authentication:
checkLogin(): Verifies session status on load. Redirects to Auth or Hub.
Hides "Delete" buttons dynamically if the user is not the Owner or Admin.
Quiz Client:
Weighted Random Selector: Picks the next question based on the weights in the local deck.
Optimistic UI: Updates weights locally for instant feedback while syncing with the server in the background.

2. Styling (styles.css)
Contains modular styles for the card-based layout, interactive buttons, and the quiz interface.
Implements the "Hidden/Visible" utility classes for the SPA navigation.


📄 Templates (templates/)

The app uses HTML5 Templates (<template>) for efficient client-side rendering.
Main Container
index.html: The skeleton of the app. It imports app.js and provides the #content-slot where views are injected.
Partials (Views)
auth.html: A combined Login/Register form that toggles modes dynamically.
hub.html:
Displays the list of Subjects (Courses).
Contains the <template id="course-template"> for rendering course rows.
course.html:
Displays Chapters inside a selected Course.
Allows users to "Select All" chapters for a mass quiz.
chapter.html:
Displays Notes (Questions/Answers).
Features a Drag-and-Drop zone for uploading images to notes.
quiz.html:
The Flashcard interface.
Shows the Question, a "Show Answer" toggle, and "I got it / I missed it" feedback buttons.


🗄️ Database Schema (SQLite/Raw SQL)

The system uses a relational structure to link content and user progress:
school_user: Stores credentials (username, hashed password).
school_course / school_chapter / school_note: Hierarchical content tables. Each row has an owner_id linking it to its creator.
school_progress: The "Pivot Table" for the learning algorithm.
Links user_id + note_id.
Stores weight, correct_count, and wrong_count for that specific user/note pair.
