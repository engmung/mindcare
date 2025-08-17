import claudeService from '../services/claudeService.js';

/**
 * StyleAgent
 * 
 * 원고의 문체를 변환하는 AI 에이전트
 * Claude API를 활용하여 다양한 문체로 텍스트를 변환
 */
class StyleAgent {
  constructor() {
    // 문체 프리셋 정의
    this.stylePresets = {
      concise: {
        name: '간결한',
        description: '핵심만 간단명료하게 전달하는 문체',
        guidelines: `
- 짧고 명확한 문장 사용
- 불필요한 수식어 제거
- 핵심 정보 중심
- 단문 위주로 구성
- 직설적이고 명료한 표현`
      },
      descriptive: {
        name: '설명적인',
        description: '상세하고 구체적으로 설명하는 문체',
        guidelines: `
- 구체적인 세부사항 포함
- 오감을 활용한 묘사
- 배경과 상황 설명 강화
- 독자의 이해를 돕는 부연 설명
- 풍부한 형용사와 부사 활용`
      },
      formal: {
        name: '격식있는',
        description: '정중하고 품격있는 문체',
        guidelines: `
- 존댓말과 격식있는 어휘 사용
- 논리적이고 체계적인 구성
- 객관적이고 절제된 표현
- 품위있는 문장 구조
- 전문적이고 신뢰감 있는 톤`
      },
      friendly: {
        name: '친근한',
        description: '편안하고 다정한 대화체 문체',
        guidelines: `
- 대화하듯 자연스러운 표현
- 따뜻하고 친근한 어조
- 독자와의 거리감 줄이기
- 일상적인 어휘 사용
- 공감대 형성하는 표현`
      },
      romantic: {
        name: '낭만적인',
        description: '감성적이고 서정적인 문체',
        guidelines: `
- 감정과 느낌 중심의 표현
- 은유와 비유 적극 활용
- 서정적이고 시적인 문장
- 감성적인 어휘 선택
- 분위기와 정서 강조`
      },
      confessional: {
        name: '고백적인',
        description: '진솔하고 내밀한 고백체 문체',
        guidelines: `
- 솔직하고 진실된 표현
- 내면의 생각과 감정 노출
- 독백하듯 내밀한 어조
- 개인적 경험과 성찰 중심
- 진정성 있는 자기 고백`
      }
    };
  }

  /**
   * 문체 미리보기 생성 (첫 500자)
   * @param {string} text - 원본 텍스트
   * @param {string} styleKey - 문체 키 (concise, descriptive 등)
   * @param {string} additionalInstructions - 추가 지시사항
   * @returns {Promise<Object>} 변환 결과
   */
  async generatePreview(text, styleKey, additionalInstructions = '') {
    try {
      const style = this.stylePresets[styleKey];
      if (!style) {
        throw new Error(`Unknown style: ${styleKey}`);
      }

      // 500자 이하면 전체 사용, 초과하면 첫 500자만 추출
      const previewText = text.length <= 500 ? text : text.substring(0, 500);
      
      console.log(`StyleAgent - Generating preview for ${style.name} style (${previewText.length}/${text.length} chars)`);
      
      const stylePrompt = `${style.name} 문체로 변환하세요.
      
특징: ${style.description}

가이드라인:
${style.guidelines}`;

      const result = await claudeService.transformStyle(
        previewText,
        stylePrompt,
        additionalInstructions
      );

      if (result.success) {
        return {
          success: true,
          preview: result.transformedText,
          style: style.name,
          originalLength: previewText.length,
          usage: result.usage
        };
      } else {
        return {
          success: false,
          error: result.error
        };
      }
    } catch (error) {
      console.error('StyleAgent Preview Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 전체 원고에 문체 적용
   * @param {string} text - 전체 원고 텍스트
   * @param {string} styleKey - 문체 키
   * @param {string} additionalInstructions - 추가 지시사항
   * @param {string} previousSample - 이전 적용 샘플 (일관성 유지)
   * @returns {Promise<Object>} 변환 결과
   */
  async applyStyleToFullText(text, styleKey, additionalInstructions = '', previousSample = '') {
    try {
      const style = this.stylePresets[styleKey];
      if (!style) {
        throw new Error(`Unknown style: ${styleKey}`);
      }

      console.log(`StyleAgent - Applying ${style.name} style to full text`);
      
      // 장별로 분리하여 처리 (성능 최적화)
      const chapters = this.splitIntoChapters(text);
      const transformedChapters = [];
      
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        console.log(`StyleAgent - Processing chapter ${i + 1}/${chapters.length} (${chapter.content.length} chars)`);
        
        const stylePrompt = `${style.name} 문체로 변환하세요.
        
특징: ${style.description}

가이드라인:
${style.guidelines}

중요: 이것은 자서전의 ${i + 1}번째 장입니다. 전체적인 일관성을 유지하면서 변환해주세요.`;

        const result = await claudeService.transformStyle(
          chapter.content,
          stylePrompt,
          additionalInstructions,
          previousSample || (i > 0 ? transformedChapters[0].content.substring(0, 500) : '')
        );

        if (result.success) {
          transformedChapters.push({
            ...chapter,
            content: result.transformedText
          });
          console.log(`StyleAgent - Chapter ${i + 1} transformed: ${chapter.content.length} -> ${result.transformedText.length} chars`);
        } else {
          // 실패한 경우 원본 유지
          console.error(`Failed to transform chapter ${i + 1}:`, result.error);
          transformedChapters.push(chapter);
        }
      }

      // 변환된 장들을 다시 합치기
      const transformedText = this.mergeChapters(transformedChapters);
      
      return {
        success: true,
        transformedText: transformedText,
        style: style.name,
        chaptersProcessed: chapters.length
      };
      
    } catch (error) {
      console.error('StyleAgent Full Text Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 텍스트를 장별로 분리
   * @param {string} text - 원본 텍스트
   * @returns {Array} 장 배열
   */
  splitIntoChapters(text) {
    const chapters = [];
    const lines = text.split('\n');
    let currentChapter = null;
    let currentContent = [];
    
    for (const line of lines) {
      const chapterMatch = line.match(/^제(\d+)장[:\.]?\s*(.*)$/);
      
      if (chapterMatch) {
        // 이전 장 저장
        if (currentChapter) {
          chapters.push({
            number: currentChapter.number,
            title: currentChapter.title,
            content: currentContent.join('\n')
          });
        }
        
        // 새 장 시작
        currentChapter = {
          number: parseInt(chapterMatch[1]),
          title: chapterMatch[2] || ''
        };
        currentContent = [line]; // 장 제목 포함
      } else if (currentChapter) {
        currentContent.push(line);
      }
    }
    
    // 마지막 장 저장
    if (currentChapter) {
      chapters.push({
        number: currentChapter.number,
        title: currentChapter.title,
        content: currentContent.join('\n')
      });
    }
    
    // 장이 없는 경우 전체를 하나의 장으로
    if (chapters.length === 0) {
      chapters.push({
        number: 1,
        title: '',
        content: text
      });
    }
    
    return chapters;
  }


  /**
   * 장들을 다시 하나의 텍스트로 합치기
   * @param {Array} chapters - 장 배열
   * @returns {string} 합쳐진 텍스트
   */
  mergeChapters(chapters) {
    return chapters.map(chapter => chapter.content).join('\n\n');
  }

  /**
   * 사용 가능한 문체 목록 반환
   * @returns {Array} 문체 목록
   */
  getAvailableStyles() {
    return Object.entries(this.stylePresets).map(([key, style]) => ({
      key,
      name: style.name,
      description: style.description
    }));
  }
}

export default new StyleAgent();