import { loadPromptWithTemplate } from '../utils/promptLoader.js';
import geminiService, { schemas } from '../services/geminiService.js';
import { loadOutlineData } from '../utils/dataManager.js';
import detailQuestionAgent from './DetailQuestionAgent.js';

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

class QuestionAgent {
  async generateQuestion(conversations = [], userInfo = null, projectInfo = null) {
    // 항상 기본 질문 생성 모드 사용 (사용자 정보 활용)
    console.log('QuestionAgent - 기본 질문 생성 모드 (사용자 정보 활용)');
    return await this.generateBasicQuestion(conversations, userInfo, projectInfo);
  }

  // 후속 질문 생성 (QuestionOrchestrator에서 호출)
  async generateFollowUpQuestion(conversations = [], userInfo = null, projectInfo = null, analysis = {}) {
    try {
      console.log('QuestionAgent - 후속 질문 생성 모드');
      
      // 직전 1-2개 대화에만 집중
      const recentConversations = conversations.slice(-2);
      const conversationsText = recentConversations.map((conv, index) => 
        `${index + 1}. 질문: ${conv.question}\n   답변: ${conv.answer || '(답변 대기중)'}`
      ).join('\n\n');

      // 사용자 정보 간단 요약 (집착 줄이기)
      const userInfoText = this.summarizeUserInfoForFollowUp(userInfo);

      // 후속 질문용 프롬프트 템플릿 변수
      const templateVars = {
        USER_INFO: userInfoText,
        PROJECT_TITLE: projectInfo?.title || '상담 세션',
        PROJECT_TOPIC: projectInfo?.topic || '일상과 고민',
        PROJECT_FORMAT: projectInfo?.format || '주제별 정리형',
        AGE: userInfo?.birthDate ? calculateAge(userInfo.birthDate) : '나이',
        JOB: userInfo?.careerHistory || '직업',
        HOBBY: userInfo?.hobbies || '취미'
      };

      const promptBase = await loadPromptWithTemplate('counseling-question-generator.md', templateVars);

      if (!promptBase) {
        throw new Error('후속 질문 프롬프트 파일을 불러올 수 없습니다.');
      }

      // 대화 내역을 프롬프트 끝에 추가
      const prompt = `${promptBase}\n${conversationsText}`;

      console.log('QuestionAgent - 후속 질문 프롬프트:', prompt);

      // Structured Gemini API 호출
      const systemInstruction = `당신은 자서전 작성을 위한 질문 생성 전문가입니다. 
      이전 답변에서 언급된 특정 부분을 더 깊이 탐구하는 자연스러운 후속 질문을 생성하세요.
      직전 대화의 흐름과 감정에 집중하며, 사용자가 자신의 이야기에서 긍정적인 의미를 발견하도록 도와주세요.`;
      
      const response = await geminiService.generateStructured(
        prompt,
        'question',
        systemInstruction
      );
      
      if (!response.success) {
        // Fallback to text generation
        console.warn('Structured output failed, falling back to text generation');
        const fallbackResponse = await geminiService.generate(prompt);
        
        if (!fallbackResponse.success) {
          throw new Error(fallbackResponse.error || '후속 질문 생성에 실패했습니다.');
        }
        
        return {
          question: fallbackResponse.text.trim(),
          success: true,
          isFollowUp: true
        };
      }

      return {
        ...response.data,
        success: true,
        isFollowUp: true
      };

    } catch (error) {
      console.error('QuestionAgent 후속 질문 오류:', error);
      
      // 에러 시 기본 질문으로 폴백
      return await this.generateBasicQuestion(conversations, userInfo, projectInfo);
    }
  }

  // 목차 기반 상세 질문 생성
  async generateDetailQuestion(conversations, outlineData) {
    try {
      const result = await detailQuestionAgent.generateDetailQuestion(conversations, outlineData);
      return result;
    } catch (error) {
      console.error('DetailQuestionAgent 실패, 기본 모드로 fallback:', error);
      return await this.generateBasicQuestion(conversations, userInfo, projectInfo);
    }
  }

  // 기본 질문 생성 (기존 로직)
  async generateBasicQuestion(conversations = [], userInfo = null, projectInfo = null) {
    try {
      // 대화 데이터를 문자열로 정리 (첫 질문은 제외하고 이전 대화들만)
      const conversationsText = conversations.map((conv, index) => 
        `${index + 1}. 질문: ${conv.question}\n   답변: ${conv.answer || '(답변 대기중)'}`
      ).join('\n\n');

      // 사용자 정보 구성 (유효한 정보만 포함)
      const userInfoParts = [];
      
      if (userInfo) {
        if (userInfo.name) userInfoParts.push(`- 이름: ${userInfo.name}`);
        if (userInfo.nickname && userInfo.nickname !== userInfo.name) userInfoParts.push(`- 별명: ${userInfo.nickname}`);
        if (userInfo.birthDate) {
          const age = calculateAge(userInfo.birthDate);
          if (age) userInfoParts.push(`- 나이: ${age}세`);
        }
        if (userInfo.gender) userInfoParts.push(`- 성별: ${userInfo.gender}`);
        if (userInfo.birthPlace) userInfoParts.push(`- 출생지: ${userInfo.birthPlace}`);
        if (userInfo.residenceHistory) userInfoParts.push(`- 거주 이력: ${userInfo.residenceHistory}`);
        if (userInfo.militaryStatus) userInfoParts.push(`- 군대: ${userInfo.militaryStatus}`);
        if (userInfo.careerHistory) userInfoParts.push(`- 직업/경력: ${userInfo.careerHistory}`);
        if (userInfo.education) userInfoParts.push(`- 교육: ${userInfo.education}`);
        if (userInfo.hobbies) userInfoParts.push(`- 취미: ${userInfo.hobbies}`);
        if (userInfo.religion) userInfoParts.push(`- 종교: ${userInfo.religion}`);
        
        // 가족 구성 (유효한 정보만)
        if (userInfo.familyMembers?.length > 0) {
          const validFamily = userInfo.familyMembers
            .filter(f => f.relationship && f.name && f.relationship !== 'undefined' && f.name !== 'undefined')
            .map(f => `${f.relationship}(${f.name}${f.age && f.age !== 'undefined' ? ', ' + f.age + '세' : ''})`)
            .join(', ');
          if (validFamily) userInfoParts.push(`- 가족 구성: ${validFamily}`);
        }
        
        if (userInfo.socialCircle) userInfoParts.push(`- 사회적 관계: ${userInfo.socialCircle}`);
      }
      
      const userInfoText = userInfoParts.length > 0 ? userInfoParts.join('\n') : '사용자 정보 없음';

      // 프롬프트 로드 및 템플릿 적용 (통합 프롬프트 사용)
      const templateVars = {
        USER_INFO: userInfoText,
        PROJECT_TITLE: projectInfo?.title || '상담 세션',
        PROJECT_TOPIC: projectInfo?.topic || '일상과 고민',
        PROJECT_FORMAT: projectInfo?.format || '주제별 정리형',
        AGE: userInfo?.birthDate ? calculateAge(userInfo.birthDate) : '나이',
        JOB: userInfo?.careerHistory || '직업',
        HOBBY: userInfo?.hobbies || '취미'
      };

      const promptBase = await loadPromptWithTemplate('counseling-question-generator.md', templateVars);

      if (!promptBase) {
        throw new Error('프롬프트 파일을 불러올 수 없습니다.');
      }

      // 대화 내역을 프롬프트 끝에 추가
      const prompt = `${promptBase}\n${conversationsText || '아직 대화 없음'}`;

      console.log('🚀 최종 프롬프트:');
      console.log(prompt);

      // Structured Gemini API 호출
      const systemInstruction = `당신은 심리상담 대화 전문가입니다.
      
      중요 원칙:
      1. 대화 초반(1-5번): 구체적이고 일상적인 질문만 하세요. 추상적 질문 금지.
      2. 대화 중반(6-10번): 구체적 상황과 간단한 감정을 탐색하세요.
      3. 대화 후반(11번 이후): 비로소 깊은 감정과 의미를 탐색할 수 있습니다.
      
      현재 대화 횟수: ${conversations.length + 1}번째
      
      반드시 "무엇", "언제", "어디서", "누구와", "어떻게" 같은 구체적 질문을 우선하고,
      "왜", "의미", "감정" 같은 추상적 질문은 충분한 라포 형성 후에만 사용하세요.`;
      
      const response = await geminiService.generateStructured(
        prompt,
        'question', // 스키마 이름을 문자열로 전달
        systemInstruction
      );
      
      if (!response.success) {
        // Fallback to original method if structured fails
        console.warn('Structured output failed, falling back to text generation');
        const fallbackResponse = await geminiService.generate(prompt);
        
        if (!fallbackResponse.success) {
          throw new Error(fallbackResponse.error || '질문 생성에 실패했습니다.');
        }
        
        let question = fallbackResponse.text.trim();
        if (question.startsWith('다음 질문:')) {
          question = question.replace('다음 질문:', '').trim();
        }
        
        return {
          question,
          success: true,
          isDetailQuestion: false
        };
      }

      return {
        ...response.data,
        success: true,
        isDetailQuestion: false
      };

    } catch (error) {
      console.error('QuestionAgent 오류:', error);
      return {
        question: '죄송합니다. 질문 생성 중 오류가 발생했습니다.',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 후속 질문용 사용자 정보 간단 요약 (집착 줄이기)
   */
  summarizeUserInfoForFollowUp(userInfo) {
    if (!userInfo) return '사용자 정보 없음';
    
    const parts = [];
    if (userInfo.name) parts.push(`이름: ${userInfo.name}`);
    if (userInfo.birthDate) {
      const age = calculateAge(userInfo.birthDate);
      if (age) parts.push(`나이: ${age}세`);
    }
    
    return parts.length > 0 ? parts.join(', ') : '사용자 정보 없음';
  }
}

export default QuestionAgent;