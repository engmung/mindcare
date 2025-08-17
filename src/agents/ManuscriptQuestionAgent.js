import { loadPromptWithTemplate } from '../utils/promptLoader.js';
import geminiService from '../services/geminiService.js';

/**
 * ManuscriptQuestionAgent
 * 
 * 용도: 원고 편집 중 선택된 텍스트에 대한 확장 질문 생성 전용 에이전트
 * 사용처: 원고 편집 페이지의 질문 생성 모드에서만 사용
 * 기존 QuestionAgent와 완전 분리 - 수정 영향 없음
 */

class ManuscriptQuestionAgent {
  async generateExpansionQuestions(selectedText, context = {}) {
    try {
      console.log('ManuscriptQuestionAgent - 확장 질문 생성 시작');
      console.log('- 선택된 텍스트 길이:', selectedText?.length || 0);

      // 필수 데이터 검증
      if (!selectedText || !selectedText.trim()) {
        throw new Error('선택된 텍스트가 필요합니다.');
      }

      // 컨텍스트 데이터 준비
      const {
        fullManuscript = '',
        outline = null,
        previousContext = '',
        nextContext = ''
      } = context;

      // 목차 구조를 텍스트로 정리
      let outlineText = '목차 정보 없음';
      if (outline && outline.chapters) {
        outlineText = this.formatOutline(outline);
      }

      console.log('ManuscriptQuestionAgent - 컨텍스트 준비 완료');

      // 프롬프트 로드 및 템플릿 적용
      const prompt = await loadPromptWithTemplate('manuscript-question-generator.md', {
        SELECTED_TEXT: selectedText.trim(),
        FULL_MANUSCRIPT: fullManuscript,
        OUTLINE: outlineText,
        PREVIOUS_CONTEXT: previousContext,
        NEXT_CONTEXT: nextContext
      });

      if (!prompt) {
        throw new Error('원고 질문 생성 프롬프트를 불러올 수 없습니다.');
      }

      console.log('ManuscriptQuestionAgent - 프롬프트 준비 완료');

      // Gemini API 호출
      const systemInstruction = `당신은 자서전 원고의 특정 부분을 더 풍부하게 만들기 위한 질문을 생성하는 전문가입니다.
      선택된 텍스트에 대해 구체적이고 감정적 깊이를 더할 수 있는 3-5개의 자연스러운 질문을 만들어주세요.
      질문은 답변하기 부담스럽지 않으면서도 내용을 확장할 수 있는 것이어야 합니다.`;

      const response = await geminiService.generate(prompt, {
        systemInstruction: [{ text: systemInstruction }]
      });

      if (!response.success) {
        throw new Error(response.error || '확장 질문 생성에 실패했습니다.');
      }

      console.log('ManuscriptQuestionAgent - 확장 질문 생성 성공');

      // 질문 파싱 (간단한 파싱 로직)
      const questions = this.parseQuestions(response.text);

      return {
        selectedText,
        questions,
        success: true,
        metadata: {
          questionCount: questions.length,
          generatedAt: new Date().toISOString(),
          contextLength: fullManuscript.length
        }
      };

    } catch (error) {
      console.error('ManuscriptQuestionAgent 오류:', error);
      return {
        selectedText: selectedText || '',
        questions: [],
        success: false,
        error: error.message
      };
    }
  }

  // 목차 구조를 텍스트로 정리
  formatOutline(outline) {
    let text = `형식: ${outline.format_type || '알 수 없음'}\n`;
    text += `전체 주제: ${outline.overall_theme || '알 수 없음'}\n\n`;
    text += '목차:\n';
    
    if (outline.chapters && Array.isArray(outline.chapters)) {
      outline.chapters.forEach(chapter => {
        text += `${chapter.chapter_number}장. ${chapter.title}\n`;
        text += `   - 주제: ${chapter.theme || '없음'}\n`;
        if (chapter.key_events && chapter.key_events.length > 0) {
          text += `   - 주요 사건: ${chapter.key_events.join(', ')}\n`;
        }
        if (chapter.emotional_tone) {
          text += `   - 감정 톤: ${chapter.emotional_tone}\n`;
        }
        text += '\n';
      });
    }
    
    return text;
  }

  // 응답에서 질문들을 파싱
  parseQuestions(responseText) {
    try {
      const questions = [];
      const lines = responseText.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // "질문 N:" 또는 "**질문 N**:" 패턴 찾기
        const questionMatch = trimmedLine.match(/^(\*\*)?질문\s*\d+(\*\*)?:\s*(.+)$/);
        if (questionMatch) {
          const questionText = questionMatch[3].trim();
          if (questionText && questionText.length > 5) {
            questions.push(questionText);
          }
        }
        
        // 단순히 "- " 또는 숫자로 시작하는 질문도 처리
        else if (trimmedLine.match(/^[-\d]+\.\s*(.+)/) && trimmedLine.includes('?')) {
          const questionText = trimmedLine.replace(/^[-\d]+\.\s*/, '').trim();
          if (questionText.length > 5) {
            questions.push(questionText);
          }
        }
      }

      // 파싱된 질문이 없으면 전체 텍스트를 하나의 질문으로 처리
      if (questions.length === 0 && responseText.trim().includes('?')) {
        const fallbackQuestions = responseText.split('?').filter(q => q.trim().length > 10);
        return fallbackQuestions.slice(0, 5).map(q => q.trim() + '?');
      }

      return questions.slice(0, 5); // 최대 5개까지

    } catch (error) {
      console.error('질문 파싱 오류:', error);
      return ['선택하신 부분에 대해 더 자세히 설명해주실 수 있나요?'];
    }
  }

  // 컨텍스트 추출 헬퍼 (PartialEditAgent와 동일)
  extractContext(fullText, selectedText, contextLength = 500) {
    if (!fullText || !selectedText) {
      return { previousContext: '', nextContext: '' };
    }

    const selectedIndex = fullText.indexOf(selectedText);
    if (selectedIndex === -1) {
      return { previousContext: '', nextContext: '' };
    }

    const startIndex = Math.max(0, selectedIndex - contextLength);
    const endIndex = Math.min(fullText.length, selectedIndex + selectedText.length + contextLength);

    const previousContext = fullText.substring(startIndex, selectedIndex).trim();
    const nextContext = fullText.substring(selectedIndex + selectedText.length, endIndex).trim();

    return { previousContext, nextContext };
  }

  // 질문 타입 분석 (향후 확장용)
  analyzeQuestionType(selectedText) {
    const text = selectedText.toLowerCase();
    
    if (text.includes('느꼈') || text.includes('생각') || text.includes('마음')) {
      return 'emotional';
    } else if (text.includes('그때') || text.includes('당시') || text.includes('순간')) {
      return 'temporal';
    } else if (text.includes('사람') || text.includes('친구') || text.includes('가족')) {
      return 'relationship';
    } else {
      return 'general';
    }
  }

  // 질문 품질 검증
  validateQuestions(questions) {
    return questions.filter(question => {
      return question.length > 5 && 
             question.length < 200 && 
             question.includes('?') &&
             !question.includes('AI') &&
             !question.includes('인공지능');
    });
  }
}

export default new ManuscriptQuestionAgent();