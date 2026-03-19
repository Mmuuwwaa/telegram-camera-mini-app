import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const tg = window.Telegram?.WebApp;
const maxWebApp = window.WebApp;

const API_BASE =
  process.env.REACT_APP_API_BASE || 'https://telegram-camera-mini-app-lva4.vercel.app/api';

function getTaskIdFromStartParam(startParam) {
  if (!startParam) return '';
  if (startParam.startsWith('task_')) return startParam.replace('task_', '');
  return '';
}

function getMaxStartParam() {
  try {
    if (maxWebApp?.initDataUnsafe?.start_param) {
      return String(maxWebApp.initDataUnsafe.start_param);
    }
  } catch {}

  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('WebAppStartParam') || '';
}

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [hasPhoto, setHasPhoto] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [photoData, setPhotoData] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [cameraError, setCameraError] = useState('');

  const isTelegram = !!tg;
  const isMax = !!maxWebApp && !tg;

  const urlParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const maxStartParam = useMemo(() => getMaxStartParam(), []);

  const taskId = useMemo(() => {
    const fromQuery = urlParams.get('task_id') || '';
    if (fromQuery) return fromQuery;
    return getTaskIdFromStartParam(maxStartParam);
  }, [urlParams, maxStartParam]);

  const taskTitle = useMemo(() => {
    const raw = urlParams.get('task_title') || '';
    try {
      return decodeURIComponent(raw).trim();
    } catch {
      return raw.trim();
    }
  }, [urlParams]);

  const showAlert = (text) => {
    if (isTelegram) return tg?.showAlert(text);
    if (isMax && maxWebApp?.showAlert) return maxWebApp.showAlert(text);
    window.alert(text);
  };

  const closeApp = () => {
    if (isTelegram) return tg?.close();
    if (isMax && maxWebApp?.close) return maxWebApp.close();
  };

  const stopStream = useCallback(() => {
    const stream = videoRef.current?.srcObject;
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
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
      showAlert(text);
    }
  }, [facingMode, stopStream]);

  useEffect(() => {
    try {
      if (isTelegram) {
        tg.ready();
        tg.expand();
        tg.disableVerticalSwipes?.();
      }
      if (isMax) {
        maxWebApp?.ready?.();
        maxWebApp?.expand?.();
      }
    } catch {}

    startCamera();
    return () => stopStream();
  }, [isTelegram, isMax, startCamera, stopStream]);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      showAlert('Камера ещё не готова. Попробуйте через секунду.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      showAlert('Не удалось подготовить фото.');
      return;
    }

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
      showAlert('Не найден task_id. Откройте задачу из бота ещё раз.');
      return;
    }

    const initData = isTelegram ? tg?.initData : maxWebApp?.initData;
    if (!initData) {
      showAlert('Не удалось получить данные платформы. Откройте mini app из бота.');
      return;
    }

    if (!photoData) {
      showAlert('Сначала сделайте фото.');
      return;
    }

    const endpoint = isMax ? `${API_BASE}/upload-photo-max` : `${API_BASE}/upload-photo`;

    setIsLoading(true);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData,
          photo: photoData,
          timestamp: Date.now(),
          task_id: taskId,
        }),
      });

      const rawText = await response.text();

      let result = {};
      try {
        result = rawText ? JSON.parse(rawText) : {};
      } catch {
        result = { detail: rawText || 'Сервер вернул некорректный ответ' };
      }

      if (!response.ok) {
        throw new Error(result.detail || `HTTP ${response.status}`);
      }

      showAlert('✅ Фото отправлено');
      closeApp();
    } catch (error) {
      console.error('Upload error', error);
      showAlert(`❌ ${error.message || 'Ошибка отправки'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <div className="camera-container">
        <h3>{taskTitle || 'Выполнение задачи'}</h3>

        {cameraError ? <div className="error-box">{cameraError}</div> : null}

        {!hasPhoto ? (
          <>
            <video ref={videoRef} autoPlay playsInline className="video-preview" muted />
            <div className="camera-controls">
              <button
                onClick={toggleCamera}
                className="toggle-camera-btn"
                disabled={isLoading}
              >
                🔄 Сменить камеру
              </button>
              <button
                onClick={takePhoto}
                className="capture-btn"
                disabled={isLoading || !!cameraError}
              >
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