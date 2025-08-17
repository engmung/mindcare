import { useState, useEffect, useRef } from 'react';
import useManuscriptStore from '../stores/manuscriptStore.js';
import styles from './ManuscriptViewer.module.css';

/**
 * ManuscriptViewer
 * 
 * 용도: 원고 내용 표시 및 텍스트 선택 기능 제공
 * 사용처: ManuscriptEditPage 좌측 패널
 * 기능: 드래그 선택, 하이라이트 표시, 인라인 편집
 */

function ManuscriptViewer() {
  const {
    currentManuscript,
    selectedText,
    setSelectedText,
    highlightedEdits,
    isAiProcessing,
    isDirectEditMode,
    toggleDirectEditMode,
    updateManuscriptContent,
    manuscriptImages,
    addImage,
    removeImage,
    updateImage,
    getImagesForChapter,
    // 문체 미리보기 관련
    isStyleMode,
    stylePreview,
    previewOriginalText,
    showStylePreviewInManuscript,
    toggleStylePreview
  } = useManuscriptStore();
  
  const viewerRef = useRef(null);
  const editableRef = useRef(null);
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  
  // 직접 편집 관련 상태
  const [hoveredChapter, setHoveredChapter] = useState(null);
  const [showImageUpload, setShowImageUpload] = useState(null);
  
  
  // 이미지 캡션 임시 상태 관리
  const [tempCaptions, setTempCaptions] = useState({});
  
  
  // 이미지 리사이즈 상태
  const [resizingImage, setResizingImage] = useState(null);
  const [initialMousePos, setInitialMousePos] = useState({ x: 0, y: 0 });
  const [initialImageSize, setInitialImageSize] = useState({ width: 0, height: 0 });
  
  // 실행취소/다시실행을 위한 히스토리 관리
  const [undoHistory, setUndoHistory] = useState([]);
  const [redoHistory, setRedoHistory] = useState([]);
  const [isUndoRedoOperation, setIsUndoRedoOperation] = useState(false);
  
  // 텍스트 선택 처리
  useEffect(() => {
    const handleMouseUp = (e) => {
      if (!viewerRef.current) return;
      
      // 원고 영역 내부 클릭이 아니면 선택 유지
      const isInsideViewer = viewerRef.current.contains(e.target);
      
      if (!isInsideViewer) {
        setIsSelecting(false); // 선택 상태만 false로 (selectedText는 유지)
        console.log('원고 외부 클릭 감지 - 선택 유지');
        return;
      }
      
      const selection = window.getSelection();
      const currentSelectedText = selection.toString().trim();
      
      // 미리보기 표시 중에는 새로운 텍스트 선택 차단 (실제 미리보기 내용이 있을 때만)
      if (isStyleMode && showStylePreviewInManuscript && stylePreview && stylePreview.trim() && previewOriginalText) {
        setIsSelecting(false);
        console.log('ManuscriptViewer - 미리보기 모드에서 텍스트 선택 차단', {
          isStyleMode,
          showStylePreviewInManuscript,
          hasStylePreview: !!stylePreview,
          stylePreviewLength: stylePreview?.length || 0
        });
        return;
      }

      if (currentSelectedText && currentSelectedText.length > 0 && !isDirectEditMode) {
        // 직접편집 모드가 아닐 때만 선택 허용
        setSelectedText(currentSelectedText);
        setIsSelecting(false);
        
        console.log('ManuscriptViewer - 텍스트 선택됨:', {
          length: currentSelectedText.length,
          preview: currentSelectedText.substring(0, 100) + (currentSelectedText.length > 100 ? '...' : '')
        });
      } else {
        // 선택이 해제된 경우 (단, AI 패널 클릭이 아닐 때만)
        setSelectedText('');
        setIsSelecting(false);
      }
    };
    
    const handleMouseDown = (e) => {
      // AI 처리 중에는 선택 비활성화
      if (isAiProcessing) {
        e.preventDefault();
        return;
      }
      
      // 미리보기 표시 중에는 드래그 선택 비활성화 (실제 미리보기 내용이 있을 때만)
      if (isStyleMode && showStylePreviewInManuscript && stylePreview && stylePreview.trim() && previewOriginalText) {
        e.preventDefault();
        console.log('ManuscriptViewer - 미리보기 모드에서 드래그 선택 차단', {
          isStyleMode,
          showStylePreviewInManuscript,
          hasStylePreview: !!stylePreview,
          stylePreviewLength: stylePreview?.length || 0
        });
        return;
      }
      
      // 읽기 모드에서만 여러 문단 선택 허용
      if (!isDirectEditMode) {
        setIsSelecting(true);
      }
    };
    
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [currentManuscript, selectedText, setSelectedText, isAiProcessing, isDirectEditMode]);
  
  // 커서 위치 저장 및 복원 (개선된 버전)
  const saveCursorPosition = () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = range.startContainer;
      const offset = range.startOffset;
      
      // 텍스트 노드의 부모 요소와 오프셋 저장
      let element = container.nodeType === Node.TEXT_NODE ? container.parentNode : container;
      
      // contentEditable 요소 찾기
      while (element && !element.contentEditable) {
        element = element.parentNode;
      }
      
      if (element) {
        return {
          element: element,
          offset: offset,
          textContent: container.textContent,
          containerType: container.nodeType
        };
      }
    }
    return null;
  };

  const restoreCursorPosition = (cursorInfo) => {
    if (!cursorInfo || !cursorInfo.element) return;
    
    try {
      const element = cursorInfo.element;
      const selection = window.getSelection();
      const range = document.createRange();
      
      // 텍스트 노드 찾기
      let textNode = null;
      if (element.firstChild && element.firstChild.nodeType === Node.TEXT_NODE) {
        textNode = element.firstChild;
      } else {
        // 텍스트 노드가 없으면 생성
        element.focus();
        return;
      }
      
      // 오프셋 조정 (텍스트 길이를 초과하지 않도록)
      const maxOffset = textNode.textContent.length;
      const safeOffset = Math.min(cursorInfo.offset, maxOffset);
      
      range.setStart(textNode, safeOffset);
      range.setEnd(textNode, safeOffset);
      
      selection.removeAllRanges();
      selection.addRange(range);
      
      console.log('커서 위치 복원됨:', safeOffset);
    } catch (error) {
      console.warn('커서 위치 복원 실패:', error);
      // 복원 실패 시 해당 요소에 포커스
      if (cursorInfo.element) {
        cursorInfo.element.focus();
      }
    }
  };

  // 히스토리에 상태 저장
  const saveToHistory = (content) => {
    if (isUndoRedoOperation) return; // 실행취소/다시실행 중에는 히스토리 저장 안함
    
    setUndoHistory(prev => {
      const newHistory = [...prev, content];
      // 히스토리 크기 제한 (최대 50개)
      if (newHistory.length > 50) {
        newHistory.shift();
      }
      return newHistory;
    });
    
    // 새로운 변경사항이 생기면 redo 히스토리 초기화
    setRedoHistory([]);
  };

  // 실행취소 실행
  const performUndo = () => {
    if (undoHistory.length === 0) {
      console.log('실행취소할 내용이 없습니다.');
      return false;
    }

    setIsUndoRedoOperation(true);
    
    const currentContent = reconstructManuscriptFromDOM();
    const previousContent = undoHistory[undoHistory.length - 1];
    
    // 현재 상태를 redo 히스토리에 저장
    setRedoHistory(prev => [...prev, currentContent]);
    
    // undo 히스토리에서 이전 상태 제거
    setUndoHistory(prev => prev.slice(0, -1));
    
    // 이전 상태로 복원
    updateManuscriptContent(previousContent);
    
    // DOM에도 반영 (약간의 딜레이 후)
    setTimeout(() => {
      setIsUndoRedoOperation(false);
      console.log('실행취소 완료');
    }, 100);
    
    return true;
  };

  // 다시실행 실행
  const performRedo = () => {
    if (redoHistory.length === 0) {
      console.log('다시실행할 내용이 없습니다.');
      return false;
    }

    setIsUndoRedoOperation(true);
    
    const currentContent = reconstructManuscriptFromDOM();
    const nextContent = redoHistory[redoHistory.length - 1];
    
    // 현재 상태를 undo 히스토리에 저장
    setUndoHistory(prev => [...prev, currentContent]);
    
    // redo 히스토리에서 다음 상태 제거
    setRedoHistory(prev => prev.slice(0, -1));
    
    // 다음 상태로 복원
    updateManuscriptContent(nextContent);
    
    // DOM에도 반영 (약간의 딜레이 후)
    setTimeout(() => {
      setIsUndoRedoOperation(false);
      console.log('다시실행 완료');
    }, 100);
    
    return true;
  };

  // 포커스를 잃었을 때 저장 (커서 이동 시에만 저장)
  const handleEditBlur = (e) => {
    if (viewerRef.current) {
      const reconstructedContent = reconstructManuscriptFromDOM();
      
      // 히스토리에 현재 상태 저장 (변경사항이 있을 때만)
      if (reconstructedContent !== currentManuscript) {
        saveToHistory(currentManuscript); // 변경 전 상태를 히스토리에 저장
      }
      
      updateManuscriptContent(reconstructedContent);
      
      // 즉시 프로젝트에 저장 (확실한 저장)
      const store = useManuscriptStore.getState();
      store.saveManuscriptToProject().then(() => {
        console.log('직접 편집 저장 완료 (포커스 이동)');
      }).catch(error => {
        console.error('저장 실패:', error);
      });
    }
  };
  
  // DOM에서 원고 내용 재구성 (장별 구조에 맞게 수정)
  const reconstructManuscriptFromDOM = () => {
    if (!viewerRef.current) return currentManuscript;
    
    const sections = [];
    const chapterSections = viewerRef.current.querySelectorAll(`.${styles.chapterSection}`);
    
    chapterSections.forEach((chapterSection) => {
      // 장 제목 추출
      const chapterTitle = chapterSection.querySelector(`.${styles.chapterTitle}`);
      if (chapterTitle) {
        const titleText = chapterTitle.textContent.trim();
        if (titleText) {
          sections.push(titleText);
        }
      }
      
      // 장 내용 추출
      const chapterContent = chapterSection.querySelector(`.${styles.chapterContent}`);
      if (chapterContent) {
        const contentText = chapterContent.textContent.trim();
        if (contentText) {
          sections.push(contentText);
        }
      }
      
      // 장 사이에 빈 줄 추가 (마지막 장 제외)
      sections.push('');
    });
    
    // 마지막 빈 줄 제거
    if (sections.length > 0 && sections[sections.length - 1] === '') {
      sections.pop();
    }
    
    return sections.join('\n\n');
  };
  
  // 이미지 업로드 핸들러
  const handleImageUpload = (chapterNumber, file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = {
        data: e.target.result, // Base64 데이터
        caption: '',
        width: 400, // 기본 크기
        height: 'auto'
      };
      
      addImage(chapterNumber, imageData);
      setShowImageUpload(null);
    };
    reader.readAsDataURL(file);
  };
  
  // 이미지 캡션 업데이트 핸들러 (즉시 UI 업데이트)
  const handleCaptionChange = (imageId, newCaption) => {
    // 즉시 임시 상태 업데이트 (UI 반응성)
    setTempCaptions(prev => ({
      ...prev,
      [imageId]: newCaption
    }));
    
    // 백그라운드에서 실제 저장
    updateImage(imageId, { caption: newCaption });
    
    // 추가 저장 확인
    setTimeout(() => {
      const store = useManuscriptStore.getState();
      store.saveManuscriptToProject();
    }, 200);
  };
  
  // 이미지 리사이즈 시작
  const handleResizeStart = (e, imageId, currentWidth) => {
    e.preventDefault();
    e.stopPropagation();
    
    const imageElement = document.querySelector(`[data-image-id="${imageId}"]`);
    if (imageElement) {
      imageElement.setAttribute('data-resizing', 'true');
    }
    
    setResizingImage(imageId);
    setInitialMousePos({ x: e.clientX, y: e.clientY });
    setInitialImageSize({ width: currentWidth || 400, height: 0 });
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };
  
  // 이미지 리사이즈 중
  const handleResizeMove = (e) => {
    if (!resizingImage) return;
    
    const deltaX = e.clientX - initialMousePos.x;
    const newWidth = Math.max(100, Math.min(800, initialImageSize.width + deltaX));
    
    // 실시간으로 크기 업데이트 (디바운싱 없이)
    const imageElement = document.querySelector(`[data-image-id="${resizingImage}"]`);
    if (imageElement) {
      imageElement.style.width = `${newWidth}px`;
    }
  };
  
  // 이미지 리사이즈 종료
  const handleResizeEnd = (e) => {
    if (!resizingImage) return;
    
    const deltaX = e.clientX - initialMousePos.x;
    const newWidth = Math.max(100, Math.min(800, initialImageSize.width + deltaX));
    
    // 리사이즈 상태 제거
    const imageElement = document.querySelector(`[data-image-id="${resizingImage}"]`);
    if (imageElement) {
      imageElement.removeAttribute('data-resizing');
    }
    
    // 최종 크기를 store에 저장
    updateImage(resizingImage, { width: newWidth });
    
    setResizingImage(null);
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };
  
  // 키보드 이벤트 처리
  useEffect(() => {
    const handleKeyDown = (e) => {
      // ESC: 선택 해제
      if (e.key === 'Escape') {
        if (selectedText) {
          window.getSelection().removeAllRanges();
          setSelectedText('');
        }
        // 이미지 업로드 창 닫기
        if (showImageUpload) {
          setShowImageUpload(null);
        }
      }
      
      // Ctrl+E: 편집 모드 토글
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        toggleDirectEditMode();
      }
      
      // Ctrl+Z: 실행취소 (직접편집 모드에서만)
      if (e.ctrlKey && e.key === 'z' && isDirectEditMode) {
        e.preventDefault();
        console.log('실행취소 실행 (수동 히스토리 관리)');
        const success = performUndo();
        if (!success) {
          console.log('실행취소할 내용이 없습니다');
        }
      }
      
      // Ctrl+Y 또는 Ctrl+Shift+Z: 다시실행 (직접편집 모드에서만)
      if (((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) && isDirectEditMode) {
        e.preventDefault();
        console.log('다시실행 실행 (수동 히스토리 관리)');
        const success = performRedo();
        if (!success) {
          console.log('다시실행할 내용이 없습니다');
        }
      }
      
      // Ctrl+S: 수동 저장
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (isDirectEditMode) {
          const reconstructedContent = reconstructManuscriptFromDOM();
          
          // 히스토리에 현재 상태 저장 (변경사항이 있을 때만)
          if (reconstructedContent !== currentManuscript) {
            saveToHistory(currentManuscript); // 변경 전 상태를 히스토리에 저장
          }
          
          updateManuscriptContent(reconstructedContent);
          
          const store = useManuscriptStore.getState();
          store.saveManuscriptToProject().then(() => {
            console.log('수동 저장 완료');
            // 사용자에게 저장 완료 피드백 (간단한 방법)
            const originalTitle = document.title;
            document.title = '저장됨 - ' + originalTitle;
            setTimeout(() => {
              document.title = originalTitle;
            }, 1500);
          }).catch(error => {
            console.error('저장 실패:', error);
          });
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedText, setSelectedText, showImageUpload, toggleDirectEditMode, isDirectEditMode, reconstructManuscriptFromDOM, updateManuscriptContent]);

  // 초기 히스토리 저장 (원고가 로드되었을 때)
  useEffect(() => {
    if (currentManuscript && undoHistory.length === 0) {
      console.log('초기 히스토리 상태 저장');
      setUndoHistory([currentManuscript]);
    }
  }, [currentManuscript, undoHistory.length]);
  
  // stylePreview가 비어있을 때 showStylePreviewInManuscript 자동 해제
  useEffect(() => {
    if (isStyleMode && showStylePreviewInManuscript && (!stylePreview || !stylePreview.trim() || !previewOriginalText)) {
      console.log('ManuscriptViewer - stylePreview가 비어있어 미리보기 모드 자동 해제');
      toggleStylePreview();
    }
  }, [isStyleMode, showStylePreviewInManuscript, stylePreview, previewOriginalText, toggleStylePreview]);
  
  // 원고를 장 단위로 분할
  const parseManuscriptToChapters = () => {
    if (!currentManuscript) return [];
    
    const lines = currentManuscript.split('\n');
    const chapters = [];
    let currentChapter = null;
    let currentContent = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // 장 제목 패턴 확인 (개선된 버전 - 제목만 정확히 추출)
      const chapterMatch = trimmedLine.match(/^제(\d+)장[:\.]?\s*(.*)$/);
      if (chapterMatch && trimmedLine.length < 200) { // 제목이 너무 길면 무시 (내용이 섞인 경우)
        // 이전 장 내용 저장
        if (currentChapter && currentContent.length > 0) {
          chapters.push({
            type: 'chapter',
            title: currentChapter.title,
            number: currentChapter.number,
            titleText: currentChapter.titleText,
            content: currentContent.join('\n').trim()
          });
        }
        
        // 새 장 시작
        currentChapter = {
          number: parseInt(chapterMatch[1]),
          title: chapterMatch[2].trim(),
          titleText: trimmedLine
        };
        currentContent = [];
        continue;
      }
      
      // 장이 시작된 후의 내용들
      if (currentChapter) {
        // 빈 줄은 첫 번째가 아닐 때만 추가 (장 제목 직후 빈 줄 제거)
        if (line.trim() === '' && currentContent.length === 0) {
          continue; // 장 제목 직후 빈 줄 건너뛰기
        }
        currentContent.push(line);
      }
    }
    
    // 마지막 장 처리
    if (currentChapter) {
      chapters.push({
        type: 'chapter',
        title: currentChapter.title,
        number: currentChapter.number,
        titleText: currentChapter.titleText,
        content: currentContent.join('\n').trim()
      });
    }
    
    return chapters;
  };
  
  // 하이라이트된 텍스트 렌더링 (개선된 버전)
  const renderHighlightedContent = (content) => {
    let result = content;
    
    // 문체 모드에서 미리보기로 교체 (실제 미리보기 내용이 있을 때만)
    if (isStyleMode && stylePreview && stylePreview.trim() && showStylePreviewInManuscript && previewOriginalText) {
      // 저장된 원본 텍스트를 미리보기로 교체
      const escapedOriginalText = previewOriginalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedOriginalText, 'g');
      
      result = result.replace(regex, 
        `<span class="${styles.stylePreviewOverlay}" style="background-color: rgba(255, 193, 7, 0.2); border: 2px solid #ffc107; border-radius: 4px; padding: 2px 6px; font-weight: 500;" title="문체 미리보기: ${previewOriginalText.length}자">${stylePreview}</span>`
      );
      
      return result;
    }
    // 일반 모드에서 선택된 텍스트 하이라이트 
    else if (selectedText && selectedText.length > 0) {
      // 선택된 텍스트를 줄바꿈으로 분할
      const selectedLines = selectedText.split('\n');
      
      selectedLines.forEach((line) => {
        const trimmedLine = line.trim();
        if (trimmedLine && content.includes(trimmedLine)) {
          // 각 라인이 현재 문단에 포함되어 있으면 하이라이트
          const regex = new RegExp(`(${trimmedLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
          result = result.replace(regex, `<mark class="${styles.highlightNew}" style="background-color: rgba(0, 123, 255, 0.3);">$1</mark>`);
        }
      });
      
      return result;
    }
    
    // 기존 편집 하이라이트 표시
    if (highlightedEdits && highlightedEdits.length > 0) {
      highlightedEdits.forEach((highlight) => {
        const highlightClass = `highlight-${highlight.type}`;
        const highlightedText = `<mark class="${styles[highlightClass]}" data-highlight-id="${highlight.id}">${highlight.text}</mark>`;
        result = result.replace(highlight.text, highlightedText);
      });
    }
    
    return result;
  };
  
  const chapters = parseManuscriptToChapters();
  
  if (!currentManuscript || currentManuscript.trim().length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <p>원고가 생성되지 않았습니다.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>원고 내용</h2>
        <div className={styles.headerActions}>
          <div className={styles.stats}>
            <span>전체 {currentManuscript.length.toLocaleString()}자</span>
            {selectedText && (
              <span className={styles.selectionStat}>
                선택: {selectedText.length}자
              </span>
            )}
          </div>
          
          <button
            onClick={toggleDirectEditMode}
            className={`${styles.editModeButton} ${isDirectEditMode ? styles.active : ''}`}
            title={`${isDirectEditMode ? '읽기 및 AI편집' : '직접편집'} 모드로 전환 (Ctrl+E)\n\n직접편집 모드 단축키:\n- Ctrl+Z: 실행취소 (${undoHistory.length}개 가능)\n- Ctrl+Y: 다시실행 (${redoHistory.length}개 가능)\n- Ctrl+S: 수동 저장`}
          >
            {isDirectEditMode ? '✏️ 직접편집' : '📖 읽기 및 AI편집'}
          </button>
        </div>
      </div>
      
      {isDirectEditMode ? (
        // 직접 편집 모드 - 장별 구조화된 렌더링
        <div 
          ref={viewerRef}
          className={`${styles.content} ${styles.editableContent}`}
        >
          {chapters.map((chapter, index) => {
            const chapterNumber = chapter.number;
            const chapterImages = getImagesForChapter(chapterNumber);
            
            return (
              <div key={index} className={styles.chapterSection}>
                {/* 장 제목 */}
                <div 
                  className={`${styles.chapterTitle} ${hoveredChapter === chapterNumber ? styles.hovered : ''}`}
                  id={`chapter-${chapterNumber}`}
                  contentEditable="true"
                  onBlur={handleEditBlur}
                  onMouseEnter={() => setHoveredChapter(chapterNumber)}
                  onMouseLeave={() => setHoveredChapter(null)}
                  suppressContentEditableWarning={true}
                >
                  {chapter.titleText}
                  
                  {/* 이미지 추가 버튼 (호버 시 표시) */}
                  {hoveredChapter === chapterNumber && (
                    <div className={styles.imageAddOverlay}>
                      <label className={styles.imageAddButton}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              handleImageUpload(chapterNumber, file);
                            }
                          }}
                          style={{ display: 'none' }}
                        />
                        + 이미지 추가
                      </label>
                    </div>
                  )}
                </div>
                
                {/* 장에 속한 이미지들 렌더링 */}
                {chapterImages.map((image) => (
                  <div key={image.id} className={styles.chapterImage}>
                    <div className={styles.imageControls}>
                      <span className={styles.imageSizeInfo}>
                        {image.width || 400}px
                      </span>
                      <button
                        onClick={() => removeImage(image.id)}
                        className={styles.imageDeleteButton}
                        title="이미지 삭제"
                      >
                        🗑️
                      </button>
                    </div>
                    
                    <div className={styles.resizableImageContainer}>
                      <img 
                        src={image.data} 
                        alt={image.caption || `${chapterNumber}장 이미지`}
                        style={{ 
                          width: `${image.width || 400}px`,
                          height: 'auto',  
                          maxWidth: '100%'
                        }}
                        data-image-id={image.id}
                        className={styles.resizableImage}
                      />
                      <div 
                        className={styles.resizeHandle}
                        onMouseDown={(e) => handleResizeStart(e, image.id, image.width || 400)}
                        title="드래그하여 크기 조절"
                      />
                    </div>
                    
                    <input
                      type="text"
                      value={tempCaptions[image.id] !== undefined ? tempCaptions[image.id] : (image.caption || '')}
                      onChange={(e) => handleCaptionChange(image.id, e.target.value)}
                      placeholder="이미지 설명을 입력하세요..."
                      className={styles.imageCaptionInput}
                    />
                  </div>
                ))}
                
                {/* 장 내용 - 하나의 큰 편집 영역 */}
                <div 
                  className={styles.chapterContent}
                  contentEditable="true"
                  onBlur={handleEditBlur}
                  suppressContentEditableWarning={true}
                  data-chapter-number={chapterNumber}
                >
                  {chapter.content}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // 읽기 모드 - 장별 구조화된 렌더링
        <div 
          ref={viewerRef}
          className={`${styles.content} ${isSelecting ? styles.selecting : ''} ${isAiProcessing ? styles.disabled : ''}`}
        >
          {chapters.map((chapter, index) => {
            const chapterNumber = chapter.number;
            const chapterImages = getImagesForChapter(chapterNumber);
            
            return (
              <div key={index} className={styles.chapterSection}>
                {/* 장 제목 */}
                <div 
                  className={`${styles.chapterTitle} ${hoveredChapter === chapterNumber ? styles.hovered : ''}`}
                  id={`chapter-${chapterNumber}`}
                  onMouseEnter={() => setHoveredChapter(chapterNumber)}
                  onMouseLeave={() => setHoveredChapter(null)}
                >
                  {chapter.titleText}
                  
                  {/* 이미지 추가 버튼 (호버 시 표시) */}
                  {hoveredChapter === chapterNumber && (
                    <div className={styles.imageAddOverlay}>
                      <label className={styles.imageAddButton}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              handleImageUpload(chapterNumber, file);
                            }
                          }}
                          style={{ display: 'none' }}
                        />
                        + 이미지 추가
                      </label>
                    </div>
                  )}
                </div>
                
                {/* 장에 속한 이미지들 렌더링 */}
                {chapterImages.map((image) => (
                  <div key={image.id} className={styles.chapterImage}>
                    <div className={styles.imageControls}>
                      <span className={styles.imageSizeInfo}>
                        {image.width || 400}px
                      </span>
                      <button
                        onClick={() => removeImage(image.id)}
                        className={styles.imageDeleteButton}
                        title="이미지 삭제"
                      >
                        🗑️
                      </button>
                    </div>
                    
                    <div className={styles.resizableImageContainer}>
                      <img 
                        src={image.data} 
                        alt={image.caption || `${chapterNumber}장 이미지`}
                        style={{ 
                          width: `${image.width || 400}px`,
                          height: 'auto',
                          maxWidth: '100%'
                        }}
                        data-image-id={image.id}
                        className={styles.resizableImage}
                      />  
                      <div 
                        className={styles.resizeHandle}
                        onMouseDown={(e) => handleResizeStart(e, image.id, image.width || 400)}
                        title="드래그하여 크기 조절"
                      />
                    </div>
                    
                    <input
                      type="text"
                      value={tempCaptions[image.id] !== undefined ? tempCaptions[image.id] : (image.caption || '')}
                      onChange={(e) => handleCaptionChange(image.id, e.target.value)}
                      placeholder="이미지 설명을 입력하세요..."
                      className={styles.imageCaptionInput}
                    />
                  </div>
                ))}
                
                {/* 장 내용 - 읽기 모드에서는 하이라이트 적용 */}
                <div 
                  className={styles.chapterContent}
                  data-chapter-number={chapterNumber}
                  dangerouslySetInnerHTML={{
                    __html: renderHighlightedContent(chapter.content)
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
      
      {/* 선택 상태 표시 */}
      {selectedText && (
        <div className={styles.selectionInfo}>
          <div className={styles.selectionPreview}>
            <strong>선택된 텍스트:</strong>
            <p>{selectedText.length > 100 ? selectedText.substring(0, 100) + '...' : selectedText}</p>
          </div>
          <button 
            className={styles.clearSelection}
            onClick={() => {
              window.getSelection().removeAllRanges();
              setSelectedText('');
            }}
          >
            선택 해제
          </button>
        </div>
      )}
      
      {/* AI 처리 중 오버레이 */}
      {isAiProcessing && (
        <div className={styles.processingOverlay}>
          <div className={styles.processingMessage}>
            <div className={styles.spinner}></div>
            <p>AI가 처리 중입니다...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManuscriptViewer;