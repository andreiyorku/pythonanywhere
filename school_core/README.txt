# 🎓 School Core: Personalized Learning System

![Python](https://img.shields.io/badge/Python-3.10%2B-blue)
![Django](https://img.shields.io/badge/Django-5.0-green)
![JavaScript](https://img.shields.io/badge/Frontend-Vanilla%20JS-yellow)
![Database](https://img.shields.io/badge/Database-SQLite%20Raw%20SQL-lightgrey)

**School Core** is a single-page application (SPA) designed to adapt to your learning pace. It combines a secure multi-user environment with an intelligent **Infinite Quiz Engine** that uses a weighted probability algorithm to focus on what you need to practice most.

---

## 🚀 Key Features

### 🧠 Smart Quiz Engine
The system uses a **Spaced Repetition** inspired algorithm.
* **Miss a question?** Its weight increases (1.5x), so you see it more often.
* **Get it right?** Its weight drops (0.5x), so it fades away until needed.

### 👥 Multi-User Community
* **Private Content:** Users register and manage their own Courses, Chapters, and Notes.
* **Shared Learning:** Public content is available for everyone to study.

### 🔒 Granular Permissions
* **Admins:** Have global access to delete or manage any content.
* **Owners:** Can delete the content they created.
* **Students:** Read-only access to shared materials.

### ⚡ Instant Navigation
Built as a high-performance SPA using Vanilla JavaScript. Navigation between the Hub, Courses, and Quizzes is instant—no page reloads.

---

## 📂 Technical Documentation

### 1. Backend Logic (`school_core/logic.py`)
> The backend bypasses the Django ORM for **Raw SQL** queries to ensure maximum performance and fine-grained control over the probability logic.

* **`handle_auth`**: Manages session security and password hashing.
* **`handle_hub`**: Fetches courses and enforces ownership checks (Admin vs. Owner).
* **`handle_note`**: Uses a **SQL LEFT JOIN** to merge the *Global Note* data with the *User's Personal Progress* table in a single query.
* **`handle_quiz`**:
    * **Init:** Generates a lightweight "Deck" of Question IDs and Weights.
    * **Submit:** Updates the user's specific weight in `school_progress` based on their answer.

### 2. API Gateway (`school_core/views.py`)
Acts as the secure bridge between the Frontend and Logic layers.

* **`api_handler(request)`**: The single entry point for all JSON requests.
* **Security Injection:** Automatically injects the `request` object into every logic function call, ensuring the system always knows *who* is making the request.
* **File Uploads:** Handles `multipart/form-data` for seamless image uploads.

### 3. Frontend Application (`static/js/app.js`)
A dependency-free JavaScript application.

* **Router Engine:** Dynamically fetches HTML templates and injects them into the DOM.
* **State Management:** Tracks `currentUser`, `isAdmin`, and the active `quizDeck`.
* **Optimistic UI:** The Quiz Client updates weights locally *immediately* for a snappy feel, while syncing to the server in the background.

---

## 🗄️ Database Schema

The system uses a **Hybrid Ownership Model**.

1. **`school_user`**: Stores credentials (`id`, `username`, `password`).
2. **`school_course`**: The root of the content hierarchy. Includes `owner_id`.
3. **`school_note`**: Stores the **Base Weight** (Default difficulty: 10.0).
4. **`school_progress`**: **The Magic Table.** Links `user_id` + `note_id` to store the *Personalized Weight* for that specific user.

---

_Built with ❤️ using Django & Vanilla JS_
