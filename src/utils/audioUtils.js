/**
 * 오디오 관련 유틸리티 함수
 */

/**
 * 브라우저의 오디오 녹음 지원 여부 확인
 * @returns {boolean} 지원 여부
 */
export function isAudioRecordingSupported() {
  // 기본 API 지원 확인
  const hasBasicSupport = !!(
    navigator.mediaDevices &&
    navigator.mediaDevices.getUserMedia &&
    window.MediaRecorder
  );
  
  // HTTPS 또는 localhost인지 확인 (getUserMedia 실제 작동 조건)
  const isSecureContext = window.isSecureContext || 
                          window.location.protocol === 'https:' || 
                          window.location.hostname === 'localhost' ||
                          window.location.hostname === '127.0.0.1';
  
  // API는 지원하지만 보안 컨텍스트가 아닌 경우 (개발 환경)
  if (hasBasicSupport && !isSecureContext) {
    // UI는 표시하되 경고 메시지를 준비
    return true; // UI 표시를 위해 true 반환
  }
  
  return hasBasicSupport;
}

/**
 * 사용 가능한 오디오 MIME 타입 확인
 * @returns {string|null} 사용 가능한 MIME 타입
 */
export function getSupportedMimeType() {
  const types = [
    'audio/webm',
    'audio/mp4',
    'audio/ogg',
    'audio/wav'
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return null;
}

/**
 * 오디오 Blob 크기 확인 (MB 단위)
 * @param {Blob} blob - 오디오 Blob
 * @returns {number} 크기 (MB)
 */
export function getAudioSizeMB(blob) {
  return blob.size / (1024 * 1024);
}

/**
 * 오디오 파일 크기 검증 (OpenAI 제한: 25MB)
 * @param {Blob} blob - 오디오 Blob
 * @returns {boolean} 유효 여부
 */
export function isValidAudioSize(blob) {
  const maxSizeMB = 25;
  return getAudioSizeMB(blob) <= maxSizeMB;
}

/**
 * 브라우저별 오디오 권한 상태 확인
 * @returns {Promise<string>} 'granted' | 'denied' | 'prompt'
 */
export async function checkMicrophonePermission() {
  try {
    const result = await navigator.permissions.query({ name: 'microphone' });
    return result.state;
  } catch (error) {
    // 일부 브라우저는 permissions API를 지원하지 않음
    console.warn('Permissions API not supported:', error);
    return 'prompt';
  }
}

/**
 * 오디오 스트림 정리
 * @param {MediaStream} stream - 미디어 스트림
 */
export function cleanupAudioStream(stream) {
  if (stream && stream.getTracks) {
    stream.getTracks().forEach(track => {
      track.stop();
    });
  }
}

/**
 * 오디오 녹음 설정 생성
 * @returns {Object} MediaRecorder 옵션
 */
export function getRecorderOptions() {
  const mimeType = getSupportedMimeType();
  
  const options = {
    audioBitsPerSecond: 128000, // 128kbps
  };

  if (mimeType) {
    options.mimeType = mimeType;
  }

  return options;
}

/**
 * 녹음 시간 제한 확인
 * @param {number} seconds - 녹음 시간 (초)
 * @param {number} maxSeconds - 최대 허용 시간 (초)
 * @returns {boolean} 제한 시간 내 여부
 */
export function isWithinTimeLimit(seconds, maxSeconds = 300) {
  return seconds <= maxSeconds;
}

/**
 * 오디오 Blob을 Base64로 변환
 * @param {Blob} blob - 오디오 Blob
 * @returns {Promise<string>} Base64 문자열
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 오디오 품질 설정 가져오기
 * @param {string} quality - 'low' | 'medium' | 'high'
 * @returns {Object} MediaRecorder 제약 조건
 */
export function getAudioConstraints(quality = 'medium') {
  const constraints = {
    low: {
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    },
    medium: {
      audio: {
        sampleRate: 24000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    },
    high: {
      audio: {
        sampleRate: 48000,
        channelCount: 2,
        echoCancellation: true,
        noiseSuppression: true
      }
    }
  };

  return constraints[quality] || constraints.medium;
}