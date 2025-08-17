import Anthropic from '@anthropic-ai/sdk';

/**
 * Claude API Service
 * 
 * Anthropic Claude API와의 통신을 담당하는 서비스
 * 문체 변환 등의 고급 텍스트 처리에 사용
 * @anthropic-ai/sdk를 사용하여 CORS 문제 해결
 */

class ClaudeService {
  constructor() {
    // API 키는 환경변수에서 가져오기
    this.apiKey = import.meta.env.VITE_CLAUDE_API_KEY || '';
    this.model = 'claude-sonnet-4-20250514'; // 최신 Claude Sonnet 4 모델 사용
    
    if (!this.apiKey) {
      console.warn('Claude API key not found. Please set VITE_CLAUDE_API_KEY in your environment.');
      this.client = null;
    } else {
      // Anthropic 클라이언트 초기화
      this.client = new Anthropic({
        apiKey: this.apiKey,
        dangerouslyAllowBrowser: true // 브라우저에서 사용 허용
      });
    }
  }

  /**
   * Claude API에 메시지 전송
   * @param {string} systemPrompt - 시스템 프롬프트
   * @param {string} userMessage - 사용자 메시지
   * @param {number} maxTokens - 최대 토큰 수
   * @returns {Promise<Object>} API 응답
   */
  async sendMessage(systemPrompt, userMessage, maxTokens = 4096) {
    if (!this.client) {
      throw new Error('Claude API client is not configured');
    }

    try {
      console.log('ClaudeService - Sending message to Claude API via SDK');
      
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userMessage
          }
        ]
      });

      console.log('ClaudeService - Response received successfully');
      
      return {
        success: true,
        content: message.content[0].text,
        usage: message.usage,
        stopReason: message.stop_reason
      };
      
    } catch (error) {
      console.error('ClaudeService Error:', error);
      return {
        success: false,
        error: error.message,
        content: null
      };
    }
  }

  /**
   * 문체 변환 전용 메서드
   * @param {string} originalText - 원본 텍스트
   * @param {string} targetStyle - 목표 문체
   * @param {string} additionalInstructions - 추가 지시사항
   * @param {string} previousStyleSample - 이전 문체 샘플 (일관성 유지용)
   * @returns {Promise<Object>} 변환 결과
   */
  async transformStyle(originalText, targetStyle, additionalInstructions = '', previousStyleSample = '') {
    const systemPrompt = `당신은 전문적인 문체 편집자입니다. 
자서전 원고의 문체를 자연스럽고 일관되게 변환하는 것이 당신의 역할입니다.
원문의 의미와 정보는 정확히 보존하면서, 요청된 문체로 자연스럽게 변환해주세요.

중요 원칙:
1. 원문의 사실과 정보를 변경하지 마세요
2. 1인칭 시점을 유지하세요
3. 문체는 일관되게 적용하세요
4. 자연스러운 한국어 표현을 사용하세요
5. **⚠️ 문단 구조 절대 유지**: 원문이 문단 나누기 없이 연속된 텍스트라면, 변환 후에도 동일하게 연속된 텍스트로 유지해야 합니다. 임의로 문단을 나누지 마세요.
6. **분량 유지**: 원문과 비슷한 길이를 유지하되, 문체 변환으로 인한 자연스러운 길이 변화는 허용됩니다`;

    let userMessage = `<original_text>
${originalText}
</original_text>

<target_style>
${targetStyle}
</target_style>`;

    if (additionalInstructions) {
      userMessage += `\n\n<additional_instructions>
${additionalInstructions}
</additional_instructions>`;
    }

    if (previousStyleSample) {
      userMessage += `\n\n<previous_style_sample>
이전에 적용한 문체의 예시입니다. 일관성을 위해 참고해주세요:
${previousStyleSample}
</previous_style_sample>`;
    }

    userMessage += `\n\n위의 원문을 지정된 문체로 변환해주세요. 

**중요**: 
- 원문의 문단 구조를 정확히 그대로 유지하세요
- 원문이 하나의 긴 문단이라면, 변환 후에도 하나의 긴 문단으로 유지하세요
- 임의로 줄바꿈을 추가하거나 문단을 나누지 마세요
- 변환된 텍스트만 출력하고, 설명이나 주석은 포함하지 마세요`;

    // 문체 변환에는 더 많은 토큰이 필요할 수 있으므로 maxTokens 증가
    const maxTokens = Math.max(8192, Math.floor(originalText.length * 1.5)); // 원문 길이의 1.5배 또는 최소 8192
    const result = await this.sendMessage(systemPrompt, userMessage, maxTokens);
    
    if (result.success) {
      return {
        success: true,
        transformedText: result.content.trim(),
        usage: result.usage
      };
    } else {
      return {
        success: false,
        error: result.error,
        transformedText: null
      };
    }
  }

  /**
   * API 키 설정
   * @param {string} apiKey - Claude API 키
   */
  setApiKey(apiKey) {
    this.apiKey = apiKey;
    
    if (apiKey) {
      // 새로운 클라이언트 생성
      this.client = new Anthropic({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      });
      console.log('ClaudeService - API key updated and client reinitialized');
    } else {
      this.client = null;
      console.log('ClaudeService - API key cleared');
    }
  }

  /**
   * API 키 유효성 확인
   * @returns {boolean} API 키 설정 여부
   */
  hasApiKey() {
    return !!this.client;
  }
}

export default new ClaudeService();