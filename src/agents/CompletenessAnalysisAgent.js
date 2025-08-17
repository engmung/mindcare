import { loadPromptWithTemplate } from '../utils/promptLoader.js';
import geminiService, { schemas } from '../services/geminiService.js';
import { saveCompletenessAnalysis, loadCompletenessAnalysis } from '../utils/dataManager.js';

// 완성도 분석 결과 스키마
const completenessSchema = {
  type: "object",
  properties: {
    overall_summary: {
      type: "string",
      description: "전체 목차의 완성도 요약"
    },
    chapters_analysis: {
      type: "array",
      items: {
        type: "object",
        properties: {
          chapter_number: { 
            type: "number",
            description: "챕터 번호"
          },
          chapter_title: {
            type: "string",
            description: "챕터 제목"
          },
          completeness_score: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description: "완성도 점수 (0-100)"
          },
          information_coverage: {
            type: "object",
            properties: {
              basic_facts: {
                type: "number",
                minimum: 0,
                maximum: 100,
                description: "기본 사실 정보 충족도"
              },
              emotional_depth: {
                type: "number", 
                minimum: 0,
                maximum: 100,
                description: "감정적 깊이 충족도"
              },
              specific_details: {
                type: "number",
                minimum: 0,
                maximum: 100,
                description: "구체적 디테일 충족도"
              },
              context_background: {
                type: "number",
                minimum: 0,
                maximum: 100,
                description: "배경 맥락 정보 충족도"
              }
            },
            required: ["basic_facts", "emotional_depth", "specific_details", "context_background"]
          },
          missing_elements: {
            type: "array",
            items: { type: "string" },
            description: "부족한 요소들 목록"
          },
          recommended_questions: {
            type: "array",
            items: { type: "string" },
            description: "권장 질문 유형"
          },
          priority_level: {
            type: "string",
            enum: ["높음", "중간", "낮음"],
            description: "우선순위 수준"
          }
        },
        required: ["chapter_number", "chapter_title", "completeness_score", "information_coverage", "missing_elements", "recommended_questions", "priority_level"]
      }
    },
    next_target_chapter: {
      type: "number",
      description: "다음에 집중해야 할 챕터 번호"
    },
    analysis_timestamp: {
      type: "string",
      description: "분석 실행 시각"
    }
  },
  required: ["overall_summary", "chapters_analysis", "next_target_chapter", "analysis_timestamp"]
};

class CompletenessAnalysisAgent {
  
  async analyzeCompleteness(conversations = [], outlineData = null) {
    try {
      console.log('CompletenessAnalysisAgent - 완성도 분석 시작');
      
      if (!outlineData || !outlineData.chapters) {
        return {
          success: false,
          error: '목차 데이터가 필요합니다.'
        };
      }

      if (conversations.length === 0) {
        return {
          success: false,
          error: '분석할 대화가 없습니다.'
        };
      }

      // 답변이 있는 대화만 필터링
      const completedConversations = conversations.filter(conv => 
        conv.answer && conv.answer.trim()
      );

      if (completedConversations.length === 0) {
        return {
          success: false,
          error: '완료된 대화가 없습니다.'
        };
      }

      // 프롬프트 준비
      const prompt = await this.prepareAnalysisPrompt(completedConversations, outlineData);
      
      if (!prompt) {
        return {
          success: false,
          error: '분석 프롬프트를 불러올 수 없습니다.'
        };
      }

      console.log('CompletenessAnalysisAgent - LLM 분석 요청');

      // LLM 분석 실행 (Structured output 우선, 실패 시 fallback)
      let response;
      let isStructured = true;

      try {
        const systemInstruction = `당신은 자서전 목차별 정보 완성도를 분석하는 전문가입니다.
        사용자의 대화 내용과 목차를 비교분석하여 각 챕터별로 얼마나 충분한 정보가 수집되었는지 평가하세요.
        
        분석 기준:
        1. 기본 사실 정보: 언제, 어디서, 누구와, 무엇을 했는지
        2. 감정적 깊이: 그때의 감정, 느낌, 생각의 변화
        3. 구체적 디테일: 생생한 장면, 감각적 묘사, 구체적 상황
        4. 배경 맥락: 당시 상황, 사회적 배경, 개인적 상황
        
        각 항목을 0-100점으로 평가하고, 전체 완성도도 산출하세요.`;

        response = await geminiService.generateStructured(
          prompt,
          'question', // 완성도 분석은 사용하지 않으므로 임시로 question 스키마 사용
          systemInstruction
        );
      } catch (error) {
        console.warn('Structured analysis failed, falling back to text:', error);
        isStructured = false;
        
        // 일반 텍스트 분석으로 fallback
        response = await geminiService.generate(prompt);
      }

      if (!response.success) {
        return {
          success: false,
          error: response.error || '완성도 분석에 실패했습니다.'
        };
      }

      let analysisResult;
      
      if (isStructured && response.data) {
        analysisResult = {
          ...response.data,
          analysis_timestamp: new Date().toISOString()
        };
      } else {
        // 텍스트 응답을 간단한 구조로 변환
        analysisResult = this.parseTextAnalysis(response.text, outlineData);
      }

      // 분석 결과 저장
      saveCompletenessAnalysis(analysisResult);
      
      console.log('CompletenessAnalysisAgent - 분석 완료 및 저장됨');

      return {
        success: true,
        data: analysisResult
      };

    } catch (error) {
      console.error('CompletenessAnalysisAgent 오류:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 분석 프롬프트 준비
  async prepareAnalysisPrompt(conversations, outlineData) {
    try {
      const templateData = {
        OUTLINE_DATA: JSON.stringify(outlineData, null, 2),
        CONVERSATIONS_DATA: this.formatConversationsForAnalysis(conversations),
        TOTAL_CONVERSATIONS: conversations.length.toString(),
        CHAPTERS_COUNT: outlineData.chapters.length.toString()
      };

      return await loadPromptWithTemplate('completeness-analysis.md', templateData);
    } catch (error) {
      console.error('프롬프트 준비 실패:', error);
      return null;
    }
  }

  // 대화 데이터를 분석용으로 포맷팅
  formatConversationsForAnalysis(conversations) {
    return conversations.map((conv, index) => {
      return `**대화 ${index + 1}**
질문: ${conv.question}
답변: ${conv.answer}
${conv.isDetailQuestion ? '(목차 기반 상세 질문)' : '(기본 질문)'}
${conv.targetChapter ? `대상 챕터: ${conv.targetChapter}` : ''}

---
`;
    }).join('\n');
  }

  // 텍스트 응답을 구조화된 데이터로 변환 (fallback)
  parseTextAnalysis(textResponse, outlineData) {
    const timestamp = new Date().toISOString();
    
    // 간단한 fallback 구조
    const chaptersAnalysis = outlineData.chapters.map(chapter => ({
      chapter_number: chapter.chapter_number,
      chapter_title: chapter.title,
      completeness_score: 50, // 기본값
      information_coverage: {
        basic_facts: 50,
        emotional_depth: 50,
        specific_details: 50,
        context_background: 50
      },
      missing_elements: ['구체적 분석 필요'],
      recommended_questions: ['상세 질문 필요'],
      priority_level: '중간'
    }));

    return {
      overall_summary: '자동 분석 결과 (기본 구조)',
      chapters_analysis: chaptersAnalysis,
      next_target_chapter: 1,
      analysis_timestamp: timestamp,
      fallback_mode: true,
      original_text: textResponse
    };
  }

  // 저장된 분석 결과 조회
  getLatestAnalysis() {
    return loadCompletenessAnalysis();
  }

  // 특정 챕터의 완성도 조회
  getChapterCompleteness(chapterNumber) {
    const analysis = this.getLatestAnalysis();
    if (!analysis || !analysis.chapters_analysis) return null;

    return analysis.chapters_analysis.find(
      chapter => chapter.chapter_number === chapterNumber
    );
  }

  // 우선순위가 높은 챕터 조회
  getPriorityChapters() {
    const analysis = this.getLatestAnalysis();
    if (!analysis || !analysis.chapters_analysis) return [];

    return analysis.chapters_analysis
      .filter(chapter => chapter.priority_level === '높음')
      .sort((a, b) => a.completeness_score - b.completeness_score);
  }

  // 다음 타겟 챕터 정보 조회
  getNextTargetChapter() {
    const analysis = this.getLatestAnalysis();
    if (!analysis) return null;

    const targetChapterNumber = analysis.next_target_chapter;
    return this.getChapterCompleteness(targetChapterNumber);
  }
}

export default new CompletenessAnalysisAgent();