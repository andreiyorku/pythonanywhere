import ApiService from './ApiService.js';
import UI from './UI.js';
import { state } from './Store.js';

export default class AuthController {
    static async checkLogin(routerCallback) {
        const data = await ApiService.post({ action: 'get_current_user' });

        if (data && data.username) {
            state.userId = data.id;
            state.isAdmin = data.is_admin;
            this.updateUserDisplay(data.username);

            document.getElementById('content-slot').innerHTML = '<div style="padding: 20px; font-size: 1.2em; font-weight: bold; color: #004085;">🔄 Syncing latest database and images from cloud... Please wait.</div>';

            const pullRes = await ApiService.post({ action: 'sync_pull' });
            if (pullRes && pullRes.error) UI.showToast("⚠️ Cloud Pull Failed.", "error");
            else if (pullRes) UI.showToast("✅ Cloud Sync Complete!", "success");

            routerCallback('hub');
        } else {
            routerCallback('auth');
        }
    }

    static async performAuth(routerCallback) {
        const user = document.getElementById('auth-username').value;
        const pass = document.getElementById('auth-password').value;
        const errorBox = document.getElementById('auth-error');

        if (!user || !pass) return alert("Please enter both fields.");

        const action = state.isRegisterMode ? 'register' : 'login';
        const data = await ApiService.post({ action: action, username: user, password: pass });

        if (data && data.status === 'success') this.checkLogin(routerCallback);
        else if (data) {
            errorBox.innerText = data.error || "Authentication failed";
            errorBox.style.display = 'block';
        }
    }

    static toggleMode() {
        state.isRegisterMode = !state.isRegisterMode;
        const title = document.getElementById('auth-title');
        const btn = document.getElementById('auth-btn');
        const errorBox = document.getElementById('auth-error');
        errorBox.style.display = 'none';

        if (state.isRegisterMode) {
            title.innerText = "Create Account";
            btn.innerText = "Sign Up";
            document.getElementById('auth-toggle-text').innerHTML = 'Already have an account? <a href="#" onclick="window.App.toggleAuthMode()">Login</a>';
        } else {
            title.innerText = "Login";
            btn.innerText = "Login";
            document.getElementById('auth-toggle-text').innerHTML = 'New here? <a href="#" onclick="window.App.toggleAuthMode()">Create an account</a>';
        }
    }

    static async logout() {
        await ApiService.post({ action: 'logout' });
        location.reload();
    }

    static updateUserDisplay(username) {
        let banner = document.getElementById('user-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'user-banner';
            banner.style.cssText = "position: absolute; top: 10px; right: 10px; background: #eee; padding: 5px 10px; border-radius: 4px;";
            document.body.prepend(banner);
        }
        banner.innerHTML = `<b>${username}</b> | <a href="#" onclick="window.App.logout()">Logout</a>`;
    }
}