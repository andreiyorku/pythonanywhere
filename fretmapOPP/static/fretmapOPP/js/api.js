export class FretmapAPI {
    constructor(baseUrl = '/fretmapOPP') {
        this.baseUrl = baseUrl;
    }

    async getData() {
        const res = await fetch(`${this.baseUrl}/get_user_data/`);
        return await res.json();
    }

    async saveTransition(id, stats) {
        return await fetch(`${this.baseUrl}/save_transition/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCsrfToken()
            },
            body: JSON.stringify({ id, ...stats })
        });
    }

    getCsrfToken() {
        return document.cookie.match(/csrftoken=([^;]+)/)?.[1];
    }
}