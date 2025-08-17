import { loadPromptWithTemplate } from '../utils/promptLoader.js';
import geminiService, { schemas } from '../services/geminiService.js';
import completenessAnalysisAgent from './CompletenessAnalysisAgent.js';
import { loadConversations, loadOutlineData } from '../utils/dataManager.js';

class DetailQuestionAgent {
  async generateDetailQuestion(conversations = [], outlineData = null) {
    try {
      if (!outlineData || !outlineData.chapters) {
        throw new Error('목차 데이터가 필요합니다.');
      }

      // 가장 최근 대화 찾기 (답변이 있는 것 중)
      const lastAnsweredConversation = conversations
        .filter(conv => conv.answer && conv.answer.trim())
        .slice(-1)[0];

      if (!lastAnsweredConversation) {
        throw new Error('분석할 답변이 없습니다.');
      }

      // 초안 데이터 확인 (manuscripts 스토리지에서)
      const manuscriptData = this.getManuscriptData();
      
      // 완성도 분석 결과 조회 (초안이 없는 경우에만 사용)
      const completenessAnalysis = manuscriptData ? null : completenessAnalysisAgent.getLatestAnalysis();
      
      console.log('DetailQuestionAgent - 최근 답변:', lastAnsweredConversation);
      console.log('DetailQuestionAgent - 초안 데이터:', manuscriptData ? '있음' : '없음');
      console.log('DetailQuestionAgent - 완성도 분석 데이터:', completenessAnalysis ? '있음' : '없음');

      // 프롬프트 준비 (초안 우선, 없으면 완성도 분석 결과 사용)
      const prompt = await this.prepareDetailPrompt(
        lastAnsweredConversation, 
        outlineData,
        completenessAnalysis,
        conversations,
        manuscriptData
      );

      if (!prompt) {
        throw new Error('상세 질문 프롬프트를 불러올 수 없습니다.');
      }

      // API 호출 (Structured output 우선, 실패 시 fallback)
      let response;
      let isStructured = true;
      
      try {
        const systemInstruction = `당신은 자서전 작성을 위한 상세 질문 생성 전문가입니다.
        사용자의 답변을 바탕으로 더 구체적이고 디테일한 후속 질문을 생성하세요.
        목차 구조를 고려하여 부족한 정보를 보완할 수 있는 질문을 만들어주세요.
        생생한 디테일과 구체적 장면을 끌어낼 수 있는 질문에 집중하세요.`;
        
        response = await geminiService.generateStructured(
          prompt,
          'question', // 스키마 이름을 문자열로 전달
          systemInstruction
        );
      } catch (error) {
        console.warn('Structured API failed, falling back to text generation:', error);
        isStructured = false;
        
        // 일반 텍스트 생성으로 fallback
        response = await geminiService.generate(prompt);
      }
      
      if (!response.success) {
        throw new Error(response.error || '상세 질문 생성에 실패했습니다.');
      }

      // 구조화된 응답 처리
      if (isStructured && response.data) {
        return {
          ...response.data,
          success: true,
          isDetailQuestion: true,
          targetChapter: response.data.targetChapter || null
        };
      }
      
      // 텍스트 응답 처리
      let question = response.text.trim();
      if (question.startsWith('다음 질문들:') || question.startsWith('질문:')) {
        question = question.replace(/^(다음 질문들?:|질문:)\s*/i, '').trim();
      }
      
      return {
        question,
        context: `목차 기반 상세 질문`,
        expected_info_type: 'reflective',
        success: true,
        isDetailQuestion: true,
        targetChapter: null
      };

    } catch (error) {
      console.error('DetailQuestionAgent 오류:', error);
      return {
        question: null,
        success: false,
        error: error.message
      };
    }
  }

  // 기존 분석 로직들은 CompletenessAnalysisAgent로 이관됨
  // 이 클래스는 이제 LLM 기반 질문 생성에만 집중

  // 초안 데이터 가져오기
  getManuscriptData() {
    try {
      // QuestionInterface에서 저장한 manuscriptData 확인
      // 실제로는 여기서 전역 상태나 다른 방식으로 초안 데이터를 확인해야 함
      // 현재는 간단히 localStorage를 사용
      const manuscripts = localStorage.getItem('autobiography_manuscripts');
      if (manuscripts) {
        const parsed = JSON.parse(manuscripts);
        return parsed.content ? parsed.content : null;
      }
      return null;
    } catch (error) {
      console.error('초안 데이터 로드 실패:', error);
      return null;
    }
  }

  // 상세 질문 프롬프트 준비
  async prepareDetailPrompt(lastConversation, outlineData, completenessAnalysis, allConversations, manuscriptData) {
    const templateData = {
      USER_ANSWER: lastConversation.answer,
      ORIGINAL_QUESTION: lastConversation.question,
      OUTLINE_DATA: JSON.stringify(outlineData, null, 2),
      HAS_MANUSCRIPT: manuscriptData ? 'true' : 'false',
      MANUSCRIPT_CONTENT: manuscriptData || '',
      COMPLETENESS_ANALYSIS: completenessAnalysis 
        ? JSON.stringify(completenessAnalysis, null, 2) 
        : 'null',
      HAS_ANALYSIS: completenessAnalysis ? 'true' : 'false'
    };

    return await loadPromptWithTemplate('detail-question.md', templateData);
  }

}

export default new DetailQuestionAgent();