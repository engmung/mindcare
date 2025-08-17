/**
 * AudioRecorder
 * 
 * 용도: 오디오 녹음 및 음성-텍스트 변환 기능 제공
 * 사용처: AIQuestionPage의 답변 입력 섹션
 * props: 
 *   - onTranscriptionComplete: 변환된 텍스트를 받는 콜백
 *   - maxDuration: 최대 녹음 시간 (초, 기본값: 300)
 */

import { useState, useRef, useEffect } from 'react';
import { transcribeAudio, isOpenAIConfigured } from '../services/openaiService';
import styles from './AudioRecorder.module.css';

const AudioRecorder = ({ onTranscriptionComplete, maxDuration = 300 }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null); // 녹음된 오디오 재생용
  const [currentAudioBlob, setCurrentAudioBlob] = useState(null); // 변환을 위한 Blob 저장

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // OpenAI API 설정 확인
  const isConfigured = isOpenAIConfigured();

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      stopRecording();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // 녹음 시간 업데이트
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxDuration - 1) {
            stopRecording();
            return maxDuration;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, isPaused, maxDuration]);

  // 마이크 권한 요청
  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return stream;
    } catch (err) {
      console.error('마이크 권한 실패:', err);
      setError('마이크 사용 권한이 필요합니다.');
      return null;
    }
  };

  // 녹음 시작
  const startRecording = async () => {
    if (!isConfigured) {
      setError('OpenAI API가 설정되지 않았습니다.');
      return;
    }

    setError(null);
    setAudioUrl(null); // 이전 오디오 URL 제거
    audioChunksRef.current = [];

    const stream = await requestMicrophonePermission();
    if (!stream) return;

    try {
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // 오디오 재생을 위한 URL 생성
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setCurrentAudioBlob(audioBlob); // Blob 저장
        
        console.log('녹음 완료:', audioBlob.size, 'bytes');
        console.log('오디오 URL 생성:', url);
        console.log('오디오 청크 수:', audioChunksRef.current.length);
        
        // 스트림 정리
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      
      setIsRecording(true);
      setRecordingTime(0);
    } catch (err) {
      console.error('녹음 실패:', err);
      setError('녹음을 시작할 수 없습니다.');
    }
  };

  // 녹음 중지
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      setRecordingTime(0);
    }
  };


  // 오디오 파일 변환
  const transcribeAudioFile = async (audioBlob) => {
    setIsTranscribing(true);
    setError(null);

    try {
      const text = await transcribeAudio(audioBlob);
      onTranscriptionComplete(text);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsTranscribing(false);
    }
  };

  // 수동 변환 함수
  const handleTranscribe = async () => {
    if (currentAudioBlob) {
      await transcribeAudioFile(currentAudioBlob);
    }
  };

  // 시간 포맷팅 (MM:SS)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // API 설정이 안된 경우
  if (!isConfigured) {
    return (
      <div className={styles.container}>
        <div className={styles.warning}>
          ⚠️ 음성 입력 기능을 사용하려면 OpenAI API 설정이 필요합니다.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {isTranscribing ? (
        <div className={styles.transcribing}>
          <div className={styles.spinner}></div>
          <span>음성을 텍스트로 변환 중...</span>
        </div>
      ) : (
        <div className={styles.controls}>
          {!isRecording ? (
            <button 
              onClick={startRecording}
              className={styles.recordButton}
              title="녹음 시작"
            >
              🎤 음성으로 답변하기
            </button>
          ) : (
            <div className={styles.recordingControls}>
              <div className={styles.recordingStatus}>
                <span className={styles.recordingDot}></span>
                <span className={styles.recordingTime}>
                  {formatTime(recordingTime)}
                </span>
              </div>
              
              <button
                onClick={stopRecording}
                className={styles.stopButton}
                title="녹음 완료"
              >
                ⏹️ 완료
              </button>
            </div>
          )}
          
          {/* 녹음된 오디오 재생 */}
          {audioUrl && !isTranscribing && (
            <div className={styles.audioPlayback}>
              <p><strong>🔊 녹음된 오디오:</strong></p>
              <audio controls src={audioUrl}>
                브라우저가 오디오를 지원하지 않습니다.
              </audio>
              <p><small>👆 먼저 재생해서 음성이 제대로 녹음되었는지 확인하세요</small></p>
              <button 
                onClick={handleTranscribe}
                className={styles.transcribeButton}
              >
                ✨ 텍스트로 변환하기
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default AudioRecorder;