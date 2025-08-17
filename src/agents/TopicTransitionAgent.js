/**
 * TopicTransitionAgent
 * 
 * 용도: 주제 전환 및 새로운 주제 영역 제안
 * 사용처: QuestionOrchestrator에서 주제 전환이 필요할 때 호출
 * 기능: 자서전에 필요한 다양한 인생 영역을 균형있게 커버
 */

import { loadPromptWithTemplate } from '../utils/promptLoader.js';
import geminiService, { schemas } from '../services/geminiService.js';

class TopicTransitionAgent {
  constructor() {
    // 자서전에 포함되어야 할 주요 주제 영역들 - 다양성 확장
    this.topicAreas = {
      childhood: {
        name: '유년기와 성장',
        keywords: ['어린시절', '가족', '첫 기억', '놀이', '학교 입학', '부모님', '형제자매'],
        description: '어린 시절의 소중한 기억들과 성장 과정',
        subTopics: ['가족의 영향', '첫 학교 경험', '어린 시절 꿈', '놀이와 친구들']
      },
      education: {
        name: '교육과 학습',  
        keywords: ['학교생활', '공부', '선생님', '친구', '성적', '진로', '대학', '전공'],
        description: '학창시절의 경험과 배움의 여정',
        subTopics: ['인상 깊은 선생님', '학창시절 도전', '전공 선택', '학교 밖 배움']
      },
      relationships: {
        name: '인간관계',
        keywords: ['친구', '연인', '결혼', '동료', '멘토', '갈등', '만남', '이별'],
        description: '인생을 함께한 소중한 사람들과의 이야기',
        subTopics: ['평생 친구', '첫사랑', '결혼과 가정', '직장 동료', '인생의 멘토', '어려운 관계']
      },
      career: {
        name: '직업과 커리어',
        keywords: ['첫 직장', '승진', '이직', '창업', '성취', '실패', '동료', '상사'],
        description: '직업적 성장과 커리어의 변화',
        subTopics: ['첫 직장 적응', '커리어 전환', '창업 경험', '직장 내 성취', '일과 삶의 균형']
      },
      challenges: {
        name: '시련과 극복',
        keywords: ['어려움', '실패', '극복', '성장', '교훈', '변화', '위기', '좌절'],
        description: '인생의 고비와 그것을 극복한 경험',
        subTopics: ['경제적 어려움', '건강 문제', '인간관계 갈등', '실패에서 배운 것', '인생의 전환점']
      },
      hobbies: {
        name: '취미와 여가',
        keywords: ['취미', '여행', '독서', '운동', '문화생활', '특기', '음악', '예술'],
        description: '삶을 풍요롭게 만든 취미와 관심사들',
        subTopics: ['특별한 여행', '좋아하는 책/영화', '운동과 건강', '예술 활동', '새로운 도전']
      },
      values: {
        name: '가치관과 철학',
        keywords: ['신념', '가치관', '철학', '종교', '인생관', '목표', '원칙', '신앙'],
        description: '삶을 이끌어온 가치관과 신념',
        subTopics: ['인생 철학', '종교와 신앙', '도덕적 기준', '삶의 우선순위', '사회적 신념']
      },
      achievements: {
        name: '성취와 자부심',
        keywords: ['성공', '성취', '자랑스러운', '보람', '인정', '상', '수상', '칭찬'],
        description: '인생에서 이룬 성취와 보람찾던 순간들',
        subTopics: ['학업 성취', '직업적 성공', '개인적 성장', '사회적 인정', '가족 내 성취']
      },
      community: {
        name: '사회와 공동체',
        keywords: ['봉사', '사회활동', '공동체', '이웃', '기부', '사회문제', '참여'],
        description: '사회 구성원으로서의 활동과 기여',
        subTopics: ['봉사 활동', '사회 참여', '공동체 기여', '이웃과의 관계', '사회 문제 관심']
      },
      health: {
        name: '건강과 웰빙',
        keywords: ['건강', '운동', '다이어트', '병원', '치료', '회복', '몸관리', '정신건강'],
        description: '신체적, 정신적 건강과 관련된 경험들',
        subTopics: ['건강 관리', '질병 극복', '운동 습관', '정신적 성장', '스트레스 관리']
      },
      culture: {
        name: '문화와 예술',
        keywords: ['문화', '예술', '전통', '축제', '공연', '전시', '창작', '감상'],
        description: '문화적 경험과 예술적 감성',
        subTopics: ['전통 문화', '현대 예술', '창작 활동', '문화 체험', '예술적 영감']
      },
      future: {
        name: '현재와 미래',
        keywords: ['현재', '미래', '계획', '꿈', '목표', '희망', '변화', '전망'],
        description: '현재의 삶과 앞으로의 계획',
        subTopics: ['현재 상황', '미래 계획', '꿈과 목표', '후세에게 남기고 싶은 것', '인생의 지혜']
      }
    };
  }

  /**
   * 주제 전환 질문 생성 - 단순화된 버전
   * @param {Array} conversations - 대화 내역
   * @param {Object} userInfo - 사용자 정보
   * @param {Object} projectInfo - 프로젝트 정보
   * @param {Object} analysis - 오케스트레이터 분석 결과
   * @param {Array} memos - 사용자 메모 (옵션)
   * @returns {Object} 생성된 전환 질문
   */
  async generateTransitionQuestion(conversations = [], userInfo = null, projectInfo = null, analysis = {}, memos = []) {
    try {
      // 프롬프트 생성 및 API 호출 - 복잡한 로직 제거
      const result = await this.generateTopicTransitionPrompt(
        conversations,
        userInfo,
        projectInfo,
        analysis,
        memos
      );

      return {
        ...result,
        transitionReason: analysis.reason
      };

    } catch (error) {
      console.error('TopicTransitionAgent 오류:', error);
      return {
        question: this.getDefaultTransitionQuestion(),
        success: false,
        error: error.message
      };
    }
  }

  // 복잡한 주제 선택 로직 제거 - AI가 프롬프트에서 직접 판단하도록 변경

  /**
   * 주제 전환 프롬프트 생성 및 API 호출 - 단순화된 버전
   */
  async generateTopicTransitionPrompt(conversations, userInfo, projectInfo, analysis, memos = []) {
    // 전체 대화 컨텍스트 제공 (AI가 직접 분석하도록)
    const conversationsText = conversations.map((conv, index) => 
      `${index + 1}. 질문: ${conv.question}\n   답변: ${conv.answer || '(답변 대기중)'}`
    ).join('\n\n');

    // 사용자 정보 간단 요약
    const userInfoText = this.summarizeUserInfo(userInfo);

    // 메모 텍스트 생성
    const memosText = this.formatMemos(memos);

    // 프롬프트 템플릿 변수 - 단순화
    const templateVars = {
      USER_INFO: userInfoText,
      USER_MEMOS: memosText,
      TRANSITION_REASON: this.getTransitionReasonText(analysis.reason),
      PROJECT_TITLE: projectInfo?.title || '자서전 프로젝트'
    };

    // 프롬프트 로드 (새로운 파일명)
    const promptBase = await loadPromptWithTemplate('empathic-transition.md', templateVars);

    if (!promptBase) {
      throw new Error('주제 전환 프롬프트 파일을 불러올 수 없습니다.');
    }

    // 대화 내역을 프롬프트 끝에 추가
    const prompt = `${promptBase}\n${conversationsText || '대화 없음'}`;

    // Gemini API 호출
    const systemInstruction = `당신은 자서전 작성을 위한 주제 전환 전문가입니다. 
    지금까지의 모든 대화를 분석하여 아직 다뤄지지 않은 인생 영역에 대해 자연스럽게 전환하는 질문을 생성하세요.
    다양한 자서전 완성을 위해 균형잡힌 주제 선택이 중요합니다.
    사용자가 메모해둔 주제들이 있다면 우선적으로 고려하세요.`;

    const response = await geminiService.generateStructured(
      prompt,
      'question',
      systemInstruction
    );

    if (!response.success) {
      // Fallback to text generation
      console.warn('Structured output failed, falling back to text generation');
      const fallbackResponse = await geminiService.generate(prompt, systemInstruction);
      
      if (!fallbackResponse.success) {
        throw new Error(fallbackResponse.error || '주제 전환 질문 생성에 실패했습니다.');
      }
      
      // 폴백에서도 사용된 메모 확인
      const usedMemos = this.identifyUsedMemos(fallbackResponse.text, memos);
      
      return {
        question: fallbackResponse.text.trim(),
        success: true,
        usedMemos: usedMemos
      };
    }

    // 사용된 메모가 있는지 확인하여 반환
    const usedMemos = this.identifyUsedMemos(response.data.question, memos);
    
    return {
      ...response.data,
      success: true,
      usedMemos: usedMemos
    };
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
    if (userInfo.hobbies) parts.push(`취미: ${userInfo.hobbies}`);
    
    return parts.length > 0 ? parts.join(', ') : '사용자 정보 없음';
  }

  /**
   * 전환 이유 텍스트 변환
   */
  getTransitionReasonText(reason) {
    const reasonTexts = {
      'too_many_consecutive': '같은 주제에 대해 충분히 이야기했으므로',
      'response_length_drop': '답변이 짧아져서 새로운 자극이 필요하므로',
      'low_engagement': '관심도가 낮아 보여서 다른 주제를 시도하므로',
      'multiple_factors': '여러 요인으로 주제 전환이 필요하므로'
    };
    
    return reasonTexts[reason] || '새로운 주제를 탐색하기 위해';
  }

  /**
   * 기본 전환 질문 (에러 시 사용)
   */
  getDefaultTransitionQuestion() {
    const defaultQuestions = [
      "인생에서 특별히 기억에 남는 순간이 있다면 들려주세요.",
      "지금까지 이야기하지 않은 소중한 경험이 있나요?",
      "당신에게 특별한 의미가 있는 사람이나 경험에 대해 들려주세요.",
      "인생에서 가장 보람을 느꼈던 순간은 언제인가요?"
    ];
    
    const randomIndex = Math.floor(Math.random() * defaultQuestions.length);
    return defaultQuestions[randomIndex];
  }

  /**
   * 메모 포맷팅 - 가장 오래된 미사용 메모 1개만 제공
   */
  formatMemos(memos) {
    if (!memos || memos.length === 0) {
      return '저장된 메모 없음';
    }
    
    // 사용되지 않은 메모 중 가장 오래된 것 1개만 선택
    const unusedMemos = memos
      .filter(memo => !memo.used)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    if (unusedMemos.length === 0) {
      return '사용 가능한 메모 없음 (모든 메모가 이미 사용됨)';
    }
    
    const oldestMemo = unusedMemos[0];
    
    return `**사용자가 이야기하고 싶어하는 주제:**\n"${oldestMemo.content}"\n\n이 주제를 자연스럽게 대화로 이끌어내는 질문을 만들어주세요.`;
  }

  /**
   * 사용된 메모 식별 - 가장 오래된 미사용 메모 1개를 자동으로 사용됨으로 표시
   */
  identifyUsedMemos(question, memos) {
    if (!memos || memos.length === 0) {
      return [];
    }
    
    // 사용되지 않은 메모 중 가장 오래된 것 찾기
    const unusedMemos = memos
      .filter(memo => !memo.used)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    if (unusedMemos.length === 0) {
      return [];
    }
    
    // 가장 오래된 메모가 제공되었으므로 사용된 것으로 간주
    return [unusedMemos[0].id];
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
}

export default TopicTransitionAgent;