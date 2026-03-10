import React, { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';

const tg = window.Telegram?.WebApp;

function App() {
  const [hasPhoto, setHasPhoto] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [photoData, setPhotoData] = useState(null);
  const [facingMode, setFacingMode] = useState('user'); // 'user' (передняя) или 'environment' (задняя)

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Получаем параметры из URL
  const urlParams = new URLSearchParams(window.location.search);
  const task_id = urlParams.get('task_id') || '';

  // Функция запуска камеры
  const startCamera = useCallback(async () => {
    try {
      // Останавливаем предыдущую камеру, если есть
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Ошибка доступа к камере:', err);
      if (tg) {
        tg.showAlert('Не удалось получить доступ к камере.');
      }
    }
  }, [facingMode]); // перезапускаем при смене facingMode

  // Эффект для инициализации и очистки
  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
    }
    startCamera();

    // Функция очистки – копируем ref в переменную, чтобы избежать предупреждения
    const currentVideo = videoRef.current;
    return () => {
      if (currentVideo && currentVideo.srcObject) {
        const tracks = currentVideo.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [startCamera]); // теперь startCamera включена в зависимости, но она мемоизирована через useCallback

  const toggleCamera = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photoBase64 = canvas.toDataURL('image/jpeg', 0.8);
    setPhotoData(photoBase64);
    setHasPhoto(true);
  };

  const retakePhoto = () => {
    setHasPhoto(false);
    setPhotoData(null);
  };

  const sendPhoto = async () => {
    if (!photoData || !tg) return;

    setIsLoading(true);
    try {
      const initData = tg.initData;
      const response = await fetch('https://telegram-camera-mini-app.vercel.app/api/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: initData,
          photo: photoData,
          timestamp: Date.now(),
          stage: '',           // этап не выбирается, отправляем пустую строку
          task_id: task_id
        }),
      });
      const result = await response.json();
      if (response.ok) {
        tg.showAlert('✅ Фото успешно отправлено!');
        tg.close();
      } else {
        tg.showAlert(`❌ Ошибка: ${result.detail || 'Неизвестная ошибка'}`);
      }
    } catch (error) {
      console.error('Ошибка при отправке:', error);
      tg.showAlert('❌ Ошибка соединения с сервером');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <div className="camera-container">
        {!hasPhoto ? (
          <>
            <video ref={videoRef} autoPlay playsInline className="video-preview" />
            <div className="camera-controls">
              <button onClick={toggleCamera} className="toggle-camera-btn" disabled={isLoading}>
                🔄 Сменить камеру
              </button>
              <button onClick={takePhoto} className="capture-btn" disabled={isLoading}>
                📸 Сделать фото
              </button>
            </div>
          </>
        ) : (
          <>
            <img src={photoData} alt="Preview" className="photo-preview" />
            <div className="button-group">
              <button onClick={retakePhoto} className="retake-btn" disabled={isLoading}>
                🔄 Переснять
              </button>
              <button 
                onClick={sendPhoto} 
                className="send-btn" 
                disabled={isLoading}
              >
                {isLoading ? '⏳ Отправка...' : '📤 Отправить'}
              </button>
            </div>
          </>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}

export default App;