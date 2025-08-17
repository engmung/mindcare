/**
 * AIQuestionPage
 *
 * 용도: AI 상담 대화 페이지
 * 사용처: /project/:projectId/questions 경로
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUserStore } from "../stores/userStore";
import { useProjectStore } from "../stores/projectStore";
import { useWriteStore } from "../stores/writeStore";
import { transcribeAudio, isOpenAIConfigured } from "../services/openaiService";
import { isAudioRecordingSupported } from "../utils/audioUtils";
import styles from "./AIQuestionPage.module.css";

const AIQuestionPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  const { userInfo } = useUserStore();
  const {
    currentProject,
    selectProject,
    updateProjectData,
    updateProjectStep,
  } = useProjectStore();
  const {
    currentQuestion,
    conversations,
    isGeneratingQuestion,
    generateQuestion,
    addAnswer,
    getAllConversations,
    loadProjectData,
  } = useWriteStore();

  const [inputValue, setInputValue] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputMode, setInputMode] = useState('text'); // 'text' or 'voice'
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const messagesEndRef = useRef(null);
  const loadedProjectIdRef = useRef(null);
  const isFirstQuestionGeneratedRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 메시지 추가 함수들을 먼저 정의
  const addBotMessage = useCallback((text) => {
    setChatMessages(prev => [...prev, {
      type: 'bot',
      text,
      timestamp: new Date().toISOString()
    }]);
  }, []);

  const addUserMessage = useCallback((text) => {
    setChatMessages(prev => [...prev, {
      type: 'user',
      text,
      timestamp: new Date().toISOString()
    }]);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // 프로젝트 체크
  useEffect(() => {
    if (projectId && (!currentProject || currentProject.id !== projectId)) {
      selectProject(projectId);
    }
  }, [projectId, currentProject, selectProject]);

  // 프로젝트 데이터 로드
  useEffect(() => {
    if (
      currentProject &&
      currentProject.data &&
      loadedProjectIdRef.current !== currentProject.id
    ) {
      loadProjectData(currentProject.data);
      loadedProjectIdRef.current = currentProject.id;
      
      // 기존 대화가 있는지 확인
      const hasExistingConversations = currentProject.data.conversations && 
                                       currentProject.data.conversations.length > 0;
      
      if (hasExistingConversations) {
        // 기존 대화가 있으면 첫 질문 생성 방지
        isFirstQuestionGeneratedRef.current = true;
        
        // 기존 대화 내역을 채팅 메시지로 변환
        const existingMessages = [];
        let lastQuestionNeedsAnswer = false;
        
        currentProject.data.conversations.forEach((conv, index) => {
          existingMessages.push({
            type: 'bot',
            text: conv.question,
            timestamp: conv.timestamp
          });
          if (conv.answer) {
            existingMessages.push({
              type: 'user',
              text: conv.answer,
              timestamp: conv.timestamp
            });
          } else if (index === currentProject.data.conversations.length - 1) {
            // 마지막 질문에 답변이 없는 경우
            lastQuestionNeedsAnswer = true;
          }
        });
        
        setChatMessages(existingMessages);
        
        // 마지막 질문에 답변이 없으면 입력 대기, 있으면 새 질문 생성
        if (!lastQuestionNeedsAnswer && currentProject.data.conversations.length > 0) {
          // 답변이 모두 있으면 새 질문 생성 (인사 없이)
          setTimeout(() => {
            setIsTyping(true);
            generateQuestion(userInfo, (empathyMessage) => {
              if (empathyMessage) {
                setIsTyping(false);
                addBotMessage(empathyMessage);
                setTimeout(() => setIsTyping(true), 500);
              }
            }).then(() => setIsTyping(false))
              .catch(error => {
                console.error('질문 생성 실패:', error);
                setIsTyping(false);
              });
          }, 1000);
        }
      } else {
        // 새 프로젝트인 경우 첫 질문 생성 준비
        isFirstQuestionGeneratedRef.current = false;
      }
    }
  }, [currentProject, loadProjectData, userInfo, generateQuestion, addBotMessage]);

  const generateFirstQuestion = useCallback(async () => {
    setIsTyping(true);
    try {
      await generateQuestion(userInfo, (empathyMessage) => {
        // 첫 질문에서는 공감 메시지가 필요 없으므로 무시
      });
      setIsTyping(false);
    } catch (error) {
      console.error("질문 생성 실패:", error);
      setIsTyping(false);
      addBotMessage("죄송해요, 질문을 준비하는 중에 문제가 발생했어요. 다시 시도해주세요.");
    }
  }, [generateQuestion, userInfo, addBotMessage]);

  // 첫 질문 생성 (새 프로젝트인 경우에만)
  useEffect(() => {
    if (
      currentProject &&
      !currentQuestion &&
      !isGeneratingQuestion &&
      !isFirstQuestionGeneratedRef.current &&
      conversations.length === 0 // 실제 대화 기록이 없을 때만
    ) {
      isFirstQuestionGeneratedRef.current = true;
      
      // 초기 인사 메시지
      setTimeout(() => {
        addBotMessage(`안녕하세요, ${userInfo?.nickname || ''}님! 오늘 상담을 시작해볼까요? 😊`);
        setTimeout(() => {
          generateFirstQuestion();
        }, 1500);
      }, 500);
    }
  }, [currentProject?.id, currentQuestion, isGeneratingQuestion, conversations.length, userInfo, addBotMessage, generateFirstQuestion]);

  // 새로운 질문이 생성되면 채팅에 추가
  useEffect(() => {
    if (currentQuestion && !chatMessages.find(msg => msg.text === currentQuestion)) {
      addBotMessage(currentQuestion);
    }
  }, [currentQuestion]);

  const handleSendMessage = async (messageText) => {
    const message = messageText || inputValue.trim();
    if (!message || isTyping) return;
    addUserMessage(message);
    setInputValue('');
    
    // 1. 즉시 타이핑 인디케이터 표시
    setIsTyping(true);

    try {
      // 2. 답변 저장
      addAnswer(message);

      // 3. 질문 생성 (공감 메시지 콜백 포함)
      await generateQuestion(userInfo, (empathyMessage) => {
        // 공감 메시지 즉시 표시
        if (empathyMessage) {
          setIsTyping(false);
          addBotMessage(empathyMessage);
          
          // 다시 타이핑 인디케이터 표시 (질문 생성 중)
          setTimeout(() => setIsTyping(true), 500);
        }
      });
      
      // 4. 질문 생성 완료
      setIsTyping(false);
    } catch (error) {
      console.error("답변 처리 실패:", error);
      setIsTyping(false);
      addBotMessage("죄송해요, 문제가 발생했어요. 다시 시도해주세요.");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 음성 녹음 시작
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudioToText(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('녹음 시작 실패:', error);
      
      // 보안 컨텍스트 문제인 경우 안내
      if (window.location.protocol === 'http:' && 
          window.location.hostname !== 'localhost' && 
          window.location.hostname !== '127.0.0.1') {
        alert('음성 녹음은 HTTPS 연결에서만 사용 가능합니다.\n로컬 개발: localhost를 사용하세요.\n모바일 테스트: 라즈베리파이 서버를 사용하세요.');
      } else {
        alert('마이크 권한을 허용해주세요.');
      }
    }
  };

  // 음성 녹음 종료
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // 음성을 텍스트로 변환 (전송하지 않고 입력 필드에만 표시)
  const transcribeAudioToText = async (audioBlob) => {
    setIsTranscribing(true);
    try {
      const result = await transcribeAudio(audioBlob);
      if (result.success && result.text) {
        setInputValue(result.text);
        // 입력 필드에 포커스
        setTimeout(() => {
          const inputField = document.querySelector('textarea.messageInput');
          if (inputField) {
            inputField.focus();
            // 커서를 텍스트 끝으로 이동
            inputField.setSelectionRange(result.text.length, result.text.length);
          }
        }, 100);
      } else {
        alert('음성 인식에 실패했습니다. 다시 시도해주세요.');
      }
    } catch (error) {
      console.error('음성 인식 실패:', error);
      alert('음성 인식 중 오류가 발생했습니다.');
    } finally {
      setIsTranscribing(false);
    }
  };

  // 음성 버튼 클릭 핸들러
  const handleVoiceClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleProceedToOutline = () => {
    // 대화 데이터 저장 및 단계 업데이트
    updateProjectData({
      conversations: getAllConversations(),
    });
    updateProjectStep(projectId, 6);

    // 완료 메시지
    addBotMessage("상담 내용을 정리하고 있습니다... 📝");
    
    setTimeout(() => {
      navigate("/outline-selection", {
        state: {
          conversations: getAllConversations(),
          projectId: projectId,
        },
      });
    }, 1500);
  };

  const canProceed = conversations.length >= 5; // 최소 5개 이상의 대화

  return (
    <div className={styles.chatContainer}>
      {/* 채팅 헤더 */}
      <div className={styles.chatHeader}>
        <button 
          onClick={() => navigate('/projects')} 
          className={styles.backButton}
        >
          ←
        </button>
        <div className={styles.headerContent}>
          <h2>{currentProject?.title || '상담 중'}</h2>
          <span className={styles.conversationCount}>
            {conversations.length}개의 대화
          </span>
        </div>
        {canProceed && (
          <button
            onClick={handleProceedToOutline}
            className={styles.completeButton}
          >
            상담 정리
          </button>
        )}
      </div>

      {/* 채팅 메시지 영역 */}
      <div className={styles.messagesArea}>
        {chatMessages.map((message, index) => (
          <div 
            key={index} 
            className={`${styles.message} ${styles[message.type]}`}
          >
            {message.type === 'bot' && (
              <div className={styles.avatar}>🤖</div>
            )}
            <div className={styles.messageContent}>
              {message.text}
            </div>
            {message.type === 'user' && (
              <div className={styles.avatar}>👤</div>
            )}
          </div>
        ))}
        
        {isTyping && (
          <div className={`${styles.message} ${styles.bot}`}>
            <div className={styles.avatar}>🤖</div>
            <div className={styles.typingIndicator}>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>


      {/* 입력 영역 */}
      <div className={styles.inputArea}>
        {/* 모드 전환 버튼 - OpenAI 키가 없어도 UI는 표시 */}
        {isAudioRecordingSupported() && (
          <button
            onClick={() => {
              if (!isOpenAIConfigured()) {
                alert('음성 인식을 사용하려면 OpenAI API 키가 필요합니다.\n.env 파일에 VITE_OPENAI_API_KEY를 설정해주세요.');
                return;
              }
              setInputMode(inputMode === 'text' ? 'voice' : 'text');
            }}
            className={styles.modeToggleButton}
            title={inputMode === 'text' ? '음성 모드로 전환' : '텍스트 모드로 전환'}
          >
            {inputMode === 'text' ? '🎤' : '⌨️'}
          </button>
        )}

        {/* 텍스트 입력 모드 */}
        {inputMode === 'text' ? (
          <>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="마음 편하게 이야기해주세요..."
              className={styles.messageInput}
              disabled={isTyping}
              rows={1}
            />
            <button 
              onClick={() => handleSendMessage()}
              className={styles.sendButton}
              disabled={isTyping || !inputValue.trim()}
            >
              전송
            </button>
          </>
        ) : (
          /* 음성 입력 모드 - 모바일 최적화 레이아웃 */
          <div className={styles.voiceModeContainer}>
            <div className={styles.voiceTextArea}>
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="음성 인식 결과가 여기에 표시됩니다..."
                className={`${styles.messageInput} messageInput`}
                disabled={isTyping || isTranscribing}
                rows={2}
              />
              <button 
                onClick={() => handleSendMessage()}
                className={styles.sendButton}
                disabled={isTyping || !inputValue.trim() || isTranscribing}
              >
                전송
              </button>
            </div>
            <div className={styles.voiceButtonArea}>
              <button
                onClick={handleVoiceClick}
                className={`${styles.voiceButton} ${isRecording ? styles.recording : ''}`}
                disabled={isTranscribing || isTyping}
              >
                <div className={styles.voiceButtonInner}>
                  {isTranscribing ? (
                    <span className={styles.transcribingIcon}>...</span>
                  ) : isRecording ? (
                    <span className={styles.stopIcon}>⏹️</span>
                  ) : (
                    <span className={styles.micIcon}>🎤</span>
                  )}
                </div>
              </button>
              <p className={styles.voiceHint}>
                {isRecording ? '녹음 중... 클릭하여 종료' : 
                 isTranscribing ? '텍스트 변환 중...' : 
                 inputValue ? '텍스트를 확인하고 수정 후 전송하세요' :
                 '클릭하여 녹음 시작'}
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default AIQuestionPage;