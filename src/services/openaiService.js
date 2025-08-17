/**
 * OpenAI API 서비스
 * 
 * 용도: OpenAI Whisper API를 사용한 음성-텍스트 변환
 * 주요 기능: 오디오 파일을 텍스트로 변환
 */

import OpenAI from 'openai';

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // 브라우저에서 사용하기 위해 필요
});

/**
 * 오디오 파일을 텍스트로 변환
 * @param {Blob} audioBlob - 녹음된 오디오 Blob
 * @param {string} filename - 파일명 (기본값: audio.webm)
 * @returns {Promise<string>} 변환된 텍스트
 */
export async function transcribeAudio(audioBlob, filename = 'audio.webm') {
  try {
    console.log('오디오 크기:', audioBlob.size, 'bytes');
    
    // Blob을 File 객체로 변환
    const audioFile = new File([audioBlob], filename, { 
      type: audioBlob.type || 'audio/webm' 
    });

    // 간단하게 Whisper API 호출
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'ko' // 한국어 명시
    });

    console.log('변환 결과:', transcription);
    
    // Whisper API는 객체를 반환하므로 text 속성 추출
    const text = typeof transcription === 'string' ? transcription : transcription.text;
    console.log('추출된 텍스트:', text);
    
    // 일관된 객체 형태로 반환
    return {
      success: true,
      text: text
    };
  } catch (error) {
    console.error('음성 변환 오류:', error);
    
    // 에러 타입에 따른 구체적인 메시지
    if (error.status === 401) {
      throw new Error('OpenAI API 키가 유효하지 않습니다. 설정을 확인해주세요.');
    } else if (error.status === 429) {
      throw new Error('API 사용량 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
    } else if (error.status === 413) {
      throw new Error('오디오 파일이 너무 큽니다. 더 짧게 녹음해주세요.');
    } else {
      throw new Error('음성을 텍스트로 변환하는 중 오류가 발생했습니다.');
    }
    
    // 에러 발생 시에도 일관된 형태로 반환
    return {
      success: false,
      text: '',
      error: error.message
    };
  }
}

/**
 * API 키 유효성 검사
 * @returns {boolean} API 키 존재 여부
 */
export function isOpenAIConfigured() {
  return !!import.meta.env.VITE_OPENAI_API_KEY && 
         import.meta.env.VITE_OPENAI_API_KEY !== 'your-openai-api-key-here';
}

/**
 * 지원되는 오디오 형식 확인
 * @param {string} mimeType - MIME 타입
 * @returns {boolean} 지원 여부
 */
export function isSupportedAudioFormat(mimeType) {
  const supportedFormats = [
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/mpga',
    'audio/m4a',
    'audio/wav',
    'audio/ogg'
  ];
  
  return supportedFormats.includes(mimeType);
}