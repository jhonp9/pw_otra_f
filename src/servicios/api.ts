// frontend/src/servicios/api.ts
const BASE_URL = 'https://pw-otra-b.onrender.com/api';

const getHeaders = () => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = token;
    }
    return headers;
};

export const api = {
    async get(endpoint: string) {
        const res = await fetch(`${BASE_URL}${endpoint}`, { headers: getHeaders() });
        return res.json();
    },
    async post(endpoint: string, body: any) {
        const res = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });
        return res.json();
    },
    async delete(endpoint: string) {
        const res = await fetch(`${BASE_URL}${endpoint}`, { 
            method: 'DELETE',
            headers: getHeaders()
        });
        return res.json();
    }
};