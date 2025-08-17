/**
 * WriteStore
 * 
 * 용도: 자서전 작성 과정 상태 관리 (AI 질문, 답변, 목차, 원고 등)
 * 사용처: AI 질문 인터페이스, 목차 생성, 원고 작성 과정
 */

import { create } from 'zustand';
// 외부 스토어 의존성을 위한 참조 (순환 참조 방지를 위해 필요시에만 사용)
// import { useProjectStore } from './projectStore.js';

// 답변에서 형식 추출하는 헬퍼 함수
const extractFormatFromAnswer = (answer) => {
  const formatMapping = {
    '연대기': 'chronological',
    '에세이': 'essay', 
    '회고록': 'memoir',
    '인터뷰': 'interview'
  };
  
  for (const [keyword, format] of Object.entries(formatMapping)) {
    if (answer.includes(keyword)) {
      return format;
    }
  }
  
  return 'free'; // 기본값
};

// 나이 계산 헬퍼 함수
const calculateAge = (birthDate) => {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

// AI 상담 질문 생성 함수 (QuestionOrchestrator 사용)
const generateCounselingQuestion = async (userInfo, state, onEmpathyMessage) => {
  try {
    
    // QuestionOrchestrator 호출 (새로운 오케스트레이션 시스템)
    try {
      // QuestionOrchestrator import
      const OrchestratorModule = await import('../agents/QuestionOrchestrator.js');
      const OrchestratorClass = OrchestratorModule.default;
      const orchestrator = new OrchestratorClass();
      
      // 공감 메시지 콜백 설정
      if (onEmpathyMessage) {
        orchestrator.onEmpathyGenerated = onEmpathyMessage;
      }
      
      // 프로젝트 정보를 프로젝트 스토어에서 가져오기
      const projectStore = await import('./projectStore.js').then(m => m.useProjectStore.getState());
      const currentProject = projectStore.currentProject;
      
      const projectData = {
        title: currentProject?.title || '심리상담 세션',
        topic: currentProject?.data?.topic || '마음 돌보기', 
        format: currentProject?.format || 'free'
      };
      
      // 모든 대화 내역 (설정 + 일반 대화)
      const allConversations = [...state.setupConversations, ...state.conversations];
      
      console.log('writeStore - QuestionOrchestrator 호출');
      console.log('- 전체 대화 수:', allConversations.length);
      console.log('- 사용자 정보:', userInfo?.name);
      console.log('- 메모 수:', state.memos.length);
      
      const result = await orchestrator.generateQuestion(allConversations, userInfo, projectData, state.memos);
      
      console.log('writeStore - 결과:', result);
      
      // 결과가 객체 형태인 경우 question 필드 추출
      if (result && typeof result === 'object' && result.question) {
        // 메타데이터 저장하도록 확장 가능 (메모 처리는 generateQuestion에서 수행)
        return {
          question: result.question.trim(),
          empathyResponse: result.empathyResponse, // 공감 메시지 포함
          questionType: result.questionType,
          analysis: result.analysis,
          orchestratorDecision: result.orchestratorDecision,
          usedMemos: result.usedMemos || []
        };
      }
      
      // 문자열인 경우 그대로 반환
      return {
        question: result?.toString().trim() || "질문 생성에 실패했습니다.",
        questionType: 'fallback'
      };
      
    } catch (error) {
      console.error('QuestionOrchestrator 호출 실패:', error);
      
      // AI 실패 시 폴백 질문 사용
      const fallbackQuestions = [
        "오늘은 어떤 마음으로 상담을 시작하게 되셨나요?",
        "요즘 가장 마음에 걸리는 일이 있다면 무엇인가요?",
        "최근에 스트레스를 받는 상황이 있으신가요?",
        "지금 이 순간 가장 듣고 싶은 말이 있다면 무엇일까요?",
        "혼자 있을 때 어떤 생각을 가장 많이 하시나요?",
        "마음이 편안해지는 순간은 언제인가요?",
        "누군가에게 털어놓고 싶었던 이야기가 있으신가요?",
        "오늘 하루는 어떠셨나요? 특별한 일이 있었나요?",
        "지금 가장 필요한 것은 무엇이라고 생각하시나요?"
      ];
      
      const questionIndex = (state.conversations.length - 1) % fallbackQuestions.length;
      return {
        question: fallbackQuestions[questionIndex],
        questionType: 'fallback_error'
      };
    }
    
  } catch (error) {
    console.error('AI 질문 생성 실패:', error);
    return {
      question: "이전 답변에 대해 조금 더 자세히 이야기해주실 수 있나요?",
      questionType: 'error'
    };
  }
};


export const useWriteStore = create((set, get) => ({
  // 현재 질문 관련 상태
  currentQuestion: null,
  currentQuestionMetadata: null, // 오케스트레이터 메타데이터 (questionType, analysis 등)
  isGeneratingQuestion: false,
  questionError: null,
  currentQuestionType: 'setup', // 'setup' | 'autobiography'

  // 질문-답변 히스토리 (설정 질문과 자서전 질문 분리)
  setupConversations: [], // 프로젝트 설정 질문 (제목, 주제, 형식)
  conversations: [], // 자서전 질문
  
  // 메모 관련 상태
  memos: [], // 사용자가 나중에 이야기하고 싶은 주제 메모
  
  // 목차 관련 상태
  outlineOptions: [], // AI가 제안하는 3개의 목차 시안
  selectedOutline: null,
  isGeneratingOutline: false,
  outlineError: null,

  // 원고 관련 상태
  manuscript: '',
  isGeneratingManuscript: false,
  manuscriptError: null,
  manuscriptStats: {
    characterCount: 0,
    wordCount: 0,
    tokenCount: 0
  },

  // 문체 관련 상태
  availableStyles: [
    { id: 'concise', name: '간결한', description: '핵심을 명확하게 전달하는 간결한 문체' },
    { id: 'descriptive', name: '설명적인', description: '상세하고 구체적인 묘사가 풍부한 문체' },
    { id: 'formal', name: '격식있는', description: '품격 있고 정중한 격식을 갖춘 문체' },
    { id: 'friendly', name: '친근한', description: '편안하고 친밀감이 느껴지는 문체' },
    { id: 'romantic', name: '낭만적인', description: '감성적이고 서정적인 낭만적 문체' },
    { id: 'confessional', name: '고백적인', description: '솔직하고 진솔한 고백적 문체' }
  ],
  selectedStyle: null,
  isApplyingStyle: false,
  styleError: null,

  // UI 상태
  activeTab: 'question', // 'question', 'history', 'outline', 'manuscript'
  isLoading: false,

  // 질문 생성 (설정 질문 + 상담 질문) - 공감 메시지 콜백 지원
  generateQuestion: async (userInfo = null, onEmpathyMessage) => {
    set({ isGeneratingQuestion: true, questionError: null });
    
    try {
      const state = get();
      
      // 설정 질문들 (프로젝트 제목, 주제, 형식) - 상담 버전
      const setupQuestions = [
        "안녕하세요! 오늘 상담을 시작해보겠습니다. 먼저 이번 상담 세션의 이름을 정해볼까요? 편하게 지어주세요.",
        "좋은 이름이네요! 오늘 특별히 나누고 싶은 이야기가 있으신가요? 편하게 말씀해주세요."
      ];
      
      
      // 현재 단계 확인
      const setupCompleted = state.setupConversations.length;
      const counselingStarted = setupCompleted >= 2;
      
      let question;
      let questionType;
      
      if (!counselingStarted) {
        // 설정 질문 단계
        question = setupQuestions[setupCompleted];
        questionType = 'setup';
      } else {
        // 상담 질문 단계 - QuestionOrchestrator 사용 (공감 메시지 콜백 포함)
        const questionResult = await generateCounselingQuestion(userInfo, state, onEmpathyMessage);
        
        // 문자열인 경우 기본 형태로 변환
        if (typeof questionResult === 'string') {
          question = questionResult;
          questionType = 'counseling';
        } else {
          // 오케스트레이터 결과인 경우 메타데이터 포함
          question = questionResult.question;
          questionType = 'counseling';
          
          // 사용된 메모가 있으면 표시
          if (questionResult.usedMemos && questionResult.usedMemos.length > 0) {
            console.log('generateQuestion - 사용된 메모:', questionResult.usedMemos);
            
            // Zustand set을 사용하여 메모 상태 업데이트
            set((currentState) => ({
              memos: currentState.memos.map(memo => 
                questionResult.usedMemos.includes(memo.id) 
                  ? { ...memo, used: true }
                  : memo
              )
            }));
            
            // 프로젝트 스토어에도 업데이트
            import('./projectStore.js').then(({ useProjectStore }) => {
              const projectStore = useProjectStore.getState();
              if (projectStore.updateProjectData) {
                const updatedMemos = get().memos;
                projectStore.updateProjectData({ 
                  memos: updatedMemos
                });
              }
            });
          }
          
          // 메타데이터 저장
          set({ currentQuestionMetadata: questionResult });
        }
      }
      
      // 실제 AI 생성 시간 시뮬레이션
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      
      set({ 
        currentQuestion: question,
        currentQuestionType: questionType,
        isGeneratingQuestion: false 
      });
      
      return question;
    } catch (error) {
      set({ 
        questionError: error.message,
        isGeneratingQuestion: false 
      });
      throw error;
    }
  },

  // 답변 추가 (설정 질문과 자서전 질문 분리 저장)
  addAnswer: (answer) => {
    const state = get();
    if (!state.currentQuestion) return;

    const conversation = {
      id: Date.now().toString(),
      question: state.currentQuestion,
      answer: answer.trim(),
      timestamp: new Date().toISOString(),
      type: state.currentQuestionType,
      // 오케스트레이터 메타데이터 포함 (자서전 질문인 경우)
      metadata: state.currentQuestionType === 'autobiography' ? state.currentQuestionMetadata : null
    };


    // 질문 타입에 따라 다른 배열에 저장
    if (state.currentQuestionType === 'setup') {
      set((state) => ({
        setupConversations: [...state.setupConversations, conversation],
        currentQuestion: null,
        currentQuestionMetadata: null
      }));
      
      // 설정 질문이 완료되면 프로젝트 정보 업데이트
      const newSetupConversations = [...state.setupConversations, conversation];
      if (newSetupConversations.length === 2) {
        // 프로젝트 제목, 주제를 프로젝트 스토어에 저장 (형식은 기본값 사용)
        const projectData = {
          topic: newSetupConversations[1].answer,
          setupConversations: newSetupConversations
        };
        
        // 프로젝트 스토어 업데이트
        import('./projectStore.js').then(({ useProjectStore }) => {
          const projectStore = useProjectStore.getState();
          const currentProject = projectStore.currentProject;
          
          // 프로젝트 제목과 주제를 업데이트 (프로젝트 제목 = 자서전 제목)
          if (projectStore.updateProjectInfo && currentProject) {
            projectStore.updateProjectInfo(currentProject.id, {
              title: newSetupConversations[0].answer, // 프로젝트 제목을 자서전 제목으로 업데이트
              topic: newSetupConversations[1].answer
            });
          }
          
          // 설정 대화 데이터도 저장
          if (projectStore.updateProjectData) {
            projectStore.updateProjectData(projectData);
          }
        });
      } else {
        // 설정 대화 중간 저장
        import('./projectStore.js').then(({ useProjectStore }) => {
          const projectStore = useProjectStore.getState();
          if (projectStore.updateProjectData) {
            projectStore.updateProjectData({ setupConversations: newSetupConversations });
          }
        });
      }
    } else {
      const newConversations = [...state.conversations, conversation];
      set((state) => ({
        conversations: newConversations,
        currentQuestion: null,
        currentQuestionMetadata: null
      }));
      
      // 자서전 대화 저장
      import('./projectStore.js').then(({ useProjectStore }) => {
        const projectStore = useProjectStore.getState();
        if (projectStore.updateProjectData) {
          projectStore.updateProjectData({ 
            conversations: newConversations,
            setupConversations: state.setupConversations
          });
        }
      });
    }

    return conversation;
  },

  // 대화 삭제 (타입에 따라 분리)
  removeConversation: (conversationId, type = 'autobiography') => {
    set((state) => {
      let newState;
      if (type === 'setup') {
        const newSetupConversations = state.setupConversations.filter(conv => conv.id !== conversationId);
        newState = {
          setupConversations: newSetupConversations
        };
        
        // 프로젝트 스토어에도 업데이트
        import('./projectStore.js').then(({ useProjectStore }) => {
          const projectStore = useProjectStore.getState();
          if (projectStore.updateProjectData) {
            projectStore.updateProjectData({ 
              setupConversations: newSetupConversations,
              conversations: state.conversations 
            });
          }
        });
      } else {
        const newConversations = state.conversations.filter(conv => conv.id !== conversationId);
        newState = {
          conversations: newConversations
        };
        
        // 프로젝트 스토어에도 업데이트
        import('./projectStore.js').then(({ useProjectStore }) => {
          const projectStore = useProjectStore.getState();
          if (projectStore.updateProjectData) {
            projectStore.updateProjectData({ 
              conversations: newConversations,
              setupConversations: state.setupConversations 
            });
          }
        });
      }
      return newState;
    });
  },

  // 전체 대화 가져오기 (설정 + 자서전)
  getAllConversations: () => {
    const state = get();
    
    // 중복 ID 방지를 위해 Set을 사용하여 고유한 대화만 포함
    const seenIds = new Set();
    const allConversations = [];
    
    // 설정 대화 먼저 추가
    for (const conv of state.setupConversations) {
      if (!seenIds.has(conv.id)) {
        seenIds.add(conv.id);
        allConversations.push(conv);
      }
    }
    
    // 자서전 대화 추가 (중복 ID 스킵)
    for (const conv of state.conversations) {
      if (!seenIds.has(conv.id)) {
        seenIds.add(conv.id);
        allConversations.push(conv);
      }
    }
    
    return allConversations;
  },

  // 목차 시안 생성
  generateOutlineOptions: async (formatType) => {
    set({ isGeneratingOutline: true, outlineError: null });
    
    try {
      // 기존 OutlineAgent 활용
      const OutlineAgent = await import('../agents/OutlineAgent.js');
      const agent = new OutlineAgent.default();
      
      const state = get();
      
      // 3개의 다른 목차 시안 생성
      const options = [];
      for (let i = 0; i < 3; i++) {
        const outline = await agent.generateOutline({
          format_type: formatType,
          conversations: state.conversations,
          option_number: i + 1
        });
        options.push({
          id: `option_${i + 1}`,
          ...outline
        });
      }
      
      set({ 
        outlineOptions: options,
        isGeneratingOutline: false 
      });
      
      return options;
    } catch (error) {
      set({ 
        outlineError: error.message,
        isGeneratingOutline: false 
      });
      throw error;
    }
  },

  // 목차 선택
  selectOutline: (outlineId) => {
    const state = get();
    const selected = state.outlineOptions.find(option => option.id === outlineId);
    
    if (selected) {
      set({ selectedOutline: selected });
      
      // 프로젝트 스토어에도 업데이트
      // const { useProjectStore } = await import('./projectStore.js');
      // const projectStore = useProjectStore?.getState?.();
      // if (projectStore?.updateProjectData) {
      //   projectStore.updateProjectData({ outline: selected });
      // }
    }
  },

  // 원고 생성
  generateManuscript: async () => {
    set({ isGeneratingManuscript: true, manuscriptError: null });
    
    try {
      // 기존 ManuscriptAgent 활용
      const ManuscriptAgent = await import('../agents/ManuscriptAgent.js');
      const agent = new ManuscriptAgent.default();
      
      const state = get();
      const manuscript = await agent.generateManuscript({
        conversations: state.conversations,
        outline: state.selectedOutline
      });
      
      // 통계 계산
      const stats = {
        characterCount: manuscript.length,
        wordCount: manuscript.split(/\s+/).filter(word => word.length > 0).length,
        tokenCount: Math.ceil(manuscript.length / 2) // 대략적인 토큰 수
      };
      
      set({ 
        manuscript,
        manuscriptStats: stats,
        isGeneratingManuscript: false 
      });
      
      // 프로젝트 스토어에도 업데이트
      // const { useProjectStore } = await import('./projectStore.js');
      // const projectStore = useProjectStore?.getState?.();
      // if (projectStore?.updateProjectData) {
      //   projectStore.updateProjectData({ manuscript });
      // }
      
      return manuscript;
    } catch (error) {
      set({ 
        manuscriptError: error.message,
        isGeneratingManuscript: false 
      });
      throw error;
    }
  },

  // 문체 적용
  applyStyle: async (styleId, customInstructions = '') => {
    set({ isApplyingStyle: true, styleError: null });
    
    try {
      const state = get();
      const style = state.availableStyles.find(s => s.id === styleId);
      
      if (!style) {
        throw new Error('선택한 문체를 찾을 수 없습니다.');
      }

      // 문체 적용 로직 (추후 에이전트 구현)
      // 현재는 선택만 저장
      set({ 
        selectedStyle: { ...style, customInstructions },
        isApplyingStyle: false 
      });
      
      return style;
    } catch (error) {
      set({ 
        styleError: error.message,
        isApplyingStyle: false 
      });
      throw error;
    }
  },

  // 탭 변경
  setActiveTab: (tab) => set({ activeTab: tab }),

  // 로딩 상태 설정
  setLoading: (isLoading) => set({ isLoading }),

  // 질문 새로고침
  refreshCurrentQuestion: async () => {
    return get().generateQuestion();
  },

  // 작성 데이터 초기화
  resetWriteData: () => set({
    currentQuestion: null,
    currentQuestionType: 'setup',
    setupConversations: [],
    conversations: [],
    outlineOptions: [],
    selectedOutline: null,
    manuscript: '',
    selectedStyle: null,
    memos: [], // 메모도 초기화
    manuscriptStats: {
      characterCount: 0,
      wordCount: 0,
      tokenCount: 0
    },
    activeTab: 'question'
  }),

  // 프로젝트 데이터 로드
  loadProjectData: (projectData) => {
    if (projectData) {
      set({
        setupConversations: projectData.setupConversations || [],
        conversations: projectData.conversations || [],
        selectedOutline: projectData.outline || null,
        manuscript: projectData.manuscript || '',
        selectedStyle: projectData.selectedStyle || null,
        memos: projectData.memos || [], // 메모 데이터 로드
        manuscriptStats: projectData.manuscript ? {
          characterCount: projectData.manuscript.length,
          wordCount: projectData.manuscript.split(/\s+/).filter(word => word.length > 0).length,
          tokenCount: Math.ceil(projectData.manuscript.length / 2)
        } : {
          characterCount: 0,
          wordCount: 0,
          tokenCount: 0
        }
      });
    }
  },

  // 진행률 계산 (설정 + 자서전 질문 포함)
  getWritingProgress: () => {
    const state = get();
    let progress = 0;
    
    // 설정 질문 단계 (20%)
    progress += (state.setupConversations.length / 2) * 20;
    
    // 자서전 질문-답변 단계 (40%)
    if (state.conversations.length >= 5) progress += 40;
    else progress += (state.conversations.length / 5) * 40;
    
    // 목차 선택 (20%)
    if (state.selectedOutline) progress += 20;
    
    // 원고 생성 (20%)
    if (state.manuscript) progress += 20;
    
    return Math.round(progress);
  },

  // 완성도 체크 (설정 질문 포함)
  isReadyForNextStep: (step) => {
    const state = get();
    
    switch (step) {
      case 'autobiography':
        return state.setupConversations.length >= 2; // 설정 질문 2개 완료
      case 'outline':
        return state.conversations.length >= 3; // 최소 3개 자서전 질문-답변
      case 'manuscript':
        return state.selectedOutline !== null;
      case 'style':
        return state.manuscript !== '';
      case 'complete':
        return state.selectedStyle !== null;
      default:
        return false;
    }
  },

  // 메모 관련 메서드들
  addMemo: (content) => {
    if (!content || !content.trim()) return null;
    
    const newMemo = {
      id: Date.now().toString(),
      content: content.trim(),
      createdAt: new Date().toISOString(),
      used: false
    };
    
    set((state) => ({
      memos: [...state.memos, newMemo]
    }));
    
    // 프로젝트 스토어에도 저장
    import('./projectStore.js').then(({ useProjectStore }) => {
      const projectStore = useProjectStore.getState();
      if (projectStore.updateProjectData) {
        projectStore.updateProjectData({ 
          memos: [...get().memos]
        });
      }
    });
    
    return newMemo;
  },
  
  removeMemo: (memoId) => {
    set((state) => ({
      memos: state.memos.filter(memo => memo.id !== memoId)
    }));
    
    // 프로젝트 스토어에도 업데이트
    import('./projectStore.js').then(({ useProjectStore }) => {
      const projectStore = useProjectStore.getState();
      if (projectStore.updateProjectData) {
        projectStore.updateProjectData({ 
          memos: get().memos
        });
      }
    });
  },
  
  markMemoAsUsed: (memoId) => {
    set((state) => ({
      memos: state.memos.map(memo => 
        memo.id === memoId ? { ...memo, used: true } : memo
      )
    }));
    
    // 프로젝트 스토어에도 업데이트
    import('./projectStore.js').then(({ useProjectStore }) => {
      const projectStore = useProjectStore.getState();
      if (projectStore.updateProjectData) {
        projectStore.updateProjectData({ 
          memos: get().memos
        });
      }
    });
  },
  
  clearUsedMemos: () => {
    set((state) => ({
      memos: state.memos.filter(memo => !memo.used)
    }));
    
    // 프로젝트 스토어에도 업데이트
    import('./projectStore.js').then(({ useProjectStore }) => {
      const projectStore = useProjectStore.getState();
      if (projectStore.updateProjectData) {
        projectStore.updateProjectData({ 
          memos: get().memos
        });
      }
    });
  },
  
  getUnusedMemos: () => {
    const state = get();
    return state.memos.filter(memo => !memo.used);
  }
}));

// 순환 참조 방지를 위해 주석 처리