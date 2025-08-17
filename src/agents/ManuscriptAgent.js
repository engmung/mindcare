import { loadPromptWithTemplate } from '../utils/promptLoader.js';
import geminiService from '../services/geminiService.js';
import { loadOutlineData, loadConversations } from '../utils/dataManager.js';

class ManuscriptAgent {
  async generateManuscript(options = {}) {
    try {
      console.log('ManuscriptAgent - 원고 생성 시작');
      
      // 기본 데이터 로드
      const conversations = options.conversations || loadConversations();
      const outlineData = options.outlineData || loadOutlineData();
      
      // 필수 데이터 검증
      if (!conversations || conversations.length === 0) {
        throw new Error('대화 데이터가 필요합니다.');
      }
      
      if (!outlineData || !outlineData.chapters) {
        throw new Error('목차 데이터가 필요합니다.');
      }
      
      console.log(`- 대화 수: ${conversations.length}`);
      console.log(`- 목차 형식: ${outlineData.format_type}`);
      console.log(`- 목차 장 수: ${outlineData.chapters.length}`);
      
      // 대화 내용을 텍스트로 정리
      const conversationsText = this.formatConversations(conversations);
      
      // 목차 구조를 텍스트로 정리
      const outlineText = this.formatOutline(outlineData);
      
      // 사용자 기본 정보 가져오기
      const userInfo = this.getUserInfo(options);
      
      // 프롬프트 로드 및 템플릿 적용
      const prompt = await loadPromptWithTemplate('manuscript-writer.md', {
        USER_NAME: userInfo.name || '사용자',
        USER_BIRTH_DATE: userInfo.birthDate || '정보 없음',
        CONVERSATIONS: conversationsText,
        SELECTED_FORMAT: outlineData.format_type || '연대기순',
        OUTLINE: outlineText
      });
      
      if (!prompt) {
        throw new Error('원고 작성 프롬프트를 불러올 수 없습니다.');
      }
      
      console.log('ManuscriptAgent - 프롬프트 준비 완료');
      
      // 시스템 인스트럭션 정의
      const systemInstruction = `당신은 전문적인 자서전 작가입니다. 
사용자의 대화 내용과 목차를 바탕으로 감동적이고 진솔한 자서전 원고를 작성하세요.

중요 지침:
1. 1인칭 시점으로 작성
2. 사용자가 실제로 말한 내용과 경험을 기반으로 작성
3. 각 장은 독립적이면서도 전체적으로 연결되도록 구성
4. 자연스러운 문체와 감정 표현 사용
5. 목차에 제시된 각 장의 주제와 분량을 준수`;
      
      // ========== 원고 생성 AI 프롬프트 전체 내용 (복사용) ==========
      console.log('\n==================== 원고 생성 AI 프롬프트 시작 ====================');
      console.log('【System Instruction】');
      console.log(systemInstruction);
      console.log('\n【User Prompt】');
      console.log(prompt);
      console.log('==================== 원고 생성 AI 프롬프트 끝 ====================\n');
      
      // Gemini API 호출 (Structured Output 사용)
      const response = await geminiService.generateStructured(prompt, 'manuscript', systemInstruction);
      
      if (!response.success) {
        throw new Error(response.error || '원고 생성에 실패했습니다.');
      }
      
      console.log('ManuscriptAgent - 원고 생성 성공');
      
      // Structured Output에서 원고 내용 추출
      const manuscriptData = response.data;
      
      // 구조화된 chapters 배열이 있는 경우
      if (manuscriptData.chapters && Array.isArray(manuscriptData.chapters)) {
        console.log(`ManuscriptAgent - 구조화된 ${manuscriptData.chapters.length}개 장 처리`);
        
        return {
          manuscript: null, // 더 이상 단일 문자열 사용 안함
          chapters: manuscriptData.chapters,
          success: true,
          metadata: {
            format: outlineData.format_type,
            chapterCount: manuscriptData.chapters.length,
            conversationCount: conversations.length,
            generatedAt: new Date().toISOString(),
            totalCharacters: manuscriptData.metadata?.total_characters || 
              manuscriptData.chapters.reduce((total, chapter) => total + chapter.content.length, 0),
            estimatedReadingTime: manuscriptData.metadata?.estimated_reading_time || '미정'
          }
        };
      } 
      
      // Fallback: 기존 방식 지원 (content 필드)
      const manuscript = manuscriptData.content || response.text?.trim() || '';
      console.log('ManuscriptAgent - Fallback: 단일 문자열 원고 처리');
      
      return {
        manuscript: manuscript,
        chapters: null,
        success: true,
        metadata: {
          format: outlineData.format_type,
          chapterCount: outlineData.chapters.length,
          conversationCount: conversations.length,
          generatedAt: new Date().toISOString(),
          totalCharacters: manuscriptData.metadata?.total_characters || manuscript.length,
          estimatedReadingTime: manuscriptData.metadata?.estimated_reading_time || '미정'
        }
      };
      
    } catch (error) {
      console.error('ManuscriptAgent 오류:', error);
      return {
        manuscript: null,
        success: false,
        error: error.message
      };
    }
  }
  
  // 사용자 기본 정보 가져오기
  getUserInfo(options = {}) {
    // localStorage에서 사용자 정보 가져오기
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const userProjects = JSON.parse(localStorage.getItem('userProjects') || '[]');
      
      // 현재 프로젝트 정보에서 사용자 데이터 찾기
      let userInfo = {
        name: currentUser.name || '',
        birthDate: currentUser.birthDate || ''
      };
      
      // 프로젝트별 사용자 정보가 있다면 우선 사용
      if (options.projectId) {
        const project = userProjects.find(p => p.id === options.projectId);
        if (project && project.userInfo) {
          userInfo = {
            name: project.userInfo.name || userInfo.name,
            birthDate: project.userInfo.birthDate || userInfo.birthDate
          };
        }
      }
      
      return userInfo;
    } catch (error) {
      console.warn('사용자 정보 로드 실패:', error);
      return {
        name: '사용자',
        birthDate: '정보 없음'
      };
    }
  }
  
  // 대화 내용을 원고용 텍스트로 정리
  formatConversations(conversations) {
    return conversations.map((conv, index) => {
      return `${index + 1}. 질문: ${conv.question}\n   답변: ${conv.answer || '(답변 없음)'}`;
    }).join('\n\n');
  }
  
  // 목차 구조를 텍스트로 정리
  formatOutline(outlineData) {
    let text = `형식: ${outlineData.format_type}\n`;
    text += `전체 주제: ${outlineData.overall_theme}\n\n`;
    text += '목차:\n';
    
    outlineData.chapters.forEach(chapter => {
      text += `${chapter.chapter_number}장. ${chapter.title}\n`;
      text += `   - 주제: ${chapter.theme}\n`;
      if (chapter.key_events && chapter.key_events.length > 0) {
        text += `   - 주요 사건: ${chapter.key_events.join(', ')}\n`;
      }
      if (chapter.emotional_tone) {
        text += `   - 감정 톤: ${chapter.emotional_tone}\n`;
      }
      text += '\n';
    });
    
    return text;
  }
}

export default new ManuscriptAgent();