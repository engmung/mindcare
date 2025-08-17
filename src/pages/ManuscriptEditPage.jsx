import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useManuscriptStore from '../stores/manuscriptStore.js';
import { useProjectStore } from '../stores/projectStore.js';
import ManuscriptViewer from '../components/ManuscriptViewer.jsx';
import AIInteractionPanel from '../components/AIInteractionPanel.jsx';
import OutlineNavigator from '../components/OutlineNavigator.jsx';
import styles from './ManuscriptEditPage.module.css';

/**
 * ManuscriptEditPage
 * 
 * 용도: 원고 편집의 메인 페이지 - 좌우 분할 레이아웃
 * 사용처: 원고 생성 완료 후 편집 단계
 * 기능: 원고 뷰어, AI 상호작용 패널, 목차 네비게이터 통합
 */

function ManuscriptEditPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { updateProjectData, resetToStep, updateProjectStep } = useProjectStore();
  
  // Zustand 스토어
  const {
    currentManuscript,
    isGenerating,
    generationError,
    selectedText,
    aiMode,
    isAiProcessing,
    canUndo,
    canRedo,
    undo,
    redo,
    resetManuscriptState,
    generateManuscript,
    setOutline,
    setManuscript,
    setCurrentProjectId,
    saveManuscriptToProject,
    getEditingSummary,
    outline,
    setManuscriptImages,
    setStyleMode,
    isStyleMode,
    saveStyleStateToStorage,
    loadStyleStateFromStorage,
    clearStyleStateFromStorage
  } = useManuscriptStore();
  
  // 로컬 상태
  const [showOutlineNav, setShowOutlineNav] = useState(false); // 기본적으로 목차 숨김
  const [isInitialized, setIsInitialized] = useState(false);
  const isInitializingRef = useRef(false);
  
  // 페이지 초기화
  useEffect(() => {
    const initializePage = async () => {
      if (isInitializingRef.current) {
        console.log('ManuscriptEditPage - 이미 초기화 중, 중복 실행 방지');
        return;
      }
      
      isInitializingRef.current = true;
      
      try {
        // 라우터 state에서 데이터 확인
        const { conversations, outlineData, projectId } = location.state || {};
        
        // 프로젝트 ID가 없으면 현재 프로젝트에서 가져오기
        const currentProjectId = projectId || (location.state && 'projectId' in location.state ? location.state.projectId : null);
        
        if (currentProjectId) {
          setCurrentProjectId(currentProjectId); // manuscriptStore에 설정
        }
        
        if (!conversations || !outlineData) {
          console.error('ManuscriptEditPage - 필수 데이터 누락');
          navigate('/mypage', { 
            replace: true,
            state: { error: '원고 생성에 필요한 데이터가 없습니다.' }
          });
          return;
        }
        
        console.log('ManuscriptEditPage - 초기화 시작');
        console.log('- 대화 수:', conversations.length);
        console.log('- 목차 형식:', outlineData.format_type);
        
        // 목차 정보 설정
        console.log('ManuscriptEditPage - 목차 데이터 설정:', outlineData);
        setOutline(outlineData);
        
        // 프로젝트에서 기존 원고 및 이미지 확인 - localStorage에서 직접 최신 데이터 가져오기
        let existingManuscript = '';
        let existingImages = [];
        
        try {
          const allProjects = JSON.parse(localStorage.getItem('autobiography_projects') || '[]');
          const currentProject = allProjects.find(p => p.id === currentProjectId);
          existingManuscript = currentProject?.data?.manuscript || '';
          existingImages = currentProject?.data?.manuscriptImages || [];
          
          console.log('ManuscriptEditPage - localStorage에서 원고 및 이미지 확인:', {
            projectId: currentProjectId,
            manuscriptLength: existingManuscript.length,
            hasManuscript: !!existingManuscript.trim(),
            imageCount: existingImages.length
          });
        } catch (error) {
          console.error('ManuscriptEditPage - localStorage 데이터 로드 실패:', error);
          // fallback으로 라우터 state 사용
          const projectData = location.state;
          existingManuscript = projectData?.manuscript || '';
          existingImages = projectData?.manuscriptImages || [];
        }
        
        // 기존 이미지 로드
        if (existingImages && existingImages.length > 0) {
          console.log('ManuscriptEditPage - 기존 이미지 로드:', existingImages.length, '개');
          setManuscriptImages(existingImages);
        }
        
        if (existingManuscript && existingManuscript.trim().length > 0) {
          console.log('ManuscriptEditPage - 기존 원고 로드:', existingManuscript.length, '자');
          setManuscript(existingManuscript, false); // 히스토리에 추가하지 않음
        } else if (!currentManuscript || currentManuscript.trim().length === 0) {
          console.log('ManuscriptEditPage - 새 원고 생성 중...');
          const result = await generateManuscript({
            conversations,
            outlineData
          });
          
          if (!result.success) {
            console.error('원고 생성 실패:', result.error);
            navigate('/mypage', {
              replace: true,
              state: { error: `원고 생성 실패: ${result.error}` }
            });
            return;
          }
          
          // 생성된 원고를 프로젝트에 저장
          if (updateProjectData && result.manuscript) {
            console.log('ManuscriptEditPage - 원고를 프로젝트에 저장:', {
              manuscriptLength: result.manuscript.length,
              projectId: currentProjectId
            });
            updateProjectData({ 
              manuscript: result.manuscript 
            });
            // currentStep을 8로 업데이트
            if (updateProjectStep && currentProjectId) {
              updateProjectStep(currentProjectId, 8);
            }
          } else {
            console.warn('ManuscriptEditPage - 프로젝트 저장 실패:', {
              hasUpdateFunction: !!updateProjectData,
              hasManuscript: !!result.manuscript,
              manuscriptLength: result.manuscript?.length || 0
            });
          }
        }
        
        setIsInitialized(true);
        console.log('ManuscriptEditPage - 초기화 완료');
        
        // 문체 상태 복원 시도
        loadStyleStateFromStorage(currentProjectId);
        
      } catch (error) {
        console.error('ManuscriptEditPage 초기화 오류:', error);
        navigate('/mypage', {
          replace: true,
          state: { error: `초기화 실패: ${error.message}` }
        });
      } finally {
        isInitializingRef.current = false;
      }
    };
    
    initializePage();
    
    // 컴포넌트 언마운트 시 상태 정리는 하지 않음 (뒤로가기 대응)
    
  }, []); // 빈 배열로 한 번만 실행
  
  // 문체 상태 자동 저장 (변경될 때마다)
  useEffect(() => {
    if (isInitialized) {
      const projectId = location.state?.projectId;
      if (projectId) {
        console.log('ManuscriptEditPage - 문체 상태 저장 트리거:', {
          isStyleMode,
          projectId,
          isInitialized
        });
        saveStyleStateToStorage(projectId);
      }
    }
  }, [isStyleMode, isInitialized, location.state?.projectId, saveStyleStateToStorage]);
  
  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Z: Undo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) {
          undo();
        }
      }
      
      // Ctrl+Shift+Z 또는 Ctrl+Y: Redo
      if ((e.ctrlKey && e.shiftKey && e.key === 'Z') || (e.ctrlKey && e.key === 'y')) {
        e.preventDefault();
        if (canRedo()) {
          redo();
        }
      }
      
      // ESC: 선택 해제
      if (e.key === 'Escape') {
        // 선택된 텍스트가 있으면 해제
        if (selectedText) {
          window.getSelection().removeAllRanges();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo, selectedText]);
  
  // 원고 자동 저장 (디바운싱)
  useEffect(() => {
    if (!currentManuscript || !isInitialized) return;
    
    const saveTimer = setTimeout(() => {
      saveManuscriptToProject();
    }, 2000); // 2초 후 자동 저장
    
    return () => clearTimeout(saveTimer);
  }, [currentManuscript, isInitialized, saveManuscriptToProject]);
  
  // 목차 상태 디버깅
  useEffect(() => {
    console.log('ManuscriptEditPage - outline 상태 변경:', outline);
  }, [outline]);
  
  // 완료 후 문체 변경 모드로 전환
  const handleComplete = () => {
    // 문체 변경 모드 활성화
    setStyleMode(true);
    console.log('ManuscriptEditPage - 문체 변경 모드로 전환');
  };
  
  // 메인 메뉴로 돌아가기
  const handleBackToMain = () => {
    if (confirm('편집 중인 내용이 저장되지 않을 수 있습니다. 정말 나가시겠습니까?')) {
      resetManuscriptState();
      navigate('/mypage');
    }
  };
  
  // 목차 선택 페이지로 돌아가기 또는 문체 모드 종료
  const handleBackToOutline = async () => {
    // 문체 모드인 경우 문체 모드만 종료
    if (isStyleMode) {
      setStyleMode(false);
      console.log('ManuscriptEditPage - 문체 모드 종료, 원고 편집 모드로 복귀');
      return;
    }
    
    // 원고 편집 모드인 경우 목차 선택으로 돌아가기
    const { conversations, outlineData, projectId } = location.state || {};
    if (conversations && projectId) {
      if (confirm('원고 데이터가 삭제됩니다. 목차 단계로 돌아가시겠습니까?')) {
        console.log('ManuscriptEditPage - 목차 선택 페이지로 돌아가기, 원고 데이터 삭제');
        // 7단계(목차 완료)로 돌아가면서 원고 데이터 삭제
        await resetToStep(7);
        
        // 추가 안전 지연
        await new Promise(resolve => setTimeout(resolve, 100));
        
        navigate('/outline-selection', {
          state: {
            conversations,
            projectId
          }
        });
      }
    } else {
      console.warn('ManuscriptEditPage - 목차 페이지로 돌아가기 위한 데이터 부족');
      handleBackToMain();
    }
  };
  
  // 로딩 상태
  if (!isInitialized) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <p>원고를 {isGenerating ? '생성' : '준비'}하고 있습니다...</p>
          {generationError && (
            <div className={styles.errorMessage}>
              오류: {generationError}
            </div>
          )}
        </div>
      </div>
    );
  }
  
  return (
    <div className={styles.container}>
      {/* 상단 툴바 */}
      <header className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button 
            className={styles.backButton}
            onClick={handleBackToOutline}
            title={isStyleMode ? "원고 편집 모드로 돌아가기" : "목차 선택으로 돌아가기"}
          >
            {isStyleMode ? '← 원고 편집' : '← 목차 편집'}
          </button>
          
          <button 
            className={styles.backButton}
            onClick={handleBackToMain}
            title="메인으로 돌아가기"
          >
            ← 메인으로
          </button>
          
          <div className={styles.pageTitle}>
            <h1>{isStyleMode ? '문체 변경' : '원고 편집'}</h1>
            <span className={styles.subtitle}>
              {isStyleMode ? 
                '원하는 문체를 선택하고 미리보기를 확인하세요' : 
                '텍스트를 선택하여 수정하거나 질문을 생성하세요'
              }
            </span>
          </div>
        </div>
        
        <div className={styles.toolbarRight}>
          {/* 편집 통계 */}
          <div className={styles.editStats}>
            <span>글자수: {currentManuscript.length.toLocaleString()}</span>
            <span>편집: {getEditingSummary().totalEdits}회</span>
          </div>
          
          {/* Undo/Redo 버튼 */}
          <div className={styles.historyControls}>
            <button
              className={styles.historyButton}
              onClick={undo}
              disabled={!canUndo()}
              title="실행 취소 (Ctrl+Z)"
            >
              ↶
            </button>
            <button
              className={styles.historyButton}
              onClick={redo}
              disabled={!canRedo()}
              title="다시 실행 (Ctrl+Y)"
            >
              ↷
            </button>
          </div>
          
          {/* 문체 모드가 아닐 때만 표시 */}
          {!isStyleMode && (
            <>
              {/* 개발용 원고 재생성 버튼 */}
              <button
                className={styles.devButton}
                onClick={async () => {
                  if (confirm('원고를 재생성하시겠습니까? 현재 원고는 삭제됩니다.')) {
                    const { conversations, outlineData } = location.state || {};
                    if (conversations && outlineData) {
                      await generateManuscript({ conversations, outlineData });
                    }
                  }
                }}
                disabled={isGenerating}
                title="원고 재생성 (개발용)"
              >
                🔄 원고 재생성
              </button>
              
              {/* 완료 버튼 */}
              <button
                className={styles.completeButton}
                onClick={handleComplete}
                disabled={isAiProcessing}
              >
                편집 완료
              </button>
            </>
          )}
        </div>
      </header>
      
      {/* 목차 토글 버튼 (화면 좌측 가장자리) */}
      <button
        className={`${styles.outlineToggleButton} ${showOutlineNav ? styles.active : ''}`}
        onClick={() => setShowOutlineNav(!showOutlineNav)}
        title={`목차 ${showOutlineNav ? '숨기기' : '보기'}`}
      >
        📑
      </button>

      {/* 메인 컨텐츠 영역 */}
      <main className={styles.mainContent}>
        {/* 좌측: 원고 뷰어 + 목차 네비게이터 */}
        <div className={styles.leftPanel}>
          {/* 목차 네비게이터 (접을 수 있음) */}
          <div className={`${styles.outlineNavSection} ${showOutlineNav ? styles.show : ''}`}>
            <OutlineNavigator />
          </div>
          
          {/* 원고 뷰어 */}
          <div className={styles.manuscriptSection}>
            <ManuscriptViewer />
          </div>
        </div>
        
        {/* 우측: AI 상호작용 패널 */}
        <div className={styles.rightPanel}>
          <AIInteractionPanel />
        </div>
      </main>
      
      {/* 하단 상태바 */}
      <footer className={styles.statusBar}>
        <div className={styles.statusLeft}>
          {selectedText && (
            <span className={styles.selectionInfo}>
              선택된 텍스트: {selectedText.length}자
            </span>
          )}
          
          {isAiProcessing && (
            <span className={styles.processingInfo}>
              AI {aiMode === 'modify' ? '수정' : '질문 생성'} 중...
            </span>
          )}
        </div>
        
        <div className={styles.statusRight}>
          <span className={styles.modeInfo}>
            현재 모드: {aiMode === 'modify' ? '내용 수정' : '질문 생성'}
          </span>
        </div>
      </footer>
    </div>
  );
}

export default ManuscriptEditPage;