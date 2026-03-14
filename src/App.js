import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const tg = window.Telegram?.WebApp;
const API_BASE = process.env.REACT_APP_API_BASE || 'https://telegram-camera-mini-app-lva4.vercel.app/api';

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [hasPhoto, setHasPhoto] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [photoData, setPhotoData] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [cameraError, setCameraError] = useState('');

  const taskId = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('task_id') || '';
  }, []);

  const stopStream = useCallback(() => {
    const stream = videoRef.current?.srcObject;
    if (!stream) return;
    stream.getTracks().forEach(track => track.stop());
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera error', error);
      const text = 'Не удалось открыть камеру. Проверьте разрешение на доступ к камере.';
      setCameraError(text);
      tg?.showAlert(text);
    }
  }, [facingMode, stopStream]);

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      tg.disableVerticalSwipes?.();
    }
    startCamera();
    return () => stopStream();
  }, [startCamera, stopStream]);

  const toggleCamera = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      tg?.showAlert('Камера ещё не готова. Попробуйте через секунду.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photoBase64 = canvas.toDataURL('image/jpeg', 0.85);
    setPhotoData(photoBase64);
    setHasPhoto(true);
  };

  const retakePhoto = () => {
    setHasPhoto(false);
    setPhotoData(null);
  };

  const sendPhoto = async () => {
    if (!taskId) {
      tg?.showAlert('Не найден task_id. Откройте задачу из Telegram ещё раз.');
      return;
    }
    if (!tg?.initData) {
      tg?.showAlert('Не удалось получить данные Telegram. Откройте mini app из бота.');
      return;
    }
    if (!photoData) {
      tg?.showAlert('Сначала сделайте фото.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/upload-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: tg.initData,
          photo: photoData,
          timestamp: Date.now(),
          task_id: taskId,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.detail || 'Неизвестная ошибка');
      }

      tg?.showAlert('✅ Фото отправлено');
      tg?.close();
    } catch (error) {
      console.error('Upload error', error);
      tg?.showAlert(`❌ ${error.message || 'Ошибка отправки'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <div className="camera-container">
        <h3>Выполнение задачи</h3>
        <p className="hint-text">Сделайте фото прямо сейчас и отправьте его через mini app.</p>
        {taskId ? <p className="task-id">Задача #{taskId}</p> : null}

        {cameraError ? <div className="error-box">{cameraError}</div> : null}

        {!hasPhoto ? (
          <>
            <video ref={videoRef} autoPlay playsInline className="video-preview" muted />
            <div className="camera-controls">
              <button onClick={toggleCamera} className="toggle-camera-btn" disabled={isLoading}>
                🔄 Сменить камеру
              </button>
              <button onClick={takePhoto} className="capture-btn" disabled={isLoading || !!cameraError}>
                📸 Сделать фото
              </button>
            </div>
          </>
        ) : (
          <>
            <img src={photoData} alt="preview" className="photo-preview" />
            <div className="button-group">
              <button onClick={retakePhoto} className="retake-btn" disabled={isLoading}>
                🔄 Переснять
              </button>
              <button onClick={sendPhoto} className="send-btn" disabled={isLoading}>
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
