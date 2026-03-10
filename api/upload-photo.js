export default async function handler(req, res) {
    console.log('🔥 Запрос получен:', req.method, 'Body type:', typeof req.body, 'Body:', req.body);
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    try {
        const backendUrl = 'http://62.109.27.246:8000/upload-photo';
        // Если req.body уже строка, используем её как есть, иначе преобразуем в строку
        const bodyToSend = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        console.log('🔄 Отправляем на бэкенд:', backendUrl, 'Body:', bodyToSend);
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: bodyToSend,
        });
        const data = await response.json();
        console.log('📡 Статус от бэкенда:', response.status);
        res.status(response.status).json(data);
    } catch (error) {
        console.error('❌ Ошибка в proxy:', error.message);
        res.status(500).json({ error: 'Internal Server Error', detail: error.message });
    }
}