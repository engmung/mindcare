import { GoogleGenAI, Type } from '@google/genai';

// Schema definitions for structured output
export const schemas = {
  partial_edit: {
    type: Type.OBJECT,
    properties: {
      modified_text: {
        type: Type.STRING,
        description: "수정된 텍스트"
      },
      edit_summary: {
        type: Type.STRING,
        description: "수정 내용 요약"
      },
      change_type: {
        type: Type.STRING,
        enum: ["grammar", "style", "content", "structure", "tone"],
        description: "수정 유형"
      }
    },
    required: ["modified_text", "edit_summary", "change_type"]
  },

  question: {
    type: Type.OBJECT,
    properties: {
      question: {
        type: Type.STRING,
        description: "생성된 질문 내용"
      }
    },
    required: ["question"]
  },

  mindmap: {
    type: Type.OBJECT,
    properties: {
      keywords: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            content: { type: Type.STRING },
            category: {
              type: Type.STRING,
              enum: ["사람", "장소", "사건", "감정", "가치관", "취미", "직업", "기타"]
            },
            importance: {
              type: Type.NUMBER,
              minimum: 1,
              maximum: 10
            }
          },
          required: ["id", "content", "category", "importance"]
        }
      },
      emotions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            emotion: { type: Type.STRING },
            intensity: {
              type: Type.NUMBER,
              minimum: 1,
              maximum: 10
            },
            context: { type: Type.STRING }
          },
          required: ["emotion", "intensity", "context"]
        }
      },
      people: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            relationship: { type: Type.STRING },
            importance: {
              type: Type.NUMBER,
              minimum: 1,
              maximum: 10
            },
            description: { type: Type.STRING }
          },
          required: ["name", "relationship", "importance"]
        }
      },
      connections: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            from_keyword: { type: Type.STRING },
            to_keyword: { type: Type.STRING },
            connection_type: {
              type: Type.STRING,
              enum: ["원인", "결과", "연관", "대조", "시간순", "영향"]
            },
            strength: {
              type: Type.NUMBER,
              minimum: 1,
              maximum: 10
            }
          },
          required: ["from_keyword", "to_keyword", "connection_type", "strength"]
        }
      },
      timeframe: {
        type: Type.OBJECT,
        properties: {
          period: { type: Type.STRING },
          specific_date: { type: Type.STRING },
          life_stage: {
            type: Type.STRING,
            enum: ["유아기", "아동기", "청소년기", "청년기", "중년기", "노년기"]
          }
        }
      }
    },
    required: ["keywords", "emotions", "people", "connections"]
  },

  outline: {
    type: Type.OBJECT,
    properties: {
      format_type: {
        type: Type.STRING,
        enum: ["연대기순", "주제별", "에세이형", "회고록형", "인터뷰형"]
      },
      overall_theme: { type: Type.STRING },
      chapters: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            chapter_number: { type: Type.NUMBER },
            title: { type: Type.STRING },
            theme: { type: Type.STRING },
            key_events: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            estimated_length: { type: Type.STRING },
            emotional_tone: { type: Type.STRING }
          },
          required: ["chapter_number", "title", "theme", "key_events"]
        }
      }
    },
    required: ["format_type", "overall_theme", "chapters"]
  },

  outlineOptions: {
    type: Type.OBJECT,
    properties: {
      options: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            option_number: { type: Type.NUMBER },
            concept: { type: Type.STRING },
            format_type: {
              type: Type.STRING,
              enum: ["연대기순", "주제별", "에세이형", "회고록형", "인터뷰형"]
            },
            overall_theme: { type: Type.STRING },
            chapters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  chapter_number: { type: Type.NUMBER },
                  title: { type: Type.STRING },
                  theme: { type: Type.STRING },
                  key_events: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  estimated_length: { type: Type.STRING },
                  emotional_tone: { type: Type.STRING }
                },
                required: ["chapter_number", "title", "theme", "key_events"]
              }
            }
          },
          required: ["option_number", "concept", "format_type", "overall_theme", "chapters"]
        }
      }
    },
    required: ["options"]
  },

  manuscript: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "자서전 제목"
      },
      chapters: {
        type: Type.ARRAY,
        description: "장별로 구조화된 원고 내용",
        items: {
          type: Type.OBJECT,
          properties: {
            chapter_number: {
              type: Type.NUMBER,
              description: "장 번호 (1, 2, 3...)"
            },
            chapter_title: {
              type: Type.STRING,
              description: "장 제목 (제목만, '제1장:' 형식 제외)"
            },
            content: {
              type: Type.STRING,
              description: "해당 장의 순수한 내용 - 1인칭 시점, 최소 10,000자"
            }
          },
          required: ["chapter_number", "chapter_title", "content"]
        }
      },
      metadata: {
        type: Type.OBJECT,
        properties: {
          total_characters: { type: Type.NUMBER },
          chapter_count: { type: Type.NUMBER },
          estimated_reading_time: { type: Type.STRING }
        }
      }
    },
    required: ["chapters"]
  }
};

class GeminiService {
  constructor() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    console.log('API Key:', apiKey ? 'Set' : 'Not Set');
    
    if (!apiKey) {
      throw new Error('Gemini API Key가 설정되지 않았습니다. .env 파일을 확인해주세요.');
    }
    
    this.ai = new GoogleGenAI({
      apiKey: apiKey,
    });
  }

  async generate(prompt, config = {}) {
    try {
      const contents = [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ];

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: config
      });

      const text = response.text;

      console.log('Full response:', response);

      return {
        text: text,
        success: true
      };
    } catch (error) {
      console.error('Gemini API Error:', error);
      return {
        text: '질문 생성 중 오류가 발생했습니다.',
        success: false,
        error: error.message
      };
    }
  }

  async generateStructured(prompt, schemaName, systemInstruction = null) {
    try {
      const schema = schemas[schemaName];
      if (!schema) {
        throw new Error(`Unknown schema: ${schemaName}`);
      }
      
      const contents = [
        {
          role: 'user',
          parts: [
            {
              text: systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt,
            },
          ],
        },
      ];

      const config = {
        responseMimeType: 'application/json',
        responseSchema: schema,
      };

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: config
      });
      const text = response.text;
      console.log('Structured response:', response);
      console.log('Response text:', text);

      let jsonData;
      try {
        // response.text()는 항상 문자열을 반환
        jsonData = JSON.parse(text);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('Response text that failed to parse:', text);
        
        // Structured Output 실패 시 fallback - 스키마에 따라 처리
        if (text && typeof text === 'string') {
          if (schemaName === 'manuscript') {
            // 원고 스키마 fallback - 문자열을 파싱해서 장별로 분리
            const chapters = [];
            const lines = text.split('\n');
            let currentChapter = null;
            let currentContent = [];
            
            for (const line of lines) {
              const trimmedLine = line.trim();
              const chapterMatch = trimmedLine.match(/^제(\d+)장[:\.]?\s*(.+)$/);
              
              if (chapterMatch) {
                // 이전 장 저장
                if (currentChapter && currentContent.length > 0) {
                  chapters.push({
                    chapter_number: currentChapter.number,
                    chapter_title: currentChapter.title,
                    content: currentContent.join('\n').trim()
                  });
                }
                
                // 새 장 시작
                currentChapter = {
                  number: parseInt(chapterMatch[1]),
                  title: chapterMatch[2].trim()
                };
                currentContent = [];
              } else if (currentChapter) {
                currentContent.push(line);
              }
            }
            
            // 마지막 장 처리
            if (currentChapter && currentContent.length > 0) {
              chapters.push({
                chapter_number: currentChapter.number,
                chapter_title: currentChapter.title,
                content: currentContent.join('\n').trim()
              });
            }
            
            return {
              data: {
                chapters: chapters.length > 0 ? chapters : [{
                  chapter_number: 1,
                  chapter_title: "자서전",
                  content: text.trim()
                }],
                metadata: {
                  total_characters: text.length,
                  chapter_count: chapters.length || 1,
                  estimated_reading_time: `약 ${Math.ceil(text.length / 1000)}분`
                }
              },
              success: true
            };
          } else {
            // 다른 스키마는 기본 처리
            return {
              data: {
                question: text.trim()
              },
              success: true
            };
          }
        }
        
        return {
          data: null,
          success: false,
          error: 'JSON 파싱 오류: ' + parseError.message
        };
      }

      return {
        data: jsonData,
        success: true
      };
    } catch (error) {
      console.error('Gemini Structured API Error:', error);
      return {
        data: null,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Function Calling API 호출
   * @google/genai의 최신 Function Calling 방식 사용
   */
  async generateWithFunctions(prompt, functions, systemInstruction = null) {
    try {
      const contents = [
        {
          role: 'user',
          parts: [
            {
              text: systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt,
            },
          ],
        },
      ];

      // Function declarations 준비
      const tools = [{
        functionDeclarations: functions
      }];

      const config = {
        tools: tools,
        toolConfig: {
          functionCallingConfig: {
            mode: 'ANY' // 함수 호출을 반드시 수행
          }
        }
      };

      console.log('Function Calling Config:', JSON.stringify(config, null, 2));

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: config
      });

      console.log('Function Calling Response:', response);

      // Function call 결과 추출
      const functionCalls = response.candidates?.[0]?.content?.parts?.filter(
        part => part.functionCall
      );

      if (functionCalls && functionCalls.length > 0) {
        return {
          functionCalls: functionCalls.map(fc => ({
            name: fc.functionCall.name,
            args: fc.functionCall.args
          })),
          success: true
        };
      }

      // Function call이 없는 경우 텍스트 응답
      const text = response.text || '함수 호출 결과를 받지 못했습니다.';
      return {
        functionCalls: [],
        text: text,
        success: true
      };

    } catch (error) {
      console.error('Gemini Function Calling Error:', error);
      return {
        functionCalls: [],
        text: null,
        success: false,
        error: error.message
      };
    }
  }
}

const geminiService = new GeminiService();
export default geminiService;