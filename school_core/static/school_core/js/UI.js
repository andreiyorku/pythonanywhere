export default class UI {
    static showToast(message, type = "info") {
        const toast = document.createElement('div');
        toast.innerText = message;
        toast.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; z-index: 9999;
            padding: 15px 25px; border-radius: 5px; color: white; font-weight: bold;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3); opacity: 0; transition: opacity 0.3s;
        `;

        if (type === "success") toast.style.background = "#28a745";
        else if (type === "error") toast.style.background = "#dc3545";
        else toast.style.background = "#17a2b8";

        document.body.appendChild(toast);
        setTimeout(() => toast.style.opacity = "1", 10);
        setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 4000);
    }

    static handleGitResponse(res) {
        if (res && res.git) {
            if (res.git.success) this.showToast("✅ Successfully synced to GitHub!", "success");
            else {
                console.error("Git Sync Error:", res.git.message);
                this.showToast("❌ Saved locally, but Git Sync failed.", "error");
            }
        }
    }

    static openImageModal(src) {
        let modal = document.getElementById('global-image-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'global-image-modal';
            modal.style.cssText = `
                display: flex; position: fixed; z-index: 100000; left: 0; top: 0;
                width: 100vw; height: 100vh; background-color: rgba(0,0,0,0.85);
                justify-content: center; align-items: center; overflow: auto;
            `;

            const closeBtn = document.createElement('span');
            closeBtn.innerHTML = "&times;";
            closeBtn.style.cssText = `
                position: fixed; top: 15px; right: 25px; color: #f1f1f1;
                font-size: 50px; font-weight: bold; cursor: pointer; z-index: 100001;
            `;
            closeBtn.onclick = () => modal.style.display = "none";

            const imgContent = document.createElement('img');
            imgContent.id = 'global-modal-img';
            imgContent.style.cssText = `margin: auto; display: block; max-width: 95%; max-height: 95%; object-fit: contain; cursor: zoom-in; transition: transform 0.2s ease;`;

            let zoomed = false;
            imgContent.onclick = function(e) {
                e.stopPropagation();
                zoomed = !zoomed;
                this.style.transform = zoomed ? "scale(1.5)" : "scale(1)";
                this.style.cursor = zoomed ? "zoom-out" : "zoom-in";
            };

            modal.onclick = () => modal.style.display = "none";
            modal.appendChild(closeBtn);
            modal.appendChild(imgContent);
            document.body.appendChild(modal);
        }

        const img = document.getElementById('global-modal-img');
        img.src = src;
        img.style.transform = "scale(1)";
        img.style.cursor = "zoom-in";
        modal.style.display = "flex";
    }

    static parseContent(content) {
        if (!content) return { text: "", images: [] };
        const parts = content.split("|||");
        let text = parts[0].startsWith("IMG:") ? "" : parts[0];
        let images = parts.filter(p => p.startsWith("IMG:")).map(p => p.substring(4));
        return { text, images };
    }

    static renderMedia(content) {
        const { text, images } = this.parseContent(content);
        let html = text ? `<div>${text}</div>` : "";
        images.forEach(img => {
            // Note: onclick is mapped to a global window function in main.js
            html += `<img src="${img}" onclick="window.App.openImageModal('${img}')" title="Click to enlarge" style="width: 100%; height: auto; display: block; border: 1px solid #ccc; margin-top: 5px; border-radius: 4px; cursor: pointer;">`;
        });
        return html;
    }
}