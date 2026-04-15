export default class ApiService {
    static async post(payload, isFile = false) {
        let options = { method: 'POST' };

        if (isFile) {
            options.body = payload;
        } else {
            options.headers = { 'Content-Type': 'application/json' };
            options.body = JSON.stringify(payload);
        }

        try {
            const res = await fetch('/school_core/api/', options);
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error("API Error:", err);
            return null;
        }
    }
}