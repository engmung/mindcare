/**
 * QuestionOrchestrator
 * 
 * 용도: 질문 생성 플로우를 관리하는 오케스트레이터
 * 사용처: AIQuestionPage에서 질문 생성 시 사용
 * 기능: 답변 분석 후 후속질문 vs 주제전환 결정
 */

import QuestionAgent from './QuestionAgent.js';
import TopicTransitionAgent from './TopicTransitionAgent.js';
import { loadPromptWithTemplate } from '../utils/promptLoader.js';
import geminiService from '../services/geminiService.js';

class QuestionOrchestrator {
  constructor() {
    this.questionAgent = new QuestionAgent();
    this.topicTransitionAgent = new TopicTransitionAgent();
    this.onEmpathyGenerated = null; // 공감 메시지 콜백
    
    // Function Calling용 함수 정의 (공감 메시지 필드 추가)
    this.analysisFunctions = [
      {
        name: 'analyzeConversationFlow',
        description: '대화 흐름을 분석하여 공감 메시지 생성 및 다음 질문 전략 결정',
        parameters: {
          type: 'object',
          properties: {
            empathyResponse: {
              type: 'string',
              description: '내담자 답변에 대한 즉각적인 공감 메시지'
            },
            shouldTransition: {
              type: 'boolean',
              description: '주제 전환이 필요한지 여부'
            },
            transitionReason: {
              type: 'string',
              description: '전환이 필요한 구체적 이유'
            },
            nextAgentType: {
              type: 'string',
              enum: ['followup', 'transition'],
              description: '다음에 사용할 에이전트 타입'
            },
            analysisDetails: {
              type: 'object',
              properties: {
                consecutiveQuestions: { type: 'number' },
                emotionalEngagement: { type: 'string' },
                explorationDepth: { type: 'string' },
                recommendedFocus: { type: 'string' }
              },
              description: '상세 분석 결과'
            }
          },
          required: ['empathyResponse', 'shouldTransition', 'transitionReason', 'nextAgentType', 'analysisDetails']
        }
      }
    ];
  }

  /**
   * 메인 질문 생성 메서드
   * @param {Array} conversations - 대화 내역
   * @param {Object} userInfo - 사용자 정보
   * @param {Object} projectInfo - 프로젝트 정보
   * @param {Array} memos - 사용자 메모
   * @returns {Object} 생성된 질문과 메타데이터
   */
  async generateQuestion(conversations = [], userInfo = null, projectInfo = null, memos = []) {
    try {
      // 1. Function Calling을 통한 AI 분석
      const aiAnalysis = await this.performAIAnalysis(conversations, userInfo, projectInfo);
      
      console.log('QuestionOrchestrator - AI 분석 결과:', aiAnalysis);

      // 공감 메시지를 즉시 콜백으로 전달
      if (aiAnalysis.empathyResponse && this.onEmpathyGenerated) {
        console.log('QuestionOrchestrator - 공감 메시지 즉시 전달:', aiAnalysis.empathyResponse);
        this.onEmpathyGenerated(aiAnalysis.empathyResponse);
      }

      // 2. AI 분석 결과에 따른 에이전트 선택 및 질문 생성
      let result;
      if (aiAnalysis.shouldTransition) {
        console.log('QuestionOrchestrator - 주제 전환 모드');
        result = await this.topicTransitionAgent.generateTransitionQuestion(
          conversations, 
          userInfo, 
          projectInfo, 
          aiAnalysis,
          memos
        );
        result.questionType = 'transition';
      } else {
        console.log('QuestionOrchestrator - 후속 질문 모드');
        result = await this.questionAgent.generateFollowUpQuestion(
          conversations, 
          userInfo, 
          projectInfo, 
          aiAnalysis
        );
        result.questionType = 'followup';
      }

      // 3. 결과에 메타데이터 추가
      return {
        ...result,
        empathyResponse: aiAnalysis.empathyResponse, // 공감 메시지 포함
        analysis: aiAnalysis,
        orchestratorDecision: aiAnalysis.nextAgentType
      };

    } catch (error) {
      console.error('QuestionOrchestrator 오류:', error);
      
      // 에러 시 기존 분석 방식으로 폴백
      try {
        const fallbackAnalysis = this.analyzeCurrentState(conversations);
        console.log('QuestionOrchestrator - 폴백 분석:', fallbackAnalysis);
        
        let result;
        if (fallbackAnalysis.shouldTransition) {
          result = await this.topicTransitionAgent.generateTransitionQuestion(
            conversations, userInfo, projectInfo, fallbackAnalysis
          );
          result.questionType = 'transition';
        } else {
          result = await this.questionAgent.generateFollowUpQuestion(
            conversations, userInfo, projectInfo, fallbackAnalysis
          );
          result.questionType = 'followup';
        }
        
        return {
          ...result,
          analysis: fallbackAnalysis,
          orchestratorDecision: fallbackAnalysis.shouldTransition ? 'transition' : 'followup',
          fallbackUsed: true
        };
      } catch (fallbackError) {
        return {
          question: '죄송합니다. 질문 생성 중 오류가 발생했습니다.',
          success: false,
          error: fallbackError.message,
          questionType: 'error'
        };
      }
    }
  }

  /**
   * Function Calling을 통한 AI 분석 수행
   */
  async performAIAnalysis(conversations, userInfo, projectInfo) {
    try {
      // 최근 3-5개 대화 준비
      const recentConversations = conversations.slice(-5);
      const conversationsText = recentConversations.map((conv, index) => 
        `${index + 1}. 질문: ${conv.question}\n   답변: ${conv.answer || '(답변 대기중)'}`
      ).join('\n\n');

      // 사용자 정보 간단 요약
      const userInfoText = this.summarizeUserInfo(userInfo);

      // 현재 주제 및 연속 질문 수 계산
      const currentTopic = this.identifyCurrentTopic(recentConversations);
      const consecutiveQuestions = this.countConsecutiveQuestions(recentConversations, currentTopic);

      // 프롬프트 템플릿 변수
      const templateVars = {
        USER_INFO: userInfoText,
        PROJECT_TITLE: projectInfo?.title || '자서전 프로젝트',
        PROJECT_TOPIC: projectInfo?.topic || '인생 이야기',
        PROJECT_FORMAT: projectInfo?.format || '연대기순',
        CURRENT_TOPIC: currentTopic,
        CONSECUTIVE_COUNT: consecutiveQuestions
      };

      // 프롬프트 로드 (새로운 파일명)
      const promptBase = await loadPromptWithTemplate('counseling-orchestrator.md', templateVars);

      if (!promptBase) {
        throw new Error('오케스트레이터 프롬프트 파일을 불러올 수 없습니다.');
      }

      // 대화 내역을 프롬프트 끝에 추가
      const prompt = `${promptBase}\n${conversationsText || '대화 없음'}`;

      // Function Calling API 호출
      const systemInstruction = `당신은 전문 심리상담 수퍼바이저입니다. 
      내담자의 답변에 대한 공감 메시지를 생성하고, 대화 패턴을 분석하여 다음 질문 전략을 결정하세요.
      반드시 analyzeConversationFlow 함수를 호출하여 결과를 반환하세요.`;

      const response = await geminiService.generateWithFunctions(
        prompt,
        this.analysisFunctions,
        systemInstruction
      );

      if (!response.success || !response.functionCalls || response.functionCalls.length === 0) {
        throw new Error('Function Calling 분석 실패: ' + (response.error || '함수 호출 없음'));
      }

      // 첫 번째 함수 호출 결과 사용
      const analysisResult = response.functionCalls[0];
      if (analysisResult.name !== 'analyzeConversationFlow') {
        throw new Error('예상하지 못한 함수 호출: ' + analysisResult.name);
      }

      return {
        ...analysisResult.args,
        // 기존 분석 결과와 호환성을 위한 필드 추가
        currentTopic,
        consecutiveQuestions,
        reason: analysisResult.args.transitionReason,
        empathyResponse: analysisResult.args.empathyResponse || '' // 공감 메시지
      };

    } catch (error) {
      console.error('AI 분석 오류:', error);
      throw error;
    }
  }

  /**
   * 사용자 정보 간단 요약
   */
  summarizeUserInfo(userInfo) {
    if (!userInfo) return '사용자 정보 없음';
    
    const parts = [];
    if (userInfo.name) parts.push(`이름: ${userInfo.name}`);
    if (userInfo.birthDate) {
      const age = this.calculateAge(userInfo.birthDate);
      if (age) parts.push(`나이: ${age}세`);
    }
    if (userInfo.careerHistory) parts.push(`직업: ${userInfo.careerHistory}`);
    
    return parts.length > 0 ? parts.join(', ') : '사용자 정보 없음';
  }

  /**
   * 나이 계산 헬퍼
   */
  calculateAge(birthDate) {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * 현재 대화 상황을 분석하여 전환 필요성 판단
   * @param {Array} conversations - 대화 내역
   * @returns {Object} 분석 결과
   */
  analyzeCurrentState(conversations) {
    if (!conversations || conversations.length === 0) {
      return {
        shouldTransition: false,
        reason: 'first_question',
        consecutiveQuestions: 0,
        responseLength: 0,
        emotionalEngagement: 'unknown'
      };
    }

    // 최근 3-5개 대화 분석
    const recentConversations = conversations.slice(-5);
    const currentTopic = this.identifyCurrentTopic(recentConversations);
    
    // 1. 연속 질문 개수 (같은 주제)
    const consecutiveQuestions = this.countConsecutiveQuestions(recentConversations, currentTopic);
    
    // 2. 답변 길이 변화 분석
    const lengthAnalysis = this.analyzeLengthTrend(recentConversations);
    
    // 3. 감정적 참여도 분석
    const emotionalAnalysis = this.analyzeEmotionalEngagement(recentConversations);

    // 4. 전환 필요성 판단
    const shouldTransition = this.decideShouldTransition(
      consecutiveQuestions,
      lengthAnalysis,
      emotionalAnalysis
    );

    return {
      shouldTransition,
      reason: this.getTransitionReason(consecutiveQuestions, lengthAnalysis, emotionalAnalysis),
      consecutiveQuestions,
      currentTopic,
      lengthTrend: lengthAnalysis.trend,
      responseLength: lengthAnalysis.currentLength,
      emotionalEngagement: emotionalAnalysis.level,
      details: {
        lengthAnalysis,
        emotionalAnalysis
      }
    };
  }

  /**
   * 현재 주제 식별
   */
  identifyCurrentTopic(conversations) {
    if (conversations.length === 0) return 'unknown';
    
    // 최근 질문들에서 키워드 추출하여 주제 판단
    const recentQuestions = conversations.slice(-3).map(c => c.question).join(' ');
    
    const topicKeywords = {
      family: ['가족', '부모', '형제', '자매', '어머니', '아버지'],
      childhood: ['어린', '유년', '초등학교', '어릴 때', '학교'],
      education: ['학교', '공부', '대학', '교육', '선생님'],
      career: ['직업', '회사', '일', '직장', '커리어'],
      relationship: ['친구', '연인', '결혼', '사랑', '인간관계'],
      hobby: ['취미', '좋아하는', '즐기는', '여가'],
      values: ['가치관', '신념', '철학', '생각', '중요한']
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => recentQuestions.includes(keyword))) {
        return topic;
      }
    }

    return 'general';
  }

  /**
   * 연속 질문 개수 계산
   */
  countConsecutiveQuestions(conversations, currentTopic) {
    let count = 0;
    for (let i = conversations.length - 1; i >= 0; i--) {
      const questionTopic = this.identifyCurrentTopic([conversations[i]]);
      if (questionTopic === currentTopic || questionTopic === 'general') {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  /**
   * 답변 길이 변화 추세 분석
   */
  analyzeLengthTrend(conversations) {
    const lengths = conversations
      .filter(c => c.answer && c.answer.trim())
      .map(c => c.answer.trim().length);

    if (lengths.length < 2) {
      return {
        trend: 'stable',
        currentLength: lengths[0] || 0,
        changePercent: 0
      };
    }

    const currentLength = lengths[lengths.length - 1];
    const previousLength = lengths[lengths.length - 2];
    const changePercent = previousLength === 0 ? 0 : ((currentLength - previousLength) / previousLength) * 100;

    let trend = 'stable';
    if (changePercent < -40) trend = 'declining';
    else if (changePercent > 40) trend = 'increasing';

    return {
      trend,
      currentLength,
      previousLength,
      changePercent: Math.round(changePercent)
    };
  }

  /**
   * 감정적 참여도 분석
   */
  analyzeEmotionalEngagement(conversations) {
    if (conversations.length === 0) {
      return { level: 'unknown', score: 0 };
    }

    const recentAnswers = conversations
      .slice(-3)
      .filter(c => c.answer && c.answer.trim())
      .map(c => c.answer);

    if (recentAnswers.length === 0) {
      return { level: 'low', score: 0 };
    }

    let score = 0;
    const totalAnswers = recentAnswers.length;

    recentAnswers.forEach(answer => {
      // 구체적 디테일 (점수 +1)
      if (answer.length > 100) score += 1;
      
      // 감정 표현 키워드 (점수 +1)
      const emotionKeywords = ['기뻤', '슬펐', '화났', '놀랐', '감동', '기억에 남', '인상적', '소중한'];
      if (emotionKeywords.some(keyword => answer.includes(keyword))) score += 1;
      
      // 구체적 시간/장소/인물 (점수 +1)
      if (answer.match(/\d{4}년|\d+살|그때|당시|어릴때/)) score += 1;
      
      // 반복적이거나 단순한 답변 (점수 -1)
      if (answer.length < 20 || answer.includes('그냥') || answer.includes('별로')) score -= 1;
    });

    const averageScore = score / totalAnswers;
    let level = 'medium';
    if (averageScore < 0.5) level = 'low';
    else if (averageScore > 1.5) level = 'high';

    return {
      level,
      score: Math.round(averageScore * 10) / 10
    };
  }

  /**
   * 전환 필요성 최종 판단 (더 엄격한 기준 적용)
   */
  decideShouldTransition(consecutiveQuestions, lengthAnalysis, emotionalAnalysis) {
    // 필수 조건 체크: 연속 질문이 6개 이상
    const hasEnoughQuestions = consecutiveQuestions >= 6;
    
    // 필수 조건 체크: 답변 길이가 급격히 감소 (연속 2회, 60% 이상 감소)
    const hasSignificantDecline = lengthAnalysis.trend === 'declining' && 
                                  lengthAnalysis.changePercent < -60;
    
    // 필수 조건 중 하나라도 충족되지 않으면 전환 안함
    if (!hasEnoughQuestions && !hasSignificantDecline) {
      return false;
    }
    
    // 추가 조건들 체크
    let additionalConditions = 0;
    
    // 감정적 참여도가 현저히 저하
    if (emotionalAnalysis.level === 'low') {
      additionalConditions++;
    }
    
    // 답변 길이가 계속 감소 중
    if (lengthAnalysis.trend === 'declining' && lengthAnalysis.changePercent < -40) {
      additionalConditions++;
    }
    
    // 연속 질문이 많으면서 참여도도 저하
    if (consecutiveQuestions >= 6 && emotionalAnalysis.level !== 'high') {
      additionalConditions++;
    }

    // 필수 조건 1개 + 추가 조건 1개 이상 충족시에만 전환
    const hasRequiredCondition = hasEnoughQuestions || hasSignificantDecline;
    return hasRequiredCondition && additionalConditions >= 1;
  }

  /**
   * 전환 이유 설명 (새로운 기준 반영)
   */
  getTransitionReason(consecutiveQuestions, lengthAnalysis, emotionalAnalysis) {
    if (consecutiveQuestions >= 6 && emotionalAnalysis.level === 'low') {
      return 'consecutive_questions_with_low_engagement';
    }
    if (lengthAnalysis.trend === 'declining' && lengthAnalysis.changePercent < -60) {
      return 'significant_response_decline';
    }
    if (consecutiveQuestions >= 6) {
      return 'too_many_consecutive_questions';
    }
    if (emotionalAnalysis.level === 'low' && lengthAnalysis.trend === 'declining') {
      return 'multiple_decline_indicators';
    }
    return 'continue_current_topic';
  }
}

export default QuestionOrchestrator;