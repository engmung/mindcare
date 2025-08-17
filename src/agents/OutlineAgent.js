import { loadPromptWithTemplate } from '../utils/promptLoader.js';
import geminiService, { schemas } from '../services/geminiService.js';

class OutlineAgent {
  // 3개의 목차 시안 생성 (첫 생성 또는 새로고침)
  async generateOutlineOptions(conversations = [], mindmapData = null, selectedFormat = 'chronological') {
    try {
      if (!conversations || conversations.length === 0) {
        return {
          data: null,
          success: false,
          error: '상담일지를 구성할 대화 데이터가 없습니다.'
        };
      }

      // 대화 데이터를 문자열로 정리
      const conversationsText = conversations.map((conv, index) => 
        `${index + 1}. 질문: ${conv.question}\n   답변: ${conv.answer || '(답변 대기중)'}`
      ).join('\n\n');

      // 마인드맵 데이터 정리 (있는 경우)
      let mindmapText = '(마인드맵 데이터 없음)';
      if (mindmapData && mindmapData.keywords && mindmapData.keywords.length > 0) {
        const topKeywords = mindmapData.keywords
          .sort((a, b) => b.importance - a.importance)
          .slice(0, 10)
          .map(k => `${k.content}(${k.category}, 중요도:${k.importance})`)
          .join(', ');
        
        const emotions = mindmapData.emotions && mindmapData.emotions.length > 0
          ? mindmapData.emotions
              .sort((a, b) => b.intensity - a.intensity)
              .slice(0, 5)
              .map(e => `${e.emotion}(강도:${e.intensity})`)
              .join(', ')
          : '';

        const people = mindmapData.people && mindmapData.people.length > 0
          ? mindmapData.people
              .sort((a, b) => b.importance - a.importance)
              .slice(0, 5)
              .map(p => `${p.name}(${p.relationship}, 중요도:${p.importance})`)
              .join(', ')
          : '';

        mindmapText = `주요 키워드: ${topKeywords}
주요 감정: ${emotions || '없음'}
주요 인물: ${people || '없음'}`;
      }

      console.log('OutlineAgent - 대화 데이터:', conversationsText);
      console.log('OutlineAgent - 마인드맵 데이터:', mindmapText);
      console.log('OutlineAgent - 선택된 형식:', selectedFormat);

      // 사용자 선택 형식을 한국어로 변환 (첫 번째 시안에만 사용)
      const formatMap = {
        'thematic': '주제별 정리형',
        'emotional': '감정 중심형',
        'growth': '성장 여정형',
        'integrative': '통합 분석형'
      };

      const selectedFormatKorean = formatMap[selectedFormat] || '주제별 정리형';

      // 통합 프롬프트 로드 및 템플릿 적용
      const prompt = await loadPromptWithTemplate('outline-generator.md', {
        CONVERSATIONS: conversationsText,
        MINDMAP_DATA: mindmapText,
        SELECTED_FORMAT: selectedFormatKorean
      });

      if (!prompt) {
        throw new Error('상담일지 구성 프롬프트 파일을 불러올 수 없습니다.');
      }

      // Structured Gemini API 호출
      const systemInstruction = `당신은 상담일지 구성 전문가입니다. 
      사용자의 상담 대화 내용과 추출된 정보를 바탕으로 3개의 서로 다른 상담일지 구성안을 생성하세요.
      
      중요: 각 시안은 다음과 같이 차별화하세요.
      - 첫 번째 시안: 사용자가 선택한 ${selectedFormatKorean} 형식을 기반으로 구성
      - 두 번째 시안: 상담 내용을 분석해서 가장 적합하다고 판단되는 형식으로 구성 (사용자 선택과 달라도 됨)
      - 세 번째 시안: 통합적 관점에서 균형잡힌 구성
      
      각 시안은 3-5개 장으로 구성하고, 공감적이고 희망적인 톤을 유지하세요.`;
      
      // ========== 상담일지 구성 AI 프롬프트 전체 내용 (복사용) ==========
      console.log('\n==================== 상담일지 구성 AI 프롬프트 시작 ====================');
      console.log('【System Instruction】');
      console.log(systemInstruction);
      console.log('\n【User Prompt】');
      console.log(prompt);
      console.log('==================== 상담일지 구성 AI 프롬프트 끝 ====================\n');

      const response = await geminiService.generateStructured(
        prompt,
        'outlineOptions', // 스키마 이름을 문자열로 전달
        systemInstruction
      );
      
      if (!response.success) {
        // Structured output 실패 시 일반 텍스트로 fallback
        console.warn('Structured outline generation failed, falling back to text generation');
        const fallbackResponse = await geminiService.generate(prompt);
        
        if (!fallbackResponse.success) {
          throw new Error(fallbackResponse.error || '목차 생성에 실패했습니다.');
        }
        
        // 텍스트 응답을 3개 시안으로 변환 (fallback)
        return {
          data: {
            options: [
              {
                option_number: 1,
                concept: "전통적 구성",
                format_type: selectedFormatKorean,
                overall_theme: "인생 여정",
                chapters: this.parseTextOutline(fallbackResponse.text)
              },
              {
                option_number: 2,
                concept: "창의적 구성",
                format_type: selectedFormatKorean,
                overall_theme: "나만의 이야기",
                chapters: this.parseTextOutline(fallbackResponse.text)
              },
              {
                option_number: 3,
                concept: "감성적 구성",
                format_type: selectedFormatKorean,
                overall_theme: "마음의 여정",
                chapters: this.parseTextOutline(fallbackResponse.text)
              }
            ]
          },
          success: true
        };
      }

      // 생성된 목차 시안들 검증 및 후처리
      const processedOptions = this.validateAndProcessOutlineOptions(response.data, selectedFormat);

      return {
        data: processedOptions,
        success: true
      };

    } catch (error) {
      console.error('OutlineAgent 목차 생성 오류:', error);
      return {
        data: null,
        success: false,
        error: error.message
      };
    }
  }

  // 단일 목차 수정 (사용자 요청에 따른 수정)
  async refineOutline(currentOutline, modificationRequest, conversations = [], selectedFormat = 'chronological') {
    try {
      // 대화 데이터 정리
      const conversationsText = conversations.map((conv, index) => 
        `${index + 1}. 질문: ${conv.question}\n   답변: ${conv.answer || '(답변 대기중)'}`
      ).join('\n\n');

      // 현재 목차를 JSON 문자열로 변환
      const currentOutlineText = JSON.stringify(currentOutline, null, 2);

      // 수정 프롬프트 로드
      const prompt = await loadPromptWithTemplate('outline-refiner.md', {
        CURRENT_OUTLINE: currentOutlineText,
        MODIFICATION_REQUEST: modificationRequest,
        CONVERSATIONS: conversationsText
      });

      if (!prompt) {
        throw new Error('목차 수정 프롬프트 파일을 불러올 수 없습니다.');
      }

      const systemInstruction = `당신은 자서전 목차 수정 전문가입니다.
      사용자의 수정 요청을 정확히 반영하여 기존 목차를 개선하세요.
      전체를 바꾸기보다는 요청된 부분을 중심으로 수정하고, 전체적인 완성도는 유지하세요.`;

      const response = await geminiService.generateStructured(
        prompt,
        'outline', // 스키마 이름을 문자열로 전달
        systemInstruction
      );

      if (!response.success) {
        throw new Error(response.error || '목차 수정에 실패했습니다.');
      }

      // 수정된 목차 검증 및 반환
      const processedOutline = this.validateAndProcessOutline(response.data, selectedFormat);

      return {
        data: processedOutline,
        success: true
      };

    } catch (error) {
      console.error('OutlineAgent 목차 수정 오류:', error);
      return {
        data: null,
        success: false,
        error: error.message
      };
    }
  }

  // 텍스트 응답을 목차 구조로 파싱
  parseTextOutline(text) {
    const chapters = [];
    const lines = text.split('\n').filter(line => line.trim());
    
    let chapterNumber = 1;
    for (const line of lines) {
      // "제1장", "1장", "Chapter" 등으로 시작하는 줄 찾기
      if (line.match(/^(제?\d+장|Chapter\s*\d+|Part\s*\d+)/i)) {
        const title = line.replace(/^(제?\d+장\.?\s*|Chapter\s*\d+\.?\s*|Part\s*\d+\.?\s*)/i, '').trim();
        if (title) {
          chapters.push({
            chapter_number: chapterNumber++,
            title: title,
            theme: "인생의 한 단면",
            key_events: [],
            estimated_length: "보통",
            emotional_tone: "성찰적"
          });
        }
      }
    }

    // 최소 3개 장은 확보
    while (chapters.length < 3) {
      chapters.push({
        chapter_number: chapters.length + 1,
        title: `인생의 ${chapters.length + 1}번째 이야기`,
        theme: "성장과 경험",
        key_events: [],
        estimated_length: "보통",
        emotional_tone: "성찰적"
      });
    }

    return chapters;
  }

  // 3개 시안 검증 및 후처리
  validateAndProcessOutlineOptions(data, selectedFormat = 'chronological') {
    const formatTypeMap = {
      'chronological': '연대기순',
      'essay': '에세이형',
      'memoir': '회고록형',
      'interview': '인터뷰형'
    };

    const processedData = {
      options: []
    };

    // options 배열 확인 및 처리
    if (data.options && Array.isArray(data.options)) {
      processedData.options = data.options.map((option, index) => ({
        option_number: option.option_number || (index + 1),
        concept: option.concept || `시안 ${index + 1}`,
        format_type: option.format_type || formatTypeMap[selectedFormat] || "연대기순",
        overall_theme: option.overall_theme || "인생 이야기",
        chapters: this.processChapters(option.chapters)
      }));
    }

    // 최소 3개 시안 보장
    while (processedData.options.length < 3) {
      const num = processedData.options.length + 1;
      processedData.options.push({
        option_number: num,
        concept: `시안 ${num}`,
        format_type: formatTypeMap[selectedFormat] || "연대기순",
        overall_theme: "인생 이야기",
        chapters: this.generateDefaultChapters()
      });
    }

    return processedData;
  }

  // 단일 목차 검증 및 후처리
  validateAndProcessOutline(data, selectedFormat = 'chronological') {
    const formatTypeMap = {
      'chronological': '연대기순',
      'essay': '에세이형',
      'memoir': '회고록형',
      'interview': '인터뷰형'
    };
    
    const processedData = {
      format_type: data.format_type || formatTypeMap[selectedFormat] || "연대기순",
      overall_theme: data.overall_theme || "인생 이야기",
      chapters: data.chapters || []
    };

    processedData.chapters = this.processChapters(processedData.chapters);

    return processedData;
  }

  // 챕터 처리 공통 함수
  processChapters(chapters = []) {
    return chapters.map((chapter, index) => ({
      chapter_number: chapter.chapter_number || (index + 1),
      title: chapter.title || `제${index + 1}장`,
      theme: chapter.theme || "인생의 한 단면",
      key_events: Array.isArray(chapter.key_events) ? chapter.key_events : [],
      estimated_length: chapter.estimated_length || "보통",
      emotional_tone: chapter.emotional_tone || "성찰적"
    }));
  }

  // 기본 챕터 생성
  generateDefaultChapters() {
    return [
      {
        chapter_number: 1,
        title: "시작",
        theme: "인생의 출발점",
        key_events: [],
        estimated_length: "보통",
        emotional_tone: "희망적"
      },
      {
        chapter_number: 2,
        title: "성장",
        theme: "배움과 발전",
        key_events: [],
        estimated_length: "보통",
        emotional_tone: "성찰적"
      },
      {
        chapter_number: 3,
        title: "현재와 미래",
        theme: "지금의 나, 앞으로의 나",
        key_events: [],
        estimated_length: "보통",
        emotional_tone: "희망적"
      }
    ];
  }

  // 기존 generateOutline 메서드 (호환성 유지)
  async generateOutline(conversations = [], mindmapData = null, selectedFormat = 'chronological') {
    // 3개 시안 생성 후 첫 번째 반환
    const result = await this.generateOutlineOptions(conversations, mindmapData, selectedFormat);
    if (result.success && result.data.options && result.data.options.length > 0) {
      const firstOption = result.data.options[0];
      return {
        data: {
          format_type: firstOption.format_type,
          overall_theme: firstOption.overall_theme,
          chapters: firstOption.chapters
        },
        success: true
      };
    }
    return result;
  }
}

export default new OutlineAgent();