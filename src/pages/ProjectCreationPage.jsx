/**
 * ProjectCreationPage
 * 
 * 용도: 상담 세션 생성 및 주제 선택 페이지
 * 사용처: /project/create 경로
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { useProjectStore } from '../stores/projectStore';
import styles from './ProjectCreationPage.module.css';

const ProjectCreationPage = () => {
  const navigate = useNavigate();
  const { userInfo } = useUserStore();
  const { createProject, updateProjectData } = useProjectStore();

  const [currentStep, setCurrentStep] = useState('greeting'); // greeting, title, format, topic
  const [projectTitle, setProjectTitle] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('');
  const [topic, setTopic] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  useEffect(() => {
    // 초기 인사 메시지
    setTimeout(() => {
      addBotMessage(`안녕하세요, ${userInfo?.nickname}님! 😊`);
      setTimeout(() => {
        addBotMessage('오늘은 어떤 마음으로 찾아주셨나요?');
        setTimeout(() => {
          addBotMessage('먼저 이번 상담 세션의 이름을 정해볼까요? 편하게 입력해주세요.');
        }, 1000);
      }, 800);
    }, 500);
  }, []);

  // 상담 형식별 정보
  const formats = [
    {
      id: 'free',
      name: '자유 대화',
      description: '편안하게 하고 싶은 이야기를 나누는 방식',
      icon: '💬',
      color: '#6b5b95'
    },
    {
      id: 'emotion',
      name: '감정 탐색',
      description: '현재 느끼는 감정을 깊이 탐구하는 상담',
      icon: '❤️',
      color: '#88b0d3'
    },
    {
      id: 'solution',
      name: '해결 중심',
      description: '구체적인 문제 해결을 위한 상담',
      icon: '💡',
      color: '#7fb069'
    },
    {
      id: 'growth',
      name: '성장 탐구',
      description: '개인의 성장과 발전을 위한 상담',
      icon: '🌱',
      color: '#f7b267'
    }
  ];

  const addBotMessage = (text, options = []) => {
    setChatMessages(prev => [...prev, {
      type: 'bot',
      text,
      options,
      timestamp: new Date().toISOString()
    }]);
  };

  const addUserMessage = (text) => {
    setChatMessages(prev => [...prev, {
      type: 'user',
      text,
      timestamp: new Date().toISOString()
    }]);
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const message = inputValue.trim();
    addUserMessage(message);
    setInputValue('');
    setIsTyping(true);

    // 단계별 처리
    setTimeout(() => {
      setIsTyping(false);
      
      if (currentStep === 'greeting') {
        setProjectTitle(message);
        addBotMessage(`"${message}" 좋은 이름이네요! 😊`);
        setTimeout(() => {
          addBotMessage('어떤 방식으로 대화하고 싶으신가요?');
          setTimeout(() => {
            addBotMessage('원하시는 상담 스타일을 선택해주세요:', 
              formats.map(f => ({ id: f.id, text: `${f.icon} ${f.name}`, value: f.id }))
            );
            setCurrentStep('format');
          }, 800);
        }, 600);
      } else if (currentStep === 'topic') {
        setTopic(message);
        handleCreateProject(message);
      }
    }, 1000);
  };

  const handleOptionClick = (optionValue) => {
    if (currentStep === 'format') {
      const format = formats.find(f => f.id === optionValue);
      setSelectedFormat(optionValue);
      addUserMessage(`${format.icon} ${format.name}`);
      setIsTyping(true);
      
      setTimeout(() => {
        setIsTyping(false);
        addBotMessage(`${format.name} 방식으로 진행하겠습니다.`);
        setTimeout(() => {
          addBotMessage('오늘 특별히 나누고 싶은 이야기가 있으신가요?');
          addBotMessage('없으시다면 "편하게 시작"이라고 입력해주세요.');
          setCurrentStep('topic');
        }, 800);
      }, 1000);
    }
  };

  const handleCreateProject = async (topicMessage) => {
    setIsTyping(true);

    try {
      // 기본값 설정
      const finalFormat = selectedFormat || 'free';
      const finalTopic = topicMessage || '편안한 대화';
      
      // 프로젝트 생성
      const newProject = createProject(projectTitle.trim(), finalFormat);
      
      // 프로젝트 데이터에 주제 추가
      updateProjectData({
        topic: finalTopic
      });

      // 성공 메시지 표시 후 AI 질문 페이지로 이동
      setTimeout(() => {
        setIsTyping(false);
        addBotMessage('좋아요! 상담을 시작할 준비가 되었습니다. 🎈');
        setTimeout(() => {
          navigate(`/project/${newProject.id}/questions`);
        }, 1500);
      }, 1000);
    } catch (error) {
      console.error('프로젝트 생성 실패:', error);
      setIsTyping(false);
      addBotMessage('죄송해요, 문제가 발생했어요. 다시 시도해주세요.');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

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
        <h2>새 상담 시작</h2>
      </div>

      {/* 채팅 메시지 영역 */}
      <div className={styles.messagesArea}>
        {chatMessages.map((message, index) => (
          <div 
            key={index} 
            className={`${styles.message} ${styles[message.type]}`}
          >
            <div className={styles.messageContent}>
              {message.text}
            </div>
            {message.options && message.options.length > 0 && (
              <div className={styles.optionsGrid}>
                {message.options.map((option, idx) => (
                  <button
                    key={idx}
                    className={styles.optionButton}
                    onClick={() => handleOptionClick(option.value)}
                  >
                    {option.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        
        {isTyping && (
          <div className={`${styles.message} ${styles.bot}`}>
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
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="메시지를 입력하세요..."
          className={styles.messageInput}
          disabled={isTyping || currentStep === 'format'}
        />
        <button 
          onClick={handleSendMessage}
          className={styles.sendButton}
          disabled={isTyping || !inputValue.trim() || currentStep === 'format'}
        >
          전송
        </button>
      </div>
    </div>
  );
};

export default ProjectCreationPage;