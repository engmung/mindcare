import geminiService, { schemas } from '../services/geminiService.js';

class OrganizationAgent {
  async analyzeMindmap(conversation) {
    try {
      const { question, answer } = conversation;
      
      if (!answer || answer.trim() === '') {
        return {
          data: null,
          success: false,
          error: '분석할 답변이 없습니다.'
        };
      }

      const prompt = `
다음 자서전 질문과 답변을 분석하여 마인드맵 데이터를 추출해주세요:

질문: ${question}
답변: ${answer}

이 대화에서 다음 요소들을 추출하고 분석해주세요:
1. 핵심 키워드들 (사람, 장소, 사건, 감정, 가치관, 취미, 직업 등)
2. 감정 상태와 강도
3. 언급된 사람들과 관계
4. 키워드 간의 연결 관계
5. 시간적 맥락

각 요소는 중요도(1-10)와 함께 추출해주세요.
`;

      const systemInstruction = `당신은 자서전 내용 분석 전문가입니다. 
      사용자의 답변에서 핵심 정보를 추출하여 구조화된 마인드맵 데이터로 변환하는 것이 목표입니다.
      모든 키워드와 연결관계는 한국어로 추출하며, 감정 분석도 정확히 수행해야 합니다.`;

      const response = await geminiService.generateStructured(
        prompt,
        'mindmap', // 스키마 이름을 문자열로 전달
        systemInstruction
      );

      if (!response.success) {
        console.error('Structured mindmap analysis failed:', response.error);
        return {
          data: null,
          success: false,
          error: response.error
        };
      }

      // 데이터 검증 및 후처리
      const mindmapData = this.validateAndProcessMindmapData(response.data);

      return {
        data: mindmapData,
        success: true
      };

    } catch (error) {
      console.error('OrganizationAgent mindmap analysis error:', error);
      return {
        data: null,
        success: false,
        error: error.message
      };
    }
  }

  validateAndProcessMindmapData(data) {
    // 기본 구조 확인 및 초기화
    const processedData = {
      keywords: data.keywords || [],
      emotions: data.emotions || [],
      people: data.people || [],
      connections: data.connections || [],
      timeframe: data.timeframe || {}
    };

    // 키워드 ID 자동 생성 (없는 경우)
    processedData.keywords = processedData.keywords.map((keyword, index) => ({
      ...keyword,
      id: keyword.id || `kw_${Date.now()}_${index}`
    }));

    // 중요도 범위 검증 (1-10)
    processedData.keywords = processedData.keywords.map(keyword => ({
      ...keyword,
      importance: Math.max(1, Math.min(10, keyword.importance || 5))
    }));

    processedData.emotions = processedData.emotions.map(emotion => ({
      ...emotion,
      intensity: Math.max(1, Math.min(10, emotion.intensity || 5))
    }));

    processedData.people = processedData.people.map(person => ({
      ...person,
      importance: Math.max(1, Math.min(10, person.importance || 5))
    }));

    processedData.connections = processedData.connections.map(connection => ({
      ...connection,
      strength: Math.max(1, Math.min(10, connection.strength || 5))
    }));

    return processedData;
  }

  async generateOutline(conversations, mindmapData) {
    try {
      if (!conversations || conversations.length === 0) {
        return {
          data: null,
          success: false,
          error: '자서전 개요를 생성할 대화 데이터가 없습니다.'
        };
      }

      // 전체 대화 요약
      const conversationSummary = conversations.map((conv, index) => 
        `${index + 1}. Q: ${conv.question}\n   A: ${conv.answer || '(미응답)'}`
      ).join('\n\n');

      // 마인드맵 요약 (있는 경우)
      let mindmapSummary = '';
      if (mindmapData && mindmapData.keywords) {
        const topKeywords = mindmapData.keywords
          .sort((a, b) => b.importance - a.importance)
          .slice(0, 10)
          .map(k => `${k.content}(${k.category})`)
          .join(', ');
        
        const topEmotions = mindmapData.emotions
          .sort((a, b) => b.intensity - a.intensity)
          .slice(0, 5)
          .map(e => `${e.emotion}(강도:${e.intensity})`)
          .join(', ');

        mindmapSummary = `
주요 키워드: ${topKeywords}
주요 감정: ${topEmotions}
`;
      }

      const prompt = `
다음 자서전 대화 내용을 바탕으로 체계적인 자서전 개요를 생성해주세요:

=== 대화 내용 ===
${conversationSummary}

=== 마인드맵 분석 ===
${mindmapSummary}

위 내용을 종합하여 자서전의 전체 구성을 계획해주세요. 
대화에서 드러난 인생의 주요 시기, 사건, 감정, 인물관계 등을 고려하여 
읽기 쉽고 감동적인 자서전 구조를 만들어주세요.
`;

      const systemInstruction = `당신은 자서전 구성 전문가입니다. 
      사용자의 인생 이야기를 바탕으로 체계적이고 감동적인 자서전 개요를 작성하는 것이 목표입니다.
      각 장의 주제와 흐름이 자연스럽게 연결되도록 구성하고, 독자가 몰입할 수 있는 구조를 만들어주세요.`;

      const response = await geminiService.generateStructured(
        prompt,
        'outline', // 스키마 이름을 문자열로 전달
        systemInstruction
      );

      if (!response.success) {
        console.error('Structured outline generation failed:', response.error);
        return {
          data: null,
          success: false,
          error: response.error
        };
      }

      return {
        data: response.data,
        success: true
      };

    } catch (error) {
      console.error('OrganizationAgent outline generation error:', error);
      return {
        data: null,
        success: false,
        error: error.message
      };
    }
  }
}

export default new OrganizationAgent();