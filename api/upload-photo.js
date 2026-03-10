export default async function handler(req, res) {
    console.log('🔥 Запрос получен:', req.method, JSON.stringify(req.body));
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    try {
        const backendUrl = 'http://62.109.27.246:8000/upload-photo';
        console.log('🔄 Отправляем на бэкенд:', backendUrl);

        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body),
        });

        console.log('📡 Статус от бэкенда:', response.status);
        const data = await response.json();
        console.log('✅ Ответ от бэкенда:', data);

        res.status(response.status).json(data);
    } catch (error) {
        console.error('❌ Ошибка в proxy:', error.message, error.stack);
        res.status(500).json({ error: 'Internal Server Error', detail: error.message });
    }
}