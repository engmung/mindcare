import { loadPromptWithTemplate } from '../utils/promptLoader.js';
import geminiService from '../services/geminiService.js';
import { loadOutlineData, QAManager } from '../utils/dataManager.js';

class BatchUpdateAgent {
  // QA 답변들과 직접 수정들을 기반으로 원고 일괄 업데이트
  async updateManuscriptWithQAs(originalManuscript) {
    try {
      console.log('BatchUpdateAgent - 일괄 업데이트 시작');
      
      // 답변 완료된 QA들과 준비된 직접 수정들 가져오기
      const answeredQAs = QAManager.getAnsweredQAPairs();
      const readyDirectEdits = QAManager.getQAPairsByStatus('ready');
      const updateableItems = [...answeredQAs, ...readyDirectEdits];
      
      if (updateableItems.length === 0) {
        throw new Error('업데이트할 내용이 없습니다. 답변된 질문이나 준비된 직접 수정이 있는지 확인하세요.');
      }
      
      console.log(`- 적용할 항목 개수: 질문 ${answeredQAs.length}개 + 직접 수정 ${readyDirectEdits.length}개 = 총 ${updateableItems.length}개`);
      
      // 위치순으로 정렬 (뒤에서부터 적용하기 위해 역순)
      const sortedItems = updateableItems.sort((a, b) => b.textPosition.start - a.textPosition.start);
      
      // 각 항목에 대해 개별적으로 텍스트 개선
      let updatedManuscript = originalManuscript;
      const updateResults = [];
      
      for (const item of sortedItems) {
        try {
          console.log(`${item.type === 'question' ? 'QA' : '직접 수정'} 처리 중: ${item.id}`);
          
          let result;
          if (item.type === 'question') {
            // 질문-답변 타입
            result = await this.updateSingleSection(
              updatedManuscript,
              item.selectedText,
              item.question,
              item.answer,
              item.textPosition,
              item.targetChapter
            );
          } else {
            // 직접 수정 타입
            result = await this.applyDirectEdit(
              updatedManuscript,
              item.selectedText,
              item.improvedText,
              item.textPosition
            );
          }
          
          if (result.success) {
            updatedManuscript = result.updatedText;
            updateResults.push({
              itemId: item.id,
              type: item.type,
              success: true,
              originalLength: item.selectedText.length,
              newLength: result.improvedText.length
            });
            
            // 상태를 'applied'로 변경
            QAManager.updateStatus(item.id, 'applied');
            
          } else {
            console.warn(`${item.type} ${item.id} 업데이트 실패:`, result.error);
            updateResults.push({
              itemId: item.id,
              type: item.type,
              success: false,
              error: result.error
            });
          }
        } catch (error) {
          console.error(`${item.type} ${item.id} 처리 중 오류:`, error);
          updateResults.push({
            itemId: item.id,
            type: item.type,
            success: false,
            error: error.message
          });
        }
      }
      
      const successCount = updateResults.filter(r => r.success).length;
      console.log(`일괄 업데이트 완료: ${successCount}/${updateableItems.length}개 성공`);
      
      return {
        success: true,
        updatedManuscript,
        results: updateResults,
        stats: {
          total: updateableItems.length,
          success: successCount,
          failed: updateableItems.length - successCount
        }
      };
      
    } catch (error) {
      console.error('BatchUpdateAgent 오류:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // 개별 섹션 업데이트
  async updateSingleSection(fullText, selectedText, question, answer, textPosition, targetChapter) {
    try {
      // 선택된 텍스트가 여전히 해당 위치에 있는지 확인
      const currentText = fullText.slice(textPosition.start, textPosition.end);
      
      if (currentText !== selectedText) {
        console.warn('텍스트 위치 불일치, 텍스트 검색으로 대체');
        // 텍스트 검색으로 위치 재탐색
        const newPosition = this.findTextPosition(selectedText, fullText);
        if (!newPosition) {
          throw new Error('선택된 텍스트를 찾을 수 없습니다.');
        }
        textPosition = newPosition;
      }
      
      // 목차 정보 로드
      const outlineData = loadOutlineData();
      
      // 프롬프트 준비
      const prompt = await loadPromptWithTemplate('batch-update.md', {
        SELECTED_TEXT: selectedText,
        QUESTION: question,
        ANSWER: answer,
        TARGET_CHAPTER: targetChapter || '해당 없음',
        OUTLINE_DATA: outlineData ? JSON.stringify(outlineData, null, 2) : 'null',
        SURROUNDING_CONTEXT: this.getSurroundingContext(fullText, textPosition)
      });
      
      if (!prompt) {
        throw new Error('배치 업데이트 프롬프트를 불러올 수 없습니다.');
      }
      
      // AI를 통한 텍스트 개선
      const response = await geminiService.generate(prompt);
      
      if (!response.success) {
        throw new Error(response.error || '텍스트 개선에 실패했습니다.');
      }
      
      const improvedText = response.text.trim();
      
      // 원본 텍스트 교체
      const beforeText = fullText.slice(0, textPosition.start);
      const afterText = fullText.slice(textPosition.end);
      const updatedText = beforeText + improvedText + afterText;
      
      return {
        success: true,
        improvedText,
        updatedText
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // 직접 수정 적용
  async applyDirectEdit(fullText, selectedText, improvedText, textPosition) {
    try {
      // 선택된 텍스트가 여전히 해당 위치에 있는지 확인
      const currentText = fullText.slice(textPosition.start, textPosition.end);
      
      if (currentText !== selectedText) {
        console.warn('텍스트 위치 불일치, 텍스트 검색으로 대체');
        // 텍스트 검색으로 위치 재탐색
        const newPosition = this.findTextPosition(selectedText, fullText);
        if (!newPosition) {
          throw new Error('선택된 텍스트를 찾을 수 없습니다.');
        }
        textPosition = newPosition;
      }
      
      // 원본 텍스트를 개선된 텍스트로 교체
      const beforeText = fullText.slice(0, textPosition.start);
      const afterText = fullText.slice(textPosition.end);
      const updatedText = beforeText + improvedText + afterText;
      
      return {
        success: true,
        improvedText,
        updatedText
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // 텍스트 위치 재탐색
  findTextPosition(searchText, fullText) {
    const start = fullText.indexOf(searchText);
    if (start !== -1) {
      return {
        start: start,
        end: start + searchText.length
      };
    }
    return null;
  }
  
  // 주변 맥락 추출 (앞뒤 200자)
  getSurroundingContext(fullText, textPosition) {
    const contextLength = 200;
    const start = Math.max(0, textPosition.start - contextLength);
    const end = Math.min(fullText.length, textPosition.end + contextLength);
    
    const beforeContext = fullText.slice(start, textPosition.start);
    const afterContext = fullText.slice(textPosition.end, end);
    
    return {
      before: beforeContext,
      after: afterContext
    };
  }
  
  // 업데이트 가능한 QA 통계
  getUpdateStats() {
    const answered = QAManager.getAnsweredQAPairs();
    const pending = QAManager.getPendingQAPairs();
    const applied = QAManager.getQAPairsByStatus('applied');
    
    return {
      canUpdate: answered.length,
      pending: pending.length,
      alreadyApplied: applied.length
    };
  }
}

export default new BatchUpdateAgent();