import { create } from 'zustand';
import ManuscriptAgent from '../agents/ManuscriptAgent.js';
import PartialEditAgent from '../agents/PartialEditAgent.js';
import ManuscriptQuestionAgent from '../agents/ManuscriptQuestionAgent.js';
import StyleAgent from '../agents/StyleAgent.js';

/**
 * manuscriptStore
 * 
 * 용도: 원고 편집 단계에서의 상태 관리
 * 기능: 원고 생성, 부분 수정, 질문 생성, 편집 히스토리 관리
 */

const useManuscriptStore = create((set, get) => ({
  // ===== 기본 상태 =====
  
  // 현재 원고 내용
  currentManuscript: '',
  
  // 원고 생성 상태
  isGenerating: false,
  generationError: null,
  
  // 편집 관련 상태
  isEditing: false,
  editingError: null,
  selectedText: '',
  
  // AI 상호작용 패널 상태
  aiMode: 'modify', // 'modify' | 'question'
  isAiProcessing: false,
  
  // 편집 히스토리 (Undo/Redo)
  editHistory: [],
  currentHistoryIndex: -1,
  maxHistorySize: 50,
  
  // 하이라이트된 수정 영역들
  highlightedEdits: [],
  
  // 질문 생성 결과
  generatedQuestions: [],
  
  // 목차 및 컨텍스트 정보
  outline: null,
  
  // 현재 프로젝트 ID (자동 저장용)
  currentProjectId: null,
  
  // ===== 직접 편집 모드 상태 =====
  
  // 직접 편집 모드 활성화/비활성화
  isDirectEditMode: false,
  
  // ===== 이미지 관리 상태 =====
  
  // 원고에 포함된 이미지 목록
  manuscriptImages: [],
  
  // ===== 문체 변경 모드 상태 =====
  
  // 문체 변경 모드 활성화 여부
  isStyleMode: false,
  
  // 현재 선택된 문체
  currentStyle: null,
  
  // 문체 미리보기 텍스트
  stylePreview: '',
  
  // 미리보기에 사용된 원본 선택 텍스트 (미리보기 표시용)
  previewOriginalText: '',
  
  // 문체 미리보기를 원고에서 표시할지 여부
  showStylePreviewInManuscript: true,
  
  // 문체 처리 중 상태
  isStyleProcessing: false,
  styleError: null,
  
  // 마지막 적용된 문체 샘플 (일관성 유지용)
  previousStyleSample: '',
  
  // 원본 원고 백업 (문체 적용 취소용)
  originalManuscript: '',
  
  // localStorage 키
  STORAGE_KEY: 'manuscript_style_state',
  
  // ===== 원고 생성 액션 =====
  
  // 초기 원고 생성
  generateManuscript: async (options = {}) => {
    set({ isGenerating: true, generationError: null });
    
    try {
      console.log('manuscriptStore - 원고 생성 시작');
      
      const result = await ManuscriptAgent.generateManuscript(options);
      
      if (result.success) {
        let manuscript = '';
        
        // 구조화된 chapters가 있는 경우
        if (result.chapters && Array.isArray(result.chapters)) {
          console.log(`manuscriptStore - 구조화된 ${result.chapters.length}개 장 처리`);
          
          // chapters 배열을 문자열로 변환 (기존 시스템과 호환성 유지)
          manuscript = result.chapters.map(chapter => {
            return `제${chapter.chapter_number}장: ${chapter.chapter_title}\n\n${chapter.content}`;
          }).join('\n\n');
          
        } else if (result.manuscript) {
          // Fallback: 기존 방식
          manuscript = result.manuscript;
          console.log('manuscriptStore - Fallback: 단일 문자열 원고 처리');
        } else {
          throw new Error('원고 데이터가 없습니다.');
        }
        
        // 초기 히스토리 설정
        const initialHistory = [{
          content: manuscript,
          timestamp: new Date().toISOString(),
          action: 'initial_generation',
          metadata: result.metadata
        }];
        
        set({
          currentManuscript: manuscript,
          editHistory: initialHistory,
          currentHistoryIndex: 0,
          outline: options.outlineData || null,
          isGenerating: false,
          generationError: null
        });
        
        console.log('manuscriptStore - 원고 생성 완료');
        return { success: true, manuscript };
      } else {
        set({ 
          isGenerating: false, 
          generationError: result.error 
        });
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('manuscriptStore 원고 생성 오류:', error);
      set({ 
        isGenerating: false, 
        generationError: error.message 
      });
      return { success: false, error: error.message };
    }
  },
  
  // ===== 텍스트 선택 및 편집 액션 =====
  
  // 텍스트 선택
  setSelectedText: (text) => {
    set({ selectedText: text });
  },
  
  // AI 모드 변경
  setAiMode: (mode) => {
    set({ aiMode: mode });
  },
  
  // 부분 수정 실행
  applyPartialEdit: async (modificationRequest) => {
    const { selectedText, currentManuscript, outline } = get();
    
    if (!selectedText || !selectedText.trim()) {
      return { success: false, error: '선택된 텍스트가 없습니다.' };
    }
    
    set({ isAiProcessing: true, editingError: null });
    
    try {
      console.log('manuscriptStore - 부분 수정 시작');
      
      // 컨텍스트 추출
      const context = PartialEditAgent.extractContext(currentManuscript, selectedText);
      
      // 부분 수정 실행
      const editResult = await PartialEditAgent.refineTextSegment(
        selectedText,
        modificationRequest,
        {
          fullManuscript: currentManuscript,
          outline: outline,
          previousContext: context.previousContext,
          nextContext: context.nextContext
        }
      );
      
      if (editResult.success) {
        // 원고에 수정 적용
        const applyResult = PartialEditAgent.applyEditToManuscript(
          currentManuscript,
          selectedText,
          editResult.modifiedText
        );
        
        if (applyResult.success) {
          // 히스토리에 추가
          get().addToHistory(applyResult.updatedManuscript, 'partial_edit', {
            originalText: selectedText,
            modifiedText: editResult.modifiedText,
            modificationRequest
          });
          
          // 하이라이트 영역 추가
          get().addHighlight(editResult.modifiedText, 'edit');
          
          set({
            currentManuscript: applyResult.updatedManuscript,
            selectedText: '',
            isAiProcessing: false
          });
          
          console.log('manuscriptStore - 부분 수정 완료');
          return { success: true, modifiedText: editResult.modifiedText };
        } else {
          set({ isAiProcessing: false, editingError: applyResult.error });
          return { success: false, error: applyResult.error };
        }
      } else {
        set({ isAiProcessing: false, editingError: editResult.error });
        return { success: false, error: editResult.error };
      }
    } catch (error) {
      console.error('manuscriptStore 부분 수정 오류:', error);
      set({ isAiProcessing: false, editingError: error.message });
      return { success: false, error: error.message };
    }
  },
  
  // 확장 질문 생성
  generateExpansionQuestions: async () => {
    const { selectedText, currentManuscript, outline } = get();
    
    if (!selectedText || !selectedText.trim()) {
      return { success: false, error: '선택된 텍스트가 없습니다.' };
    }
    
    set({ isAiProcessing: true });
    
    try {
      console.log('manuscriptStore - 확장 질문 생성 시작');
      
      // 컨텍스트 추출
      const context = ManuscriptQuestionAgent.extractContext(currentManuscript, selectedText);
      
      // 질문 생성
      const questionResult = await ManuscriptQuestionAgent.generateExpansionQuestions(
        selectedText,
        {
          fullManuscript: currentManuscript,
          outline: outline,
          previousContext: context.previousContext,
          nextContext: context.nextContext
        }
      );
      
      if (questionResult.success) {
        set({
          generatedQuestions: questionResult.questions,
          isAiProcessing: false
        });
        
        console.log('manuscriptStore - 확장 질문 생성 완료');
        return { success: true, questions: questionResult.questions };
      } else {
        set({ isAiProcessing: false });
        return { success: false, error: questionResult.error };
      }
    } catch (error) {
      console.error('manuscriptStore 질문 생성 오류:', error);
      set({ isAiProcessing: false });
      return { success: false, error: error.message };
    }
  },
  
  // ===== 편집 히스토리 관리 =====
  
  // 히스토리에 추가
  addToHistory: (content, action, metadata = {}) => {
    const { editHistory, currentHistoryIndex, maxHistorySize } = get();
    
    // 현재 인덱스 이후의 히스토리 제거 (새로운 분기 생성)
    const newHistory = editHistory.slice(0, currentHistoryIndex + 1);
    
    // 새 히스토리 항목 추가
    newHistory.push({
      content,
      timestamp: new Date().toISOString(),
      action,
      metadata
    });
    
    // 최대 크기 초과 시 오래된 항목 제거
    if (newHistory.length > maxHistorySize) {
      newHistory.shift();
    }
    
    set({
      editHistory: newHistory,
      currentHistoryIndex: newHistory.length - 1
    });
  },
  
  // Undo
  undo: () => {
    const { editHistory, currentHistoryIndex } = get();
    
    if (currentHistoryIndex > 0) {
      const newIndex = currentHistoryIndex - 1;
      const previousState = editHistory[newIndex];
      
      set({
        currentManuscript: previousState.content,
        currentHistoryIndex: newIndex,
        selectedText: ''
      });
      
      return true;
    }
    return false;
  },
  
  // Redo
  redo: () => {
    const { editHistory, currentHistoryIndex } = get();
    
    if (currentHistoryIndex < editHistory.length - 1) {
      const newIndex = currentHistoryIndex + 1;
      const nextState = editHistory[newIndex];
      
      set({
        currentManuscript: nextState.content,
        currentHistoryIndex: newIndex,
        selectedText: ''
      });
      
      return true;
    }
    return false;
  },
  
  // ===== 하이라이트 관리 =====
  
  // 하이라이트 추가
  addHighlight: (text, type = 'edit') => {
    const { highlightedEdits } = get();
    
    const newHighlight = {
      id: Date.now().toString(),
      text,
      type,
      timestamp: new Date().toISOString()
    };
    
    set({
      highlightedEdits: [...highlightedEdits, newHighlight]
    });
  },
  
  // 하이라이트 제거
  removeHighlight: (id) => {
    const { highlightedEdits } = get();
    set({
      highlightedEdits: highlightedEdits.filter(h => h.id !== id)
    });
  },
  
  // 모든 하이라이트 제거
  clearAllHighlights: () => {
    set({ highlightedEdits: [] });
  },
  
  // ===== 프로젝트 저장 관련 =====
  
  // 현재 프로젝트 ID 설정
  setCurrentProjectId: (projectId) => {
    set({ currentProjectId: projectId });
  },
  
  // 원고를 프로젝트에 자동 저장
  saveManuscriptToProject: async () => {
    const { currentManuscript, currentProjectId, manuscriptImages } = get();
    
    console.log('manuscriptStore - 자동 저장 시도:', {
      currentProjectId,
      manuscriptLength: currentManuscript?.length || 0,
      imageCount: manuscriptImages?.length || 0
    });
    
    if (!currentProjectId || !currentManuscript) {
      console.warn('manuscriptStore - 저장 실패: projectId 또는 manuscript가 없음');
      return;
    }
    
    try {
      // localStorage에서 직접 프로젝트 목록 가져오기
      const existingProjects = JSON.parse(localStorage.getItem('autobiography_projects') || '[]');
      const projectIndex = existingProjects.findIndex(p => p.id === currentProjectId);
      
      if (projectIndex === -1) {
        console.error('manuscriptStore - 프로젝트를 찾을 수 없음:', currentProjectId);
        return;
      }
      
      // 프로젝트 업데이트
      existingProjects[projectIndex] = {
        ...existingProjects[projectIndex],
        data: {
          ...existingProjects[projectIndex].data,
          manuscript: currentManuscript,
          manuscriptImages: manuscriptImages
        },
        updatedAt: new Date().toISOString()
      };
      
      // localStorage에 직접 저장
      localStorage.setItem('autobiography_projects', JSON.stringify(existingProjects));
      
      // projectStore도 업데이트
      const { useProjectStore } = await import('./projectStore.js');
      const projectStore = useProjectStore.getState();
      
      if (projectStore.updateProjectData) {
        projectStore.updateProjectData({ 
          manuscript: currentManuscript,
          manuscriptImages: manuscriptImages
        });
      }
      
      console.log('manuscriptStore - localStorage 직접 저장 완료:', {
        projectId: currentProjectId,
        manuscriptLength: currentManuscript.length,
        imageCount: manuscriptImages.length
      });
    } catch (error) {
      console.error('manuscriptStore - 원고 저장 실패:', error);
    }
  },
  
  // ===== 직접 편집 액션 =====
  
  // 직접 편집 모드 토글
  toggleDirectEditMode: () => {
    const { isDirectEditMode } = get();
    set({ isDirectEditMode: !isDirectEditMode });
    console.log('manuscriptStore - 직접 편집 모드:', !isDirectEditMode ? '활성화' : '비활성화');
  },
  
  // 직접 편집된 내용 업데이트
  updateManuscriptContent: (content) => {
    const { currentManuscript } = get();
    
    if (content !== currentManuscript) {
      set({ currentManuscript: content });
      
      // 히스토리에 추가
      get().addToHistory(content, 'direct_edit');
      
      // 즉시 localStorage에 저장
      setTimeout(() => {
        get().saveManuscriptToProject();
      }, 50);
      
      console.log('manuscriptStore - 직접 편집 내용 업데이트 및 저장:', content.length, '자');
    }
  },
  
  // ===== 이미지 관리 액션 =====
  
  // 이미지 추가
  addImage: (chapterNumber, imageData) => {
    const { manuscriptImages } = get();
    
    const newImage = {
      id: Date.now().toString(),
      chapterNumber,
      data: imageData.data, // Base64 데이터
      caption: imageData.caption || '',
      width: imageData.width || 400,
      height: imageData.height || 'auto',
      timestamp: new Date().toISOString()
    };
    
    set({
      manuscriptImages: [...manuscriptImages, newImage]
    });
    
    // 이미지 추가 후 즉시 프로젝트에 저장
    setTimeout(() => {
      get().saveManuscriptToProject();
    }, 100);
    
    console.log('manuscriptStore - 이미지 추가됨:', newImage.id, '장:', chapterNumber);
    return newImage;
  },
  
  // 이미지 제거
  removeImage: (imageId) => {
    const { manuscriptImages } = get();
    
    set({
      manuscriptImages: manuscriptImages.filter(img => img.id !== imageId)
    });
    
    // 이미지 제거 후 즉시 프로젝트에 저장
    setTimeout(() => {
      get().saveManuscriptToProject();
    }, 100);
    
    console.log('manuscriptStore - 이미지 제거됨:', imageId);
  },
  
  // 이미지 업데이트
  updateImage: (imageId, updates) => {
    const { manuscriptImages } = get();
    
    set({
      manuscriptImages: manuscriptImages.map(img => 
        img.id === imageId ? { ...img, ...updates } : img
      )
    });
    
    // 이미지 업데이트 후 즉시 프로젝트에 저장
    setTimeout(() => {
      get().saveManuscriptToProject();
    }, 100);
    
    console.log('manuscriptStore - 이미지 업데이트됨:', imageId);
  },
  
  // 특정 장의 이미지 가져오기
  getImagesForChapter: (chapterNumber) => {
    const { manuscriptImages } = get();
    return manuscriptImages.filter(img => img.chapterNumber === chapterNumber);
  },
  
  // ===== 유틸리티 액션 =====
  
  // 상태 초기화
  resetManuscriptState: () => {
    set({
      currentManuscript: '',
      isGenerating: false,
      generationError: null,
      isEditing: false,
      editingError: null,
      selectedText: '',
      aiMode: 'modify',
      isAiProcessing: false,
      editHistory: [],
      currentHistoryIndex: -1,
      highlightedEdits: [],
      generatedQuestions: [],
      outline: null,
      isDirectEditMode: false,
      manuscriptImages: [],
      // 문체 관련 상태 초기화
      isStyleMode: false,
      currentStyle: null,
      stylePreview: '',
      previewOriginalText: '',
      isStyleProcessing: false,
      styleError: null,
      previousStyleSample: '',
      originalManuscript: ''
    });
  },
  
  // 원고 직접 설정 (외부에서 로드한 경우)
  setManuscript: (manuscript, addToHistory = true) => {
    set({ currentManuscript: manuscript });
    
    if (addToHistory) {
      get().addToHistory(manuscript, 'manual_set');
    }
  },
  
  // 목차 설정
  setOutline: (outline) => {
    set({ outline });
  },
  
  // 이미지 목록 설정 (프로젝트 로드 시 사용)
  setManuscriptImages: (images) => {
    set({ manuscriptImages: images || [] });
    console.log('manuscriptStore - 이미지 목록 설정됨:', images?.length || 0, '개');
  },
  
  // ===== 문체 변경 액션 =====
  
  // 문체 모드 설정
  setStyleMode: (enabled) => {
    const { currentManuscript, currentProjectId } = get();
    
    if (enabled && currentManuscript) {
      // 문체 모드 진입 시 원본 백업
      set({ 
        isStyleMode: enabled,
        originalManuscript: currentManuscript,
        styleError: null,
        stylePreview: ''
      });
    } else {
      // 문체 모드 종료
      set({ 
        isStyleMode: enabled,
        currentStyle: null,
        stylePreview: '',
        previewOriginalText: '',
        showStylePreviewInManuscript: false,
        styleError: null
      });
    }
    
    // 모드 변경 후 localStorage에 状态 저장
    if (currentProjectId) {
      setTimeout(() => {
        get().saveStyleStateToStorage(currentProjectId);
      }, 100);
    }
    
    console.log('manuscriptStore - 문체 모드:', enabled ? '활성화' : '비활성화');
  },
  
  // 문체 미리보기 생성
  generateStylePreview: async (styleKey, additionalInstructions = '') => {
    const { currentManuscript, selectedText, isStyleProcessing } = get();
    
    if (!currentManuscript || isStyleProcessing) {
      return { success: false, error: '원고가 없거나 처리 중입니다.' };
    }
    
    set({ 
      isStyleProcessing: true, 
      styleError: null,
      currentStyle: styleKey 
    });
    
    try {
      console.log('manuscriptStore - 문체 미리보기 생성:', styleKey);
      
      // 선택된 텍스트가 있으면 그것을 사용, 없으면 전체 원고 사용
      const textToPreview = selectedText && selectedText.trim() 
        ? selectedText 
        : currentManuscript;
      
      const result = await StyleAgent.generatePreview(
        textToPreview,
        styleKey,
        additionalInstructions
      );
      
      if (result.success) {
        set({
          stylePreview: result.preview,
          previewOriginalText: textToPreview, // 미리보기에 사용된 원본 텍스트 저장
          showStylePreviewInManuscript: true,
          isStyleProcessing: false
        });
        
        // 미리보기 생성 후 localStorage에 상태 저장
        const { currentProjectId } = get();
        if (currentProjectId) {
          setTimeout(() => {
            get().saveStyleStateToStorage(currentProjectId);
          }, 100);
        }
        
        console.log('manuscriptStore - 문체 미리보기 생성 완료');
        return { success: true, preview: result.preview };
      } else {
        set({ 
          isStyleProcessing: false, 
          styleError: result.error 
        });
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('manuscriptStore 문체 미리보기 오류:', error);
      set({ 
        isStyleProcessing: false, 
        styleError: error.message 
      });
      return { success: false, error: error.message };
    }
  },
  
  // 문체 미리보기 토글
  toggleStylePreview: () => {
    const { showStylePreviewInManuscript, stylePreview, previewOriginalText } = get();
    
    // stylePreview나 previewOriginalText가 비어있으면 미리보기 모드를 강제로 false로 설정
    if (!stylePreview || !stylePreview.trim() || !previewOriginalText) {
      set({ showStylePreviewInManuscript: false });
      console.log('manuscriptStore - 미리보기 내용이 없어 미리보기 모드 자동 해제');
      return;
    }
    
    set({ showStylePreviewInManuscript: !showStylePreviewInManuscript });
    console.log('manuscriptStore - 문체 미리보기 토글:', !showStylePreviewInManuscript ? '표시' : '숨김');
    
    // 토글 후 localStorage에 상태 저장
    const { currentProjectId } = get();
    if (currentProjectId) {
      setTimeout(() => {
        get().saveStyleStateToStorage(currentProjectId);
      }, 100);
    }
  },
  
  // 전체 원고에 문체 적용
  applyStyleToManuscript: async (styleKey, additionalInstructions = '') => {
    const { currentManuscript, isStyleProcessing, previousStyleSample } = get();
    
    if (!currentManuscript || isStyleProcessing) {
      return { success: false, error: '원고가 없거나 처리 중입니다.' };
    }
    
    set({ 
      isStyleProcessing: true, 
      styleError: null 
    });
    
    try {
      console.log('manuscriptStore - 전체 원고에 문체 적용:', styleKey);
      
      const result = await StyleAgent.applyStyleToFullText(
        currentManuscript,
        styleKey,
        additionalInstructions,
        previousStyleSample
      );
      
      if (result.success) {
        // 변환된 텍스트를 현재 원고로 설정
        set({
          currentManuscript: result.transformedText,
          isStyleProcessing: false,
          currentStyle: styleKey,
          // 첫 500자를 샘플로 저장 (다음 적용 시 일관성 유지)
          previousStyleSample: result.transformedText.substring(0, 500)
        });
        
        // 히스토리에 추가
        get().addToHistory(result.transformedText, 'style_change');
        
        // 프로젝트에 저장
        await get().saveManuscriptToProject();
        
        console.log('manuscriptStore - 문체 적용 완료');
        return { success: true, transformedText: result.transformedText };
      } else {
        set({ 
          isStyleProcessing: false, 
          styleError: result.error 
        });
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('manuscriptStore 문체 적용 오류:', error);
      set({ 
        isStyleProcessing: false, 
        styleError: error.message 
      });
      return { success: false, error: error.message };
    }
  },
  
  // 문체 적용 취소 (원본으로 복원)
  revertStyle: () => {
    const { originalManuscript } = get();
    
    if (originalManuscript) {
      set({
        currentManuscript: originalManuscript,
        currentStyle: null,
        stylePreview: '',
        previewOriginalText: '',
        showStylePreviewInManuscript: false, // 미리보기 모드 해제
        previousStyleSample: ''
      });
      
      // 히스토리에 추가
      get().addToHistory(originalManuscript, 'style_revert');
      
      // 프로젝트에 저장
      get().saveManuscriptToProject();
      
      console.log('manuscriptStore - 원본으로 복원됨, 상태 확인:', {
        showStylePreviewInManuscript: get().showStylePreviewInManuscript,
        stylePreview: get().stylePreview,
        currentStyle: get().currentStyle
      });
      return { success: true };
    } else {
      return { success: false, error: '복원할 원본이 없습니다.' };
    }
  },
  
  // ===== 계산된 상태 (Getters) =====
  
  // Undo 가능 여부
  canUndo: () => {
    const { currentHistoryIndex } = get();
    return currentHistoryIndex > 0;
  },
  
  // Redo 가능 여부
  canRedo: () => {
    const { editHistory, currentHistoryIndex } = get();
    return currentHistoryIndex < editHistory.length - 1;
  },
  
  // 현재 편집 상태 요약
  getEditingSummary: () => {
    const { editHistory, highlightedEdits, currentManuscript } = get();
    
    return {
      totalEdits: editHistory.length - 1, // 초기 생성 제외
      highlightCount: highlightedEdits.length,
      manuscriptLength: currentManuscript.length,
      lastEditTime: editHistory.length > 1 ? editHistory[editHistory.length - 1].timestamp : null
    };
  },
  
  // ===== localStorage 관련 함수 =====
  
  // 문체 상태를 localStorage에 저장
  saveStyleStateToStorage: (projectId) => {
    if (!projectId) return;
    
    const { 
      isStyleMode, 
      currentStyle, 
      stylePreview, 
      previewOriginalText,
      showStylePreviewInManuscript, 
      originalManuscript,
      previousStyleSample,
      STORAGE_KEY 
    } = get();
    
    const styleState = {
      projectId,
      isStyleMode,
      currentStyle,
      stylePreview,
      previewOriginalText,
      showStylePreviewInManuscript,
      originalManuscript,
      previousStyleSample,
      timestamp: Date.now()
    };
    
    try {
      localStorage.setItem(`${STORAGE_KEY}_${projectId}`, JSON.stringify(styleState));
      console.log('manuscriptStore - 문체 상태 저장 완료:', projectId, {
        isStyleMode,
        hasStylePreview: !!stylePreview,
        previewLength: stylePreview?.length || 0,
        currentStyle
      });
    } catch (error) {
      console.error('manuscriptStore - 문체 상태 저장 실패:', error);
    }
  },
  
  // localStorage에서 문체 상태 복원
  loadStyleStateFromStorage: (projectId) => {
    if (!projectId) return false;
    
    const { STORAGE_KEY } = get();
    
    try {
      const savedState = localStorage.getItem(`${STORAGE_KEY}_${projectId}`);
      if (!savedState) return false;
      
      const styleState = JSON.parse(savedState);
      
      // 1시간 이상 지난 상태는 무시
      const oneHour = 60 * 60 * 1000;
      if (Date.now() - styleState.timestamp > oneHour) {
        localStorage.removeItem(`${STORAGE_KEY}_${projectId}`);
        return false;
      }
      
      set({
        isStyleMode: styleState.isStyleMode || false,
        currentStyle: styleState.currentStyle || null,
        stylePreview: styleState.stylePreview || '',
        previewOriginalText: styleState.previewOriginalText || '',
        showStylePreviewInManuscript: styleState.showStylePreviewInManuscript !== false, // 기본값 true
        originalManuscript: styleState.originalManuscript || '',
        previousStyleSample: styleState.previousStyleSample || ''
      });
      
      console.log('manuscriptStore - 문체 상태 복원 완료:', projectId);
      return true;
    } catch (error) {
      console.error('manuscriptStore - 문체 상태 복원 실패:', error);
      return false;
    }
  },
  
  // 문체 상태 정리 (프로젝트 종료 시)
  clearStyleStateFromStorage: (projectId) => {
    if (!projectId) return;
    
    const { STORAGE_KEY } = get();
    
    try {
      localStorage.removeItem(`${STORAGE_KEY}_${projectId}`);
      console.log('manuscriptStore - 문체 상태 정리 완료:', projectId);
    } catch (error) {
      console.error('manuscriptStore - 문체 상태 정리 실패:', error);
    }
  }
}));

export default useManuscriptStore;