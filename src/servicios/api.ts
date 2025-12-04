const BASE_URL = 'http://localhost:4000/api'; // O tu URL de Render en producción

export const api = {
    async get(endpoint: string) {
        const res = await fetch(`${BASE_URL}${endpoint}`);
        return res.json();
    },
    async post(endpoint: string, body: any) {
        const res = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return res.json();
    },
    async delete(endpoint: string) {
        const res = await fetch(`${BASE_URL}${endpoint}`, { method: 'DELETE' });
        return res.json();
    }
};