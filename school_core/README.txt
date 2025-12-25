<div align="center">

# 🎓 School Core
### Personalized Learning System & Infinite Quiz Engine

<a href="#">
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" />
</a>
<a href="#">
  <img src="https://img.shields.io/badge/Django-5.0-092E20?style=for-the-badge&logo=django&logoColor=white" />
</a>
<a href="#">
  <img src="https://img.shields.io/badge/Database-Raw%20SQL-003B57?style=for-the-badge&logo=sqlite&logoColor=white" />
</a>
<a href="#">
  <img src="https://img.shields.io/badge/Frontend-Vanilla%20JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
</a>

<br/><br/>

**School Core** is a dynamic **Single-Page Application (SPA)** that adapts to how you learn. It features a secure multi-user environment, granular permissions, and a **Weighted Probability Algorithm** that acts like a digital tutor—drilling you on what you don't know and skipping what you do.

</div>

---

## 🚀 Key Features

<table>
  <tr>
    <td width="50px" align="center">🧠</td>
    <td><strong>Smart Quiz Engine</strong><br>Uses a <em>Spaced Repetition</em> inspired algorithm. Questions you miss get <strong>1.5x weight</strong> (appear more). Questions you answer correctly get <strong>0.5x weight</strong> (appear less).</td>
  </tr>
  <tr>
    <td align="center">👥</td>
    <td><strong>Multi-User Community</strong><br>Users can register, login, and manage their own private content. All Shared/Public courses are available for everyone to learn from.</td>
  </tr>
  <tr>
    <td align="center">🔒</td>
    <td><strong>Granular Permissions</strong><br>• <strong>Admins:</strong> God-mode access (Delete/Edit anything).<br>• <strong>Owners:</strong> Can only delete content <em>they</em> created.<br>• <strong>Students:</strong> Read-only access to public material.</td>
  </tr>
  <tr>
    <td align="center">⚡</td>
    <td><strong>Instant Navigation</strong><br>Built as a high-performance SPA. Navigating between Hub, Courses, and Quizzes happens instantly without page reloads.</td>
  </tr>
</table>

---

## 📂 Technical Documentation

### 🛠️ Backend (`school_core/logic.py`)
> The backend bypasses the Django ORM for **Raw SQL** queries to handle complex probability logic efficiently.

<details>
<summary><b>Click to expand Function Reference</b></summary>
<br>

| Function | Role | Details |
| :--- | :--- | :--- |
| `handle_auth` | **Security** | Manages Sessions and Password Hashing (`pbkdf2_sha256`). Returns `is_admin` flags. |
| `handle_hub` | **Course Mgr** | Fetches courses with `owner_id`. Enforces `user_id == owner_id` checks for deletion. |
| `handle_note` | **Data Merge** | Uses a **SQL LEFT JOIN** to merge the *Global Note* data with the *User's Personal Progress* table in one query. |
| `handle_quiz` | **Algorithm** | • **Init:** Generates a "Deck" of IDs and Weights.<br>• **Submit:** Updates the user's specific weight in `school_progress` based on the answer. |

</details>

### 🔌 API Gateway (`school_core/views.py`)
<details>
<summary><b>Click to expand API Details</b></summary>
<br>

Acts as the bridge between the Frontend and Logic layers.

* **`api_handler(request)`**: The single entry point.
    * **Security:** Injects the `request` object into every logic function call.
    * **Uploads:** Handles `multipart/form-data` for image uploads.
* **`get_partial(request)`**: Securely serves HTML fragments to the router.

</details>

### 🎨 Frontend (`static/js/app.js`)
<details>
<summary><b>Click to expand JavaScript Modules</b></summary>
<br>

A dependency-free Vanilla JS application.

1.  **Router Engine:** Dynamically fetches and injects HTML templates.
2.  **State Management:** Tracks `currentUser`, `isAdmin`, and `quizDeck`.
3.  **Optimistic UI:** The Quiz Client updates weights locally *immediately* for a snappy feel, while syncing to the server in the background.

</details>

---

## 🗄️ Database Schema

The system uses a **Hybrid Ownership Model**.

| Table | Columns | Purpose |
| :--- | :--- | :--- |
| **`school_user`** | `id`, `username`, `password` | User credentials. |
| **`school_course`** | `id`, `name`, `owner_id` | Content hierarchy root. |
| **`school_note`** | `id`, `body`, `weight` (Default) | The "Master Copy" of the question. |
| **`school_progress`** | `user_id`, `note_id`, `weight` | **The Magic Table.** Overrides the default weight for specific users based on their quiz history. |

---

<div align="center">
  <sub>Built with ❤️ using Django & Vanilla JS</sub>
</div>
