import ApiService from './ApiService.js';
import UI from './UI.js';
import { state } from './Store.js';

export default class QuizController {
    static async start(returnTo = 'hub', routerCallback) {
        state.quizReturnView = returnTo;
        const boxes = document.querySelectorAll('.chap-select:checked');
        const ids = Array.from(boxes).map(b => b.value);
        if(ids.length === 0) return alert("Select chapters to review.");

        let coursePercentages = {};
        let selectedMode = 'standard';

        if (returnTo === 'hub') {
            const modeDropdown = document.getElementById('quiz-chapter-mode');
            if (modeDropdown) selectedMode = modeDropdown.value;

            const selectedCourses = new Set();
            boxes.forEach(b => {
                const cls = Array.from(b.classList).find(c => c.startsWith('course-chap-'));
                if (cls) selectedCourses.add(cls.replace('course-chap-', ''));
            });

            let totalPct = 0;
            selectedCourses.forEach(cid => {
                const pInput = document.getElementById(`course-pct-${cid}`);
                if (pInput) {
                    const val = parseFloat(pInput.value) || 0;
                    coursePercentages[cid] = val;
                    totalPct += val;
                }
            });

            if (Math.abs(totalPct - 100) > 0.01) {
                return alert(`Total focus must equal exactly 100%. You are currently at ${totalPct}%.`);
            }
        }

        const data = await ApiService.post({
            action: 'init_quiz',
            chapter_ids: ids,
            course_percentages: coursePercentages,
            chapter_mode: selectedMode
        });

        if (!data || !data.deck || data.deck.length === 0) return alert("No active notes in selection.");

        state.quizDeck = data.deck;
        state.quizChapterIds = ids;
        state.coursePercentages = coursePercentages;
        state.chapterMode = selectedMode;

        if (state.gitSyncInterval) clearInterval(state.gitSyncInterval);
        state.gitSyncInterval = setInterval(async () => {
            if (state.pendingGitSync) {
                state.pendingGitSync = false;
                UI.showToast("☁️ Batch syncing progress...", "info");
                const res = await ApiService.post({ action: 'trigger_git_sync' });
                UI.handleGitResponse(res);
            }
        }, 12000);

        routerCallback('quiz');
    }

    static async nextQuestion() {
        const container = document.getElementById('quiz-container');
        if (state.quizDeck.length === 0) {
            container.innerHTML = "<h3>Deck empty. All questions mastered or suspended!</h3>";
            return;
        }
        container.innerHTML = "<h3>Calculating...</h3>";

        let candidates = (state.quizDeck.length > 1 && state.lastQuizItemId)
            ? state.quizDeck.filter(n => n.id !== state.lastQuizItemId)
            : state.quizDeck;

        // Roulette Spin
        let totalWeight = candidates.reduce((sum, item) => sum + item.w, 0);
        let randomVal = Math.random() * totalWeight;
        let runningSum = 0;
        let winner = candidates[candidates.length - 1];

        for (let i = 0; i < candidates.length; i++) {
            runningSum += candidates[i].w;
            if (randomVal <= runningSum) {
                winner = candidates[i];
                break;
            }
        }

        state.lastQuizItemId = winner.id;
        state.currentQuizItem = winner;

        const content = await ApiService.post({ action: 'get_content', note_id: state.currentQuizItem.id });

        if (!content || content.error) {
            container.innerHTML = `<div style="text-align: center; padding: 40px; border: 2px dashed red;"><h3>⚠️ Server Timeout</h3><button onclick="window.App.nextQuestion()">Retry</button></div>`;
            return;
        }

        this.renderCard(container, content);
    }

    static renderCard(container, content) {
        container.innerHTML = '';
        const template = document.getElementById('quiz-card-template');
        const clone = template.content.cloneNode(true);

        const safeSet = (sel, val) => { const el = clone.querySelector(sel); if(el) el.innerText = val; };
        safeSet('.q-course-name', content.course_name);
        safeSet('.q-chapter-name', content.chapter_name);
        safeSet('.q-chapter-index', content.chapter_index);
        safeSet('.q-weight', state.currentQuizItem.w.toExponential(2));

        clone.querySelector('.q-header').innerHTML = UI.renderMedia(content.header);
        clone.querySelector('.q-body').innerHTML = UI.renderMedia(content.body);

        const ansArea = clone.querySelector('.q-answer-area');
        clone.querySelector('.btn-show-answer').onclick = () => { ansArea.style.display = 'block'; };
        clone.querySelector('.btn-correct').onclick = () => this.handleLocalAnswer(true);
        clone.querySelector('.btn-wrong').onclick = () => this.handleLocalAnswer(false);

        this.setupEditMode(clone, content);
        container.appendChild(clone);
    }

    static setupEditMode(clone, content) {
        const btnEdit = clone.querySelector('.btn-edit-quiz');
        const viewMode = clone.querySelector('.q-view-mode');
        const editMode = clone.querySelector('.q-edit-mode');
        let keptBodyImages = [];

        btnEdit.style.display = 'block';

        btnEdit.onclick = () => {
            viewMode.style.display = 'none';
            editMode.style.display = 'block';
            btnEdit.style.display = 'none';

            const hData = UI.parseContent(content.header);
            const bData = UI.parseContent(content.body);

            editMode.querySelector('.edit-header-text').value = hData.text;
            editMode.querySelector('.edit-body-text').value = bData.text;

            const wInput = editMode.querySelector('.edit-weight-val');
            if (wInput) wInput.value = content.raw_weight;

            keptBodyImages = [...bData.images];
            // Render existing images to keep
        };

        clone.querySelector('.btn-cancel-edit').onclick = () => {
            viewMode.style.display = 'block';
            editMode.style.display = 'none';
            btnEdit.style.display = 'block';
        };

        clone.querySelector('.btn-save-edit').onclick = async () => {
            const formData = new FormData();
            formData.append('action', 'edit_note');
            formData.append('note_id', state.currentQuizItem.id);
            formData.append('header', editMode.querySelector('.edit-header-text').value);
            formData.append('body', editMode.querySelector('.edit-body-text').value);

            const wInputSave = editMode.querySelector('.edit-weight-val');
            if (wInputSave && wInputSave.value !== "") formData.append('weight', wInputSave.value);

            formData.append('kept_body_images', JSON.stringify(keptBodyImages));

            const fileBInput = editMode.querySelector('.edit-body-file');
            for (let i = 0; i < fileBInput.files.length; i++) formData.append('body_image', fileBInput.files[i]);

            const res = await ApiService.post(formData, true);
            if (res && !res.error) {
                if (wInputSave && parseFloat(wInputSave.value) <= 0) {
                    UI.showToast("🚫 Question Suspended!", "info");
                    state.quizDeck = state.quizDeck.filter(n => n.id !== state.currentQuizItem.id);
                    state.pendingGitSync = true;
                    this.nextQuestion();
                } else {
                    UI.showToast("✅ Edits saved!", "success");
                    state.pendingGitSync = true;
                    // To keep it concise, we just reload the question here
                    this.nextQuestion();
                }
            } else {
                alert(res?.error || "Error saving");
            }
        };
    }

    static async handleLocalAnswer(isCorrect) {
        document.getElementById('quiz-container').innerHTML = `<div style="text-align: center; padding: 40px;"><h3>Recording...</h3></div>`;

        if (isCorrect) {
            let deckItem = state.quizDeck.find(n => n.id === state.currentQuizItem.id);
            if (deckItem) deckItem.w = Math.max(2.23e-308, deckItem.w / 2);
            UI.showToast("✅ Correct! Progress saved locally.", "success");
        } else {
            UI.showToast("📝 Wrong answer. Loading next...", "info");
        }

        state.pendingGitSync = true;
        await ApiService.post({ action: 'submit_answer', note_id: state.currentQuizItem.id, is_correct: isCorrect });
        this.nextQuestion();
    }
}