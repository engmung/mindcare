import { useState, useEffect } from 'react';
import useManuscriptStore from '../stores/manuscriptStore.js';
import StyleAgent from '../agents/StyleAgent.js';
import styles from './AIInteractionPanel.module.css';

/**
 * AIInteractionPanel
 * 
 * 용도: AI 상호작용 인터페이스 제공
 * 사용처: ManuscriptEditPage 우측 패널
 * 기능: 텍스트 수정/질문 생성 모드 토글, 사용자 요청 입력, 결과 표시
 */

function AIInteractionPanel() {
  const {
    selectedText,
    aiMode,
    setAiMode,
    isAiProcessing,
    editingError,
    generatedQuestions,
    applyPartialEdit,
    generateExpansionQuestions,
    // 문체 관련 상태
    isStyleMode,
    currentStyle,
    stylePreview,
    isStyleProcessing,
    styleError,
    generateStylePreview,
    applyStyleToManuscript,
    revertStyle,
    showStylePreviewInManuscript,
    toggleStylePreview,
    saveStyleStateToStorage,
    currentProjectId
  } = useManuscriptStore();
  
  // 로컬 상태
  const [userInput, setUserInput] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  
  // 문체 모드 로컬 상태
  const [additionalStyleInstructions, setAdditionalStyleInstructions] = useState('');
  const [selectedStyleKey, setSelectedStyleKey] = useState(null);
  
  // 사용 가능한 문체 목록
  const availableStyles = StyleAgent.getAvailableStyles();
  
  // 입력 초기화 (선택된 텍스트 변경 시)
  useEffect(() => {
    setUserInput('');
    setLastResult(null);
  }, [selectedText]);
  
  // 문체 모드 활성화 시 기본 문체 선택
  useEffect(() => {
    if (isStyleMode && !selectedStyleKey) {
      // 문체 모드가 활성화되었지만 선택된 문체가 없으면 기본 문체(formal) 선택
      setSelectedStyleKey('formal');
    }
  }, [isStyleMode, selectedStyleKey]);

  // 문체 모드에서 텍스트 선택 시 기본 문체만 설정 (자동 생성 제거)
  useEffect(() => {
    if (isStyleMode && selectedText && selectedText.trim().length > 0 && !selectedStyleKey) {
      // 문체 모드이고 텍스트가 선택되었지만 선택된 문체가 없으면 기본 문체만 설정
      setSelectedStyleKey('formal');
    }
  }, [selectedText, isStyleMode, selectedStyleKey]);
  
  // 현재 문체가 변경되면 selectedStyleKey 동기화
  useEffect(() => {
    if (currentStyle && currentStyle !== selectedStyleKey) {
      setSelectedStyleKey(currentStyle);
    }
  }, [currentStyle, selectedStyleKey]);
  
  // AI 요청 처리
  const handleSubmit = async () => {
    if (!selectedText || !selectedText.trim()) {
      alert('먼저 수정할 텍스트를 선택해주세요.');
      return;
    }
    
    if (aiMode === 'modify' && (!userInput || !userInput.trim())) {
      alert('수정 요청 내용을 입력해주세요.');
      return;
    }
    
    try {
      let result;
      
      if (aiMode === 'modify') {
        console.log('AIInteractionPanel - 텍스트 수정 요청');
        result = await applyPartialEdit(userInput.trim());
      } else {
        console.log('AIInteractionPanel - 질문 생성 요청');
        result = await generateExpansionQuestions();
      }
      
      if (result.success) {
        setLastResult(result);
        if (aiMode === 'modify') {
          setUserInput(''); // 수정 완료 후 입력 초기화
        }
      } else {
        console.error('AI 요청 실패:', result.error);
      }
      
    } catch (error) {
      console.error('AI 요청 처리 오류:', error);
    }
  };
  
  // 엔터 키 처리
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  // 미리 정의된 수정 요청 템플릿
  const modificationTemplates = [
    '더 자세히 설명해주세요',
    '감정을 더 풍부하게 표현해주세요',
    '더 문학적으로 다시 써주세요',
    '간단하고 명확하게 정리해주세요',
    '대화 부분을 더 생생하게 만들어주세요'
  ];
  
  // 템플릿 선택
  const selectTemplate = (template) => {
    setUserInput(template);
  };
  
  // 문체 선택 (미리보기 생성 없이)
  const handleStyleSelect = (styleKey) => {
    setSelectedStyleKey(styleKey);
  };
  
  // 미리보기 생성
  const handleGeneratePreview = async () => {
    if (!selectedText || !selectedText.trim()) {
      alert('먼저 원고에서 텍스트를 선택해주세요.');
      return;
    }
    
    if (!selectedStyleKey) {
      alert('먼저 문체를 선택해주세요.');
      return;
    }
    
    const result = await generateStylePreview(selectedStyleKey, additionalStyleInstructions);
    
    if (result.success) {
      // 미리보기 생성 성공 시 상태 저장
      if (currentProjectId) {
        saveStyleStateToStorage(currentProjectId);
      }
    } else {
      alert(`미리보기 생성 실패: ${result.error}`);
    }
  };
  
  // 문체 전체 적용
  const handleApplyStyle = async () => {
    if (!selectedStyleKey) {
      alert('먼저 문체를 선택해주세요.');
      return;
    }
    
    if (confirm('선택한 문체를 전체 원고에 적용하시겠습니까?\n이 작업은 시간이 걸릴 수 있습니다.')) {
      const result = await applyStyleToManuscript(selectedStyleKey, additionalStyleInstructions);
      
      if (result.success) {
        alert('문체가 성공적으로 적용되었습니다.');
      } else {
        alert(`문체 적용 실패: ${result.error}`);
      }
    }
  };
  
  // 원본으로 되돌리기
  const handleRevertStyle = () => {
    if (confirm('원본 문체로 되돌리시겠습니까?')) {
      const result = revertStyle();
      
      if (result.success) {
        // 로컬 상태 초기화
        setSelectedStyleKey(null);
        setAdditionalStyleInstructions('');
        
        // 확실하게 미리보기 모드 해제 - toggleStylePreview를 호출하면 자동으로 빈 stylePreview 체크됨
        console.log('AIInteractionPanel - 미리보기 모드 해제 호출');
        toggleStylePreview();
        
        alert('원본으로 복원되었습니다. 이제 새로운 텍스트를 선택할 수 있습니다.');
      } else {
        alert(`복원 실패: ${result.error}`);
      }
    }
  };
  
  return (
    <div className={styles.container}>
      {/* 패널 헤더 */}
      <div className={styles.header}>
        <h3>{isStyleMode ? '문체 변경' : 'AI 편집 도구'}</h3>
        
        {/* 모드 토글 (문체 모드가 아닐 때만) */}
        {!isStyleMode && (
          <div className={styles.modeToggle}>
            <button
              className={`${styles.modeButton} ${aiMode === 'modify' ? styles.active : ''}`}
              onClick={() => setAiMode('modify')}
              disabled={isAiProcessing}
            >
              내용 수정
            </button>
            <button
              className={`${styles.modeButton} ${aiMode === 'question' ? styles.active : ''}`}
              onClick={() => setAiMode('question')}
              disabled={isAiProcessing}
            >
              질문 생성
            </button>
          </div>
        )}
      </div>
      
      {/* 선택된 텍스트 표시 (문체 모드가 아닐 때만) */}
      {!isStyleMode && (
        <div className={styles.selectedTextSection}>
          {selectedText ? (
            <div className={styles.selectedTextDisplay}>
              <strong>선택된 텍스트:</strong>
              <div className={styles.textPreview}>
                {selectedText.length > 200 ? 
                  selectedText.substring(0, 200) + '...' : 
                  selectedText
                }
              </div>
              <div className={styles.textStats}>
                {selectedText.length}자 선택됨
              </div>
            </div>
          ) : (
            <div className={styles.noSelection}>
              <p>좌측에서 수정할 텍스트를 선택해주세요</p>
            </div>
          )}
        </div>
      )}
      
      {/* AI 상호작용 영역 */}
      <div className={styles.interactionSection}>
        {isStyleMode ? (
          /* 문체 변경 모드 */
          <div className={styles.styleMode}>
            {/* 문체 선택 버튼들 */}
            <div className={styles.styleGrid}>
              {availableStyles.map((style) => (
                <button
                  key={style.key}
                  className={`${styles.styleButton} ${selectedStyleKey === style.key ? styles.selected : ''}`}
                  onClick={() => handleStyleSelect(style.key)}
                  disabled={isStyleProcessing}
                >
                  <strong>{style.name}</strong>
                  <small>{style.description}</small>
                </button>
              ))}
            </div>
            
            {/* 추가 지시사항 */}
            <div className={styles.additionalInstructions}>
              <label>추가 요청사항 (선택)</label>
              <textarea
                value={additionalStyleInstructions}
                onChange={(e) => setAdditionalStyleInstructions(e.target.value)}
                placeholder="문체에 대한 구체적인 요청사항이 있다면 입력해주세요..."
                rows={3}
                disabled={isStyleProcessing}
              />
            </div>
            
            {/* 선택된 텍스트 정보 */}
            {selectedText && selectedText.trim() ? (
              <div className={styles.selectedTextInfo}>
                <p>📝 선택된 텍스트: <strong>{selectedText.length}자</strong></p>
                <div className={styles.textPreview}>
                  {selectedText.length > 100 ? 
                    selectedText.substring(0, 100) + '...' : 
                    selectedText
                  }
                </div>
              </div>
            ) : (
              <div className={styles.noSelectionWarning}>
                <p>⚠️ <strong>텍스트를 먼저 선택해주세요</strong></p>
                <p>원고에서 문체를 변경하고 싶은 부분을 드래그하여 선택하세요.</p>
                {showStylePreviewInManuscript && (
                  <p className={styles.previewModeNote}>
                    💡 현재 미리보기 표시 중이므로 드래그 선택이 비활성화되었습니다.<br/>
                    다른 텍스트를 선택하려면 "미리보기 숨기기"를 클릭하세요.
                  </p>
                )}
              </div>
            )}
            
            {/* 미리보기 생성 버튼 */}
            <div className={styles.previewSection}>
              <button
                className={styles.previewButton}
                onClick={handleGeneratePreview}
                disabled={isStyleProcessing || !selectedText || !selectedStyleKey}
              >
                {isStyleProcessing ? '미리보기 생성 중...' : '미리보기 생성'}
              </button>
              
              {stylePreview && (
                <div className={styles.previewStatusContainer}>
                  <div className={styles.previewStatus}>
                    {showStylePreviewInManuscript ? '✅ 미리보기가 원고에 표시됨' : '👁️ 미리보기 숨김'}
                  </div>
                  <button
                    className={styles.togglePreviewButton}
                    onClick={toggleStylePreview}
                    disabled={isStyleProcessing}
                  >
                    {showStylePreviewInManuscript ? '미리보기 숨기기' : '미리보기 보기'}
                  </button>
                </div>
              )}
            </div>
            
            {/* 적용 버튼들 */}
            <div className={styles.styleActions}>
              <button
                className={styles.applyButton}
                onClick={handleApplyStyle}
                disabled={isStyleProcessing || !selectedStyleKey || !stylePreview}
              >
                {isStyleProcessing ? '적용 중...' : '전체 원고에 적용'}
              </button>
              
              <button
                className={styles.revertButton}
                onClick={handleRevertStyle}
                disabled={isStyleProcessing}
              >
                원본으로 되돌리기
              </button>
            </div>
          </div>
        ) : (
          <>
        {aiMode === 'modify' ? (
          /* 수정 모드 */
          <div className={styles.modifyMode}>
            <label className={styles.inputLabel}>
              수정 요청 내용:
            </label>
            
            {/* 템플릿 버튼들 */}
            <div className={styles.templates}>
              {modificationTemplates.map((template, index) => (
                <button
                  key={index}
                  className={styles.templateButton}
                  onClick={() => selectTemplate(template)}
                  disabled={isAiProcessing}
                >
                  {template}
                </button>
              ))}
            </div>
            
            {/* 사용자 입력 */}
            <textarea
              className={`${styles.inputArea} ${isInputFocused ? styles.focused : ''}`}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              placeholder="어떻게 수정하고 싶으신지 설명해주세요..."
              disabled={isAiProcessing || !selectedText}
              rows={4}
            />
            
            <button
              className={styles.submitButton}
              onClick={handleSubmit}
              disabled={isAiProcessing || !selectedText || !userInput.trim()}
            >
              {isAiProcessing ? '수정 중...' : '텍스트 수정'}
            </button>
          </div>
        ) : (
          /* 질문 생성 모드 */
          <div className={styles.questionMode}>
            <div className={styles.modeDescription}>
              <p>선택한 부분을 더 풍부하게 만들 수 있는 질문을 생성합니다.</p>
            </div>
            
            <button
              className={styles.submitButton}
              onClick={handleSubmit}
              disabled={isAiProcessing || !selectedText}
            >
              {isAiProcessing ? '질문 생성 중...' : '확장 질문 생성'}
            </button>
          </div>
        )}
        </>
        )}
      </div>
      
      {/* 결과 표시 영역 */}
      <div className={styles.resultSection}>
        {/* 오류 메시지 */}
        {(editingError || styleError) && (
          <div className={styles.errorMessage}>
            <strong>오류:</strong> {editingError || styleError}
          </div>
        )}
        
        {/* 수정 결과 */}
        {aiMode === 'modify' && lastResult && lastResult.modifiedText && (
          <div className={styles.modifyResult}>
            <h4>수정 결과</h4>
            <div className={styles.resultText}>
              {lastResult.modifiedText}
            </div>
            <div className={styles.resultActions}>
              <small>원고에 자동으로 적용되었습니다</small>
            </div>
          </div>
        )}
        
        {/* 질문 생성 결과 */}
        {aiMode === 'question' && generatedQuestions && generatedQuestions.length > 0 && (
          <div className={styles.questionResult}>
            <h4>확장 질문</h4>
            <div className={styles.questionList}>
              {generatedQuestions.map((question, index) => (
                <div key={index} className={styles.questionItem}>
                  <span className={styles.questionNumber}>{index + 1}.</span>
                  <span className={styles.questionText}>{question}</span>
                </div>
              ))}
            </div>
            <div className={styles.resultActions}>
              <small>이 질문들을 참고하여 내용을 더 자세히 작성해보세요</small>
            </div>
          </div>
        )}
        
        {/* 처리 중 상태 */}
        {(isAiProcessing || isStyleProcessing) && (
          <div className={styles.processingState}>
            <div className={styles.spinner}></div>
            <p>
              {isStyleProcessing 
                ? '문체를 변환하고 있습니다...' 
                : `AI가 ${aiMode === 'modify' ? '텍스트를 수정' : '질문을 생성'}하고 있습니다...`
              }
            </p>
          </div>
        )}
      </div>
      
      {/* 도움말 */}
      <div className={styles.helpSection}>
        <details className={styles.helpDetails}>
          <summary>사용법 도움말</summary>
          <div className={styles.helpContent}>
            <h5>내용 수정 모드:</h5>
            <ul>
              <li>원고에서 수정할 부분을 선택하세요</li>
              <li>어떻게 수정할지 구체적으로 설명하세요</li>
              <li>수정된 내용이 원고에 자동으로 적용됩니다</li>
            </ul>
            
            <h5>질문 생성 모드:</h5>
            <ul>
              <li>더 자세히 쓰고 싶은 부분을 선택하세요</li>
              <li>AI가 내용을 확장할 수 있는 질문을 제공합니다</li>
              <li>질문을 참고하여 직접 내용을 추가하세요</li>
            </ul>
            
            <h5>문체 변경 모드:</h5>
            <ul>
              <li>원고에서 텍스트를 선택하면 해당 부분의 문체 변환을 미리볼 수 있습니다</li>
              <li>텍스트를 선택하지 않으면 전체 원고의 첫 500자로 미리보기됩니다</li>
              <li>6가지 문체 중 원하는 스타일을 선택하세요</li>
              <li>마음에 들면 '전체 원고에 적용' 버튼을 클릭하세요</li>
              <li>언제든 '원본으로 되돌리기' 버튼으로 복원할 수 있습니다</li>
            </ul>
          </div>
        </details>
      </div>
    </div>
  );
}

export default AIInteractionPanel;