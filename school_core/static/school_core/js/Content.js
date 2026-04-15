import ApiService from './ApiService.js';
import UI from './UI.js';
import { state } from './Store.js';

export default class ContentController {

    // ==========================================
    // --- HUB & COURSE LOGIC ---
    // ==========================================
    static updateTotalFocus() {
        let total = 0;
        document.querySelectorAll('.course-percentage').forEach(inp => {
            if (inp.value.length > 1 && inp.value.startsWith('0') && !inp.value.includes('.')) {
                inp.value = parseInt(inp.value, 10);
            }
            if (parseFloat(inp.value) > 100) inp.value = 100;
            if (parseFloat(inp.value) < 0) inp.value = 0;
            const val = parseFloat(inp.value) || 0;
            total += val;

            if (inp.id) {
                const cid = inp.id.replace('course-pct-', '');
                localStorage.setItem(`focus_pct_${state.userId}_${cid}`, val);
            }
        });

        const display = document.getElementById('focus-total-display');
        if(display) {
            display.innerText = `Total Focus: ${total}%`;
            display.style.color = total === 100 ? 'green' : 'red';
        }
    }

    static async populateChapters(courseId) {
        const container = document.getElementById(`hub-chapters-${courseId}`);

        // SMART CHECK: Check if checkboxes actually exist inside, not just if it's "empty"
        if (!container.querySelector('.chap-select')) {
            const data = await ApiService.post({ action: 'get_chapters', course_id: courseId });
            if (!data) return;

            container.innerHTML = '';

            if(data.chapters && data.chapters.length > 0) {
                data.chapters.forEach(c => {
                    const el = document.createElement('div');
                    let savedState = localStorage.getItem(`chapter_selected_${state.userId}_${c.id}`);
                    const courseCb = document.getElementById(`course-check-${courseId}`);
                    let isChecked = false;

                    if (savedState !== null) isChecked = savedState === 'true';
                    else if (courseCb && courseCb.checked) {
                        isChecked = true;
                        localStorage.setItem(`chapter_selected_${state.userId}_${c.id}`, true);
                    }

                    el.innerHTML = `<input type="checkbox" class="chap-select course-chap-${courseId}" value="${c.id}" ${isChecked ? 'checked' : ''} onchange="window.App.handleChapterCheck('${courseId}', this)"> ${c.name}`;
                    container.appendChild(el);
                });
            } else {
                container.innerHTML = '<div style="color: #777; font-style: italic; padding: 5px 0;">No chapters yet. Click "Open Course" to create some!</div>';
            }
        }
    }

    static async toggleHubChapters(courseId, forceOpen = false) {
        const container = document.getElementById(`hub-chapters-${courseId}`);
        if (!container.querySelector('.chap-select')) await this.populateChapters(courseId);

        if (container.style.display === 'none' || forceOpen) container.style.display = 'block';
        else container.style.display = 'none';
    }

    static async toggleCourseSelection(masterCheckbox, courseId) {
        localStorage.setItem(`course_selected_${state.userId}_${courseId}`, masterCheckbox.checked);

        const container = document.getElementById(`hub-chapters-${courseId}`);
        if (!container.querySelector('.chap-select')) await this.populateChapters(courseId);

        if (masterCheckbox.checked) container.style.display = 'block';

        document.querySelectorAll(`.course-chap-${courseId}`).forEach(c => {
            c.checked = masterCheckbox.checked;
            localStorage.setItem(`chapter_selected_${state.userId}_${c.value}`, c.checked);
        });
    }

    static handleChapterCheck(courseId, chapCheckbox) {
        localStorage.setItem(`chapter_selected_${state.userId}_${chapCheckbox.value}`, chapCheckbox.checked);
        const courseCb = document.getElementById(`course-check-${courseId}`);
        const allChaps = document.querySelectorAll(`.course-chap-${courseId}`);
        const anyChecked = Array.from(allChaps).some(c => c.checked);

        if (courseCb) {
            courseCb.checked = anyChecked;
            localStorage.setItem(`course_selected_${state.userId}_${courseId}`, anyChecked);
        }
    }

    static async loadCourses() {
        const data = await ApiService.post({ action: 'get_courses' });
        const list = document.getElementById('course-list');
        const template = document.getElementById('course-template');
        list.innerHTML = '';
        if(!data || !data.courses) return;

        const modeDropdown = document.getElementById('quiz-chapter-mode');
        if (modeDropdown) {
            const savedMode = localStorage.getItem(`quiz_mode_${state.userId}`);
            if (savedMode) modeDropdown.value = savedMode;
            modeDropdown.onchange = (e) => localStorage.setItem(`quiz_mode_${state.userId}`, e.target.value);
        }

        data.courses.forEach(c => {
            const clone = template.content.cloneNode(true);
            clone.querySelector('.course-name').innerText = c.name;

            const courseCb = clone.querySelector('.course-check');
            courseCb.id = `course-check-${c.id}`;
            courseCb.checked = localStorage.getItem(`course_selected_${state.userId}_${c.id}`) === 'true';
            courseCb.onchange = (e) => this.toggleCourseSelection(e.target, c.id);

            const pctInput = clone.querySelector('.course-percentage');
            pctInput.id = `course-pct-${c.id}`;
            const savedPct = localStorage.getItem(`focus_pct_${state.userId}_${c.id}`);
            pctInput.value = savedPct !== null ? savedPct : "";
            pctInput.oninput = () => this.updateTotalFocus();

            clone.querySelector('.btn-expand').onclick = () => this.toggleHubChapters(c.id);
            clone.querySelector('.btn-open').onclick = () => {
                state.courseId = c.id; state.courseName = c.name; state.courseOwner = c.owner_id;
                window.App.router('course');
            };

            const btnRename = clone.querySelector('.btn-rename');
            const btnDelete = clone.querySelector('.btn-delete');
            const btnReset = clone.querySelector('.btn-reset-course');

            if (state.isAdmin || c.owner_id === state.userId) {
                btnRename.onclick = async () => {
                    const newName = prompt("Rename Course:", c.name);
                    if(newName && newName !== c.name) {
                        UI.showToast("☁️ Renaming and pushing to GitHub...", "info");
                        const res = await ApiService.post({ action: 'edit_course', course_id: c.id, name: newName });
                        if (res) { UI.handleGitResponse(res); this.loadCourses(); }
                    }
                };
                btnDelete.onclick = async () => {
                    if(confirm("Delete Course?")) {
                        UI.showToast("☁️ Deleting and pushing to GitHub...", "info");
                        const res = await ApiService.post({ action: 'delete_course', course_id: c.id });
                        if (res) { UI.handleGitResponse(res); this.loadCourses(); }
                    }
                };
                btnReset.onclick = async () => {
                    if (confirm("Reset ALL progress for EVERY chapter in this course?")) {
                        UI.showToast("☁️ Resetting course...", "info");
                        const res = await ApiService.post({ action: 'reset_course', course_id: c.id });
                        if (res) UI.handleGitResponse(res);
                    }
                };
            } else {
                btnRename.style.display = 'none'; btnDelete.style.display = 'none'; btnReset.style.display = 'none';
            }

            clone.querySelector('.hub-chapters-container').id = `hub-chapters-${c.id}`;
            if (courseCb.checked) clone.querySelector('.hub-chapters-container').style.display = 'block';

            list.appendChild(clone);
            this.populateChapters(c.id);
        });
        setTimeout(() => this.updateTotalFocus(), 100);
    }

    static async addCourse() {
        const n = document.getElementById('new-course-name').value;
        if(n) {
            UI.showToast("☁️ Saving to GitHub...", "info");
            const res = await ApiService.post({ action: 'add_course', name: n });
            if (res) { UI.handleGitResponse(res); this.loadCourses(); }
        }
    }

    // ==========================================
    // --- CHAPTER LOGIC ---
    // ==========================================
    static async loadChapters() {
        const data = await ApiService.post({ action: 'get_chapters', course_id: state.courseId });
        const list = document.getElementById('chapter-list');
        const template = document.getElementById('chapter-row-template');
        list.innerHTML = '';
        if(!data || !data.chapters) return;

        data.chapters.forEach(c => {
            const clone = template.content.cloneNode(true);
            const viewMode = clone.querySelector('.chap-view-mode');
            const editMode = clone.querySelector('.chap-edit-mode');

            clone.querySelector('.chap-label').innerText = `Index ${c.index}: ${c.name}`;
            const chapSelectCb = clone.querySelector('.chap-select');
            chapSelectCb.value = c.id;

            let savedState = localStorage.getItem(`chapter_selected_${state.userId}_${c.id}`);
            chapSelectCb.checked = savedState === 'true';
            chapSelectCb.onchange = (e) => localStorage.setItem(`chapter_selected_${state.userId}_${c.id}`, e.target.checked);

            clone.querySelector('.btn-notes').onclick = () => {
                state.chapterId = c.id; state.chapterName = c.name;
                window.App.router('chapter');
            };

            if (state.isAdmin || c.owner_id === state.userId) {
                clone.querySelector('.btn-delete').onclick = async () => {
                    if(confirm("Delete Chapter?")) {
                        UI.showToast("☁️ Deleting chapter...", "info");
                        const res = await ApiService.post({ action: 'delete_chapter', chapter_id: c.id });
                        if (res) { UI.handleGitResponse(res); this.loadChapters(); }
                    }
                };
                clone.querySelector('.btn-reset-chap').onclick = async () => {
                    if (confirm("Reset ALL progress for this chapter?")) {
                        UI.showToast("☁️ Resetting chapter...", "info");
                        const res = await ApiService.post({ action: 'reset_chapter', chapter_id: c.id });
                        if (res) UI.handleGitResponse(res);
                    }
                };

                clone.querySelector('.btn-edit-chap').onclick = () => {
                    viewMode.style.display = 'none'; editMode.style.display = 'block';
                    editMode.querySelector('.edit-chap-name').value = c.name;
                    editMode.querySelector('.edit-chap-index').value = c.index;
                };

                editMode.querySelector('.btn-cancel-chap').onclick = () => {
                    viewMode.style.display = 'flex'; editMode.style.display = 'none';
                };

                editMode.querySelector('.btn-save-chap').onclick = async () => {
                    const newName = editMode.querySelector('.edit-chap-name').value;
                    const newIndex = editMode.querySelector('.edit-chap-index').value;
                    if (!newName || !newIndex) return alert("Please fill out both Name and Index.");
                    UI.showToast("☁️ Updating chapter...", "info");
                    const res = await ApiService.post({ action: 'edit_chapter', chapter_id: c.id, name: newName, index: newIndex });
                    if (res) { UI.handleGitResponse(res); this.loadChapters(); }
                };
            } else {
                clone.querySelector('.btn-delete').style.display = 'none';
                clone.querySelector('.btn-edit-chap').style.display = 'none';
                clone.querySelector('.btn-reset-chap').style.display = 'none';
            }
            list.appendChild(clone);
        });
    }

    static async addChapter() {
        const n = document.getElementById('new-chap-name').value;
        const i = document.getElementById('new-chap-index').value;
        UI.showToast("☁️ Saving chapter...", "info");
        const res = await ApiService.post({ action: 'add_chapter', course_id: state.courseId, name: n, index: i });
        if (res) { UI.handleGitResponse(res); this.loadChapters(); }
    }

    // ==========================================
    // --- NOTE LOGIC ---
    // ==========================================
    static async loadNotes() {
        const data = await ApiService.post({ action: 'get_notes', chapter_id: state.chapterId });
        const list = document.getElementById('notes-list');
        const template = document.getElementById('note-item-template');
        list.innerHTML = '';
        if(!data || !data.notes) return;

        data.notes.forEach(n => {
            const clone = template.content.cloneNode(true);
            const card = clone.querySelector('.note-card');
            const viewMode = clone.querySelector('.note-view');

            viewMode.querySelector('.note-header').innerHTML = UI.renderMedia(n.header);
            viewMode.querySelector('.note-body').innerHTML = UI.renderMedia(n.body);

            const wSpan = clone.querySelector('.note-weight');
            if (n.weight <= 0) wSpan.innerHTML = "<span style='color: red; font-weight: bold;'>Suspended (0)</span>";
            else { wSpan.innerText = n.weight; if (n.weight !== 10) wSpan.style.fontWeight = 'bold'; }

            const btnReset = clone.querySelector('.btn-reset');
            if (n.weight !== 10) {
                btnReset.onclick = async () => {
                    UI.showToast("☁️ Resetting note...", "info");
                    const res = await ApiService.post({ action: 'reset_note', note_id: n.id });
                    if (res) { UI.handleGitResponse(res); this.loadNotes(); }
                };
            } else btnReset.style.display = 'none';

            if (state.isAdmin || n.owner_id === state.userId) {
                clone.querySelector('.btn-delete').onclick = async () => {
                    if(confirm("Delete Note?")) {
                        const res = await ApiService.post({ action: 'delete_note', note_id: n.id });
                        if (res) { UI.handleGitResponse(res); this.loadNotes(); }
                    }
                };
                clone.querySelector('.btn-edit').onclick = () => this.enableNoteEditMode(card, n);
            } else {
                clone.querySelector('.btn-delete').style.display = 'none';
                clone.querySelector('.btn-edit').style.display = 'none';
            }
            list.appendChild(clone);
        });
    }

    static enableNoteEditMode(card, note) {
        const view = card.querySelector('.note-view');
        const edit = card.querySelector('.note-edit');
        view.style.display = 'none'; edit.style.display = 'block';

        const hData = UI.parseContent(note.header);
        const bData = UI.parseContent(note.body);

        edit.querySelector('.edit-header-text').value = hData.text;
        edit.querySelector('.edit-body-text').value = bData.text;

        const wInput = edit.querySelector('.edit-weight-val');
        if (wInput) wInput.value = note.weight;

        const hControls = edit.querySelector('.edit-header-img-controls');
        hControls.innerHTML = '';
        if (hData.images.length > 0) {
            hControls.innerHTML = `
                <div style="font-size:0.8em; color: blue;">Current Image: <a href="${hData.images[0]}" target="_blank">View</a></div>
                <label style="font-size:0.8em; color: red; cursor:pointer;"><input type="checkbox" class="remove-header-img"> Remove Image</label>
            `;
        }

        const bControls = edit.querySelector('.edit-body-img-controls');
        let keptBodyImages = [...bData.images];
        const renderKeptBodyImages = () => {
            bControls.innerHTML = '';
            keptBodyImages.forEach((img, idx) => {
                const div = document.createElement('div');
                div.style.cssText = "font-size:0.8em; margin-top:3px; display:flex; justify-content:space-between; align-items:center; background:#eee; padding:2px 5px; border-radius:3px;";
                div.innerHTML = `<a href="${img}" target="_blank">View Existing Image ${idx + 1}</a> <span style="color:red; cursor:pointer; font-weight:bold;">[X] Delete</span>`;
                div.querySelector('span').onclick = () => { keptBodyImages.splice(idx, 1); renderKeptBodyImages(); };
                bControls.appendChild(div);
            });
        };
        renderKeptBodyImages();

        edit.querySelector('.btn-cancel-edit').onclick = () => { view.style.display = 'block'; edit.style.display = 'none'; };

        edit.querySelector('.btn-save-edit').onclick = async () => {
            const formData = new FormData();
            formData.append('action', 'edit_note'); formData.append('note_id', note.id);
            formData.append('header', edit.querySelector('.edit-header-text').value);
            formData.append('body', edit.querySelector('.edit-body-text').value);
            if (wInput) formData.append('weight', wInput.value);

            const remH = edit.querySelector('.remove-header-img');
            if (remH && remH.checked) formData.append('remove_header_img', 'true');
            const fileH = edit.querySelector('.edit-header-file').files[0];
            if (fileH) formData.append('header_image', fileH);

            formData.append('kept_body_images', JSON.stringify(keptBodyImages));
            const fileBInput = edit.querySelector('.edit-body-file');
            for (let i = 0; i < fileBInput.files.length; i++) formData.append('body_image', fileBInput.files[i]);

            UI.showToast("☁️ Saving edits...", "info");
            const res = await ApiService.post(formData, true);
            if (res && res.error) alert(res.error);
            else if (res) { UI.handleGitResponse(res); this.loadNotes(); }
        };
    }

    static async addNote() {
        const formData = new FormData();
        formData.append('action', 'add_note');
        formData.append('chapter_id', state.chapterId);
        formData.append('header', document.getElementById('note-header').value);
        formData.append('body', document.getElementById('note-body').value);

        if (state.pendingHeaderFile) formData.append('header_image', state.pendingHeaderFile);
        state.pendingBodyFiles.forEach(f => formData.append('body_image', f));

        UI.showToast("☁️ Saving note...", "info");
        const res = await ApiService.post(formData, true);

        if (res && res.error) alert(res.error);
        else if (res) {
            document.getElementById('note-header').value = '';
            document.getElementById('note-body').value = '';
            const ph = document.getElementById('preview-text-header'); if(ph) ph.style.display='none';
            const pb = document.getElementById('preview-text-body'); if(pb) pb.style.display='none';
            state.pendingHeaderFile = null; state.pendingBodyFiles = [];
            UI.handleGitResponse(res);
            this.loadNotes();
        }
    }
}