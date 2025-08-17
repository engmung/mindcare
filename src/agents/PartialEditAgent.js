import { loadPromptWithTemplate } from '../utils/promptLoader.js';
import geminiService from '../services/geminiService.js';

/**
 * PartialEditAgent
 * 
 * 용도: 자서전 원고의 특정 부분만 수정하는 전용 에이전트
 * 사용처: 원고 편집 단계에서만 사용
 * 기존 QuestionAgent와 완전 분리
 */

class PartialEditAgent {
  async refineTextSegment(selectedText, modificationRequest, context = {}) {
    try {
      console.log('PartialEditAgent - 부분 수정 시작');
      console.log('- 선택된 텍스트 길이:', selectedText?.length || 0);
      console.log('- 수정 요청:', modificationRequest);

      // 필수 데이터 검증
      if (!selectedText || !selectedText.trim()) {
        throw new Error('수정할 텍스트가 선택되지 않았습니다.');
      }

      if (!modificationRequest || !modificationRequest.trim()) {
        throw new Error('수정 요청 내용이 필요합니다.');
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

      console.log('PartialEditAgent - 컨텍스트 준비 완료');

      // 프롬프트 로드 및 템플릿 적용
      const prompt = await loadPromptWithTemplate('partial-edit.md', {
        SELECTED_TEXT: selectedText.trim(),
        MODIFICATION_REQUEST: modificationRequest.trim(),
        FULL_MANUSCRIPT: fullManuscript,
        OUTLINE: outlineText,
        PREVIOUS_CONTEXT: previousContext,
        NEXT_CONTEXT: nextContext
      });

      if (!prompt) {
        throw new Error('부분 수정 프롬프트를 불러올 수 없습니다.');
      }

      console.log('PartialEditAgent - 프롬프트 준비 완료');

      // Gemini API 호출 (Structured Output 사용)
      const systemInstruction = `당신은 자서전 원고의 부분 수정 전문가입니다.
      사용자가 선택한 텍스트를 요청에 맞게 정확히 수정하되, 전체 원고의 맥락과 일관성을 유지하세요.
      
      중요: 원본 텍스트의 문단 구조를 정확히 보존해야 합니다:
      - 줄바꿈(개행)이 있던 곳은 반드시 그대로 유지
      - 여러 문단에 걸친 수정 시에도 각 문단의 구분 보존
      - 문단을 합치거나 새로 나누지 말 것
      
      JSON 형식으로 수정된 텍스트와 수정 내용 요약, 수정 유형을 제공하세요.`;

      const response = await geminiService.generateStructured(prompt, 'partial_edit', systemInstruction);

      if (!response.success) {
        throw new Error(response.error || '부분 수정에 실패했습니다.');
      }

      console.log('PartialEditAgent - 부분 수정 성공:', response.data);

      return {
        originalText: selectedText,
        modifiedText: response.data.modified_text.trim(),
        editSummary: response.data.edit_summary,
        changeType: response.data.change_type,
        success: true,
        metadata: {
          requestType: 'partial_edit',
          modificationRequest,
          processedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('PartialEditAgent 오류:', error);
      return {
        originalText: selectedText || '',
        modifiedText: null,
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

  // 컨텍스트 추출 헬퍼 (앞뒤 문단 추출)
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

  // 텍스트 교체 헬퍼 (개선된 버전)
  applyEditToManuscript(originalManuscript, selectedText, editedText) {
    try {
      console.log('텍스트 교체 시도:');
      console.log('- 원본 텍스트 길이:', originalManuscript.length);
      console.log('- 선택된 텍스트 길이:', selectedText.length);
      console.log('- 수정된 텍스트 길이:', editedText.length);
      
      // 1차 시도: 정확한 매치
      let updatedManuscript = originalManuscript.replace(selectedText, editedText);
      
      if (updatedManuscript !== originalManuscript) {
        console.log('정확한 매치로 교체 성공');
        return {
          success: true,
          updatedManuscript: updatedManuscript
        };
      }
      
      // 2차 시도: 공백 정규화 후 매치
      const normalizedSelected = selectedText.trim().replace(/\s+/g, ' ');
      const normalizedManuscript = originalManuscript.replace(/\s+/g, ' ');
      
      if (normalizedManuscript.includes(normalizedSelected)) {
        // 정규화된 텍스트로 교체
        const originalPattern = selectedText.trim().replace(/\s+/g, '\\s+');
        const regex = new RegExp(originalPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        updatedManuscript = originalManuscript.replace(regex, editedText);
        
        if (updatedManuscript !== originalManuscript) {
          console.log('정규화된 매치로 교체 성공');
          return {
            success: true,
            updatedManuscript: updatedManuscript
          };
        }
      }
      
      // 3차 시도: 부분 매치 (첫 50자, 끝 50자 기준)
      const selectedStart = selectedText.trim().substring(0, 50);
      const selectedEnd = selectedText.trim().slice(-50);
      
      const startIndex = originalManuscript.indexOf(selectedStart);
      const endText = selectedEnd !== selectedStart ? selectedEnd : '';
      
      if (startIndex !== -1) {
        let endIndex = -1;
        if (endText) {
          endIndex = originalManuscript.indexOf(endText, startIndex + selectedStart.length);
          if (endIndex !== -1) {
            endIndex += endText.length;
          }
        } else {
          endIndex = startIndex + selectedText.length;
        }
        
        if (endIndex > startIndex) {
          const actualSelectedText = originalManuscript.substring(startIndex, endIndex);
          updatedManuscript = originalManuscript.replace(actualSelectedText, editedText);
          
          if (updatedManuscript !== originalManuscript) {
            console.log('부분 매치로 교체 성공');
            return {
              success: true,
              updatedManuscript: updatedManuscript
            };
          }
        }
      }
      
      console.warn('모든 교체 시도 실패');
      console.log('선택된 텍스트 미리보기:', selectedText.substring(0, 100) + '...');
      console.log('원고에서 첫 100자:', originalManuscript.substring(0, 100) + '...');
      
      return {
        success: false,
        error: '선택된 텍스트를 원고에서 찾을 수 없습니다. 텍스트를 다시 선택해주세요.'
      };
      
    } catch (error) {
      console.error('텍스트 교체 중 오류:', error);
      return {
        success: false,
        error: `텍스트 적용 실패: ${error.message}`
      };
    }
  }

  // 수정 요청 유형 분석 (향후 확장용)
  analyzeModificationRequest(request) {
    const requestLower = request.toLowerCase();
    
    if (requestLower.includes('자세히') || requestLower.includes('구체적') || requestLower.includes('확장')) {
      return 'expand';
    } else if (requestLower.includes('간단히') || requestLower.includes('줄여') || requestLower.includes('축약')) {
      return 'condense';
    } else if (requestLower.includes('감성적') || requestLower.includes('감동적') || requestLower.includes('문학적')) {
      return 'emotional';
    } else if (requestLower.includes('수정') || requestLower.includes('바꿔') || requestLower.includes('변경')) {
      return 'modify';
    } else {
      return 'general';
    }
  }

  // ===== 기존 메서드들 (호환성 유지) =====

  // 부분 편집 실행 (기존 인터페이스 유지)
  async editPartialContent(selectedText, editRequest, fullManuscript, editMode = 'direct') {
    console.log('PartialEditAgent - 기존 인터페이스 호출, 새 인터페이스로 리다이렉트');
    
    if (editMode === 'question') {
      // 질문 생성은 ManuscriptQuestionAgent로 이관 예정
      return {
        success: false,
        error: '질문 생성 모드는 ManuscriptQuestionAgent를 사용하세요.'
      };
    }

    // 새 인터페이스로 리다이렉트
    const context = {
      fullManuscript,
      outline: null, // 기존 구조에서는 outline 정보가 없음
      previousContext: '',
      nextContext: ''
    };

    return await this.refineTextSegment(selectedText, editRequest, context);
  }
}

export default new PartialEditAgent();