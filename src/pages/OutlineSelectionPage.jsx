/**
 * OutlineSelectionPage
 * 
 * 용도: 목차 시안 선택 및 수정 페이지
 * 사용처: /project/:projectId/outline 경로
 * props: projectId (URL 파라미터)
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore';
import { useWriteStore } from '../stores/writeStore';
import outlineAgent from '../agents/OutlineAgent';
import styles from './OutlineSelectionPage.module.css';

const OutlineSelectionPage = () => {
  const { projectId: paramProjectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentProject, saveOutline, updateProjectData, resetToStep, updateProjectStep } = useProjectStore();
  
  // location.state에서 데이터 가져오기 (MyPage에서 전달)
  const { conversations: stateConversations, projectId: stateProjectId } = location.state || {};
  const projectId = paramProjectId || stateProjectId;
  const conversations = stateConversations || useWriteStore.getState().conversations;
  
  // 상태 관리
  const [outlines, setOutlines] = useState([]); // 현재 표시 중인 목차들
  const [currentOutlineIndex, setCurrentOutlineIndex] = useState(0); // 캐러셀 현재 인덱스
  const [selectedOutline, setSelectedOutline] = useState(null); // 선택된 목차
  const [isEditMode, setIsEditMode] = useState(false); // 수정 모드 여부
  const [modificationRequest, setModificationRequest] = useState(''); // 수정 요청 내용
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editHistory, setEditHistory] = useState([]); // 수정 이력
  const isInitializedRef = useRef(false);
  
  // 터치 이벤트를 위한 ref
  const touchStartRef = useRef(null);
  const touchEndRef = useRef(null);

  // 캐러셀 네비게이션 함수들
  const goToPrevious = () => {
    if (outlines.length > 0) {
      setCurrentOutlineIndex((prevIndex) => 
        prevIndex === 0 ? outlines.length - 1 : prevIndex - 1
      );
    }
  };

  const goToNext = () => {
    if (outlines.length > 0) {
      setCurrentOutlineIndex((prevIndex) => 
        prevIndex === outlines.length - 1 ? 0 : prevIndex + 1
      );
    }
  };

  const goToIndex = (index) => {
    if (index >= 0 && index < outlines.length) {
      setCurrentOutlineIndex(index);
    }
  };

  // 키보드 네비게이션
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isLoading || isEditMode) return; // 로딩 중이거나 편집 모드일 때는 비활성화
      
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, isEditMode, outlines.length]);

  // 터치 이벤트 핸들러
  const handleTouchStart = (e) => {
    if (isLoading || isEditMode || outlines.length <= 1) return;
    touchStartRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e) => {
    if (isLoading || isEditMode || outlines.length <= 1) return;
    touchEndRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (isLoading || isEditMode || outlines.length <= 1) return;
    
    if (!touchStartRef.current || !touchEndRef.current) return;
    
    const distance = touchStartRef.current - touchEndRef.current;
    const minSwipeDistance = 50;
    
    if (distance > minSwipeDistance) {
      // 왼쪽으로 스와이프 (다음)
      goToNext();
    } else if (distance < -minSwipeDistance) {
      // 오른쪽으로 스와이프 (이전)
      goToPrevious();
    }
    
    // 초기화
    touchStartRef.current = null;
    touchEndRef.current = null;
  };

  // 필수 데이터 확인
  useEffect(() => {
    console.log('OutlineSelectionPage - 초기화:', {
      projectId,
      hasConversations: !!conversations,
      conversationsLength: conversations?.length || 0,
      hasCurrentProject: !!currentProject
    });
    
    // 필수 데이터가 없으면 마이페이지로 리다이렉트
    if (!projectId || !conversations || conversations.length === 0) {
      console.error('OutlineSelectionPage - 필수 데이터 누락');
      navigate('/mypage', {
        replace: true,
        state: { error: '목차 생성에 필요한 데이터가 없습니다.' }
      });
      return;
    }
  }, [projectId, conversations, navigate]);

  // 첫 진입 시 3개 시안 생성
  useEffect(() => {
    if (conversations.length > 0 && outlines.length === 0 && !isLoading && !isInitializedRef.current) {
      console.log('OutlineSelectionPage - 목차 생성 조건 충족, 생성 시작');
      isInitializedRef.current = true;
      generateInitialOutlines();
    }
  }, [conversations.length]); // conversations 길이 변경 시 확인

  // 3개의 목차 시안 생성 (첫 생성 또는 새로고침)
  const generateInitialOutlines = async () => {
    if (isLoading) {
      console.log('OutlineSelectionPage - 이미 로딩 중, 중복 생성 방지');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('OutlineSelectionPage - 목차 생성 API 호출');
      const result = await outlineAgent.generateOutlineOptions(
        conversations,
        null, // 마인드맵 데이터는 추후 연동
        currentProject.format || 'free'
      );
      
      if (result.success && result.data.options) {
        setOutlines(result.data.options);
        setCurrentOutlineIndex(0); // 첫 번째 목차로 리셋
        setIsEditMode(false);
        setSelectedOutline(null);
        setModificationRequest('');
      } else {
        throw new Error(result.error || '목차 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('목차 생성 오류:', error);
      setError('목차 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 목차 선택
  const handleSelectOutline = (outline) => {
    setSelectedOutline(outline);
    setOutlines([outline]); // 선택된 목차만 표시
    setCurrentOutlineIndex(0); // 인덱스 리셋
    setIsEditMode(true);
    setEditHistory([outline]); // 수정 이력 시작
  };

  // 목차 수정 요청
  const handleModifyOutline = async () => {
    if (!modificationRequest.trim() || !selectedOutline) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await outlineAgent.refineOutline(
        selectedOutline,
        modificationRequest,
        conversations,
        currentProject.format || 'free'
      );
      
      if (result.success && result.data) {
        const modifiedOutline = {
          ...result.data,
          option_number: 1,
          concept: "수정된 목차"
        };
        
        setOutlines([modifiedOutline]);
        setCurrentOutlineIndex(0); // 인덱스 리셋
        setSelectedOutline(modifiedOutline);
        setEditHistory([...editHistory, modifiedOutline]);
        setModificationRequest('');
      } else {
        throw new Error(result.error || '목차 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('목차 수정 오류:', error);
      setError('목차 수정 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 목차 확정 및 저장
  const handleConfirmOutline = async () => {
    if (!selectedOutline) return;
    
    // 목차 데이터 준비
    const outlineData = {
      format_type: selectedOutline.format_type,
      overall_theme: selectedOutline.overall_theme,
      chapters: selectedOutline.chapters
    };
    
    // 프로젝트 데이터에 목차 저장
    if (updateProjectData) {
      console.log('OutlineSelectionPage - 목차 저장:', outlineData);
      updateProjectData({ 
        outline: outlineData
      });
      // currentStep을 7로 업데이트 (목차 완료)
      if (updateProjectStep && projectId) {
        updateProjectStep(projectId, 7);
      }
    }
    
    console.log('OutlineSelectionPage - 목차 확정, 원고 편집 페이지로 이동');
    
    // 원고 편집 페이지로 바로 이동
    navigate('/manuscript-edit', {
      state: {
        conversations: conversations,
        outlineData: outlineData,
        projectId: projectId
      }
    });
  };

  // 이전 버전으로 되돌리기
  const handleRevertToPrevious = () => {
    if (editHistory.length > 1) {
      const newHistory = [...editHistory];
      newHistory.pop(); // 현재 버전 제거
      const previousOutline = newHistory[newHistory.length - 1];
      
      setOutlines([previousOutline]);
      setCurrentOutlineIndex(0); // 인덱스 리셋
      setSelectedOutline(previousOutline);
      setEditHistory(newHistory);
    }
  };

  // 목차 렌더링
  const renderOutlineCard = (outline, index) => (
    <div key={index} className={styles.outlineCard}>
      <div className={styles.outlineHeader}>
        <h3>{outline.concept || `시안 ${outline.option_number}`}</h3>
        <span className={styles.formatBadge}>{outline.format_type}</span>
      </div>
      
      <div className={styles.outlineTheme}>
        <strong>전체 주제:</strong> {outline.overall_theme}
      </div>
      
      <div className={styles.chapterList}>
        <h4>목차 구성</h4>
        {outline.chapters.map((chapter) => (
          <div key={chapter.chapter_number} className={styles.chapterItem}>
            <div className={styles.chapterNumber}>제{chapter.chapter_number}장</div>
            <div className={styles.chapterContent}>
              <div className={styles.chapterTitle}>{chapter.title}</div>
              <div className={styles.chapterTheme}>{chapter.theme}</div>
              {chapter.key_events && chapter.key_events.length > 0 && (
                <div className={styles.keyEvents}>
                  {chapter.key_events.slice(0, 3).map((event, idx) => (
                    <span key={idx} className={styles.eventTag}>{event}</span>
                  ))}
                  {chapter.key_events.length > 3 && (
                    <span className={styles.moreEvents}>+{chapter.key_events.length - 3}개</span>
                  )}
                </div>
              )}
              <div className={styles.chapterMeta}>
                <span className={styles.emotionalTone}>{chapter.emotional_tone}</span>
                <span className={styles.estimatedLength}>{chapter.estimated_length}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {!isEditMode && (
        <button
          onClick={() => handleSelectOutline(outline)}
          className={styles.selectButton}
        >
          이 목차 선택하기
        </button>
      )}
    </div>
  );

  if (!currentProject) {
    return <div>프로젝트를 찾을 수 없습니다.</div>;
  }

  return (
    <div className={styles.outlineSelectionPage}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>목차 구성하기</h1>
          <p>AI가 제안하는 목차 중 하나를 선택하고, 원하는대로 수정해보세요.</p>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}

        {isLoading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.spinner}></div>
            <p>{isEditMode ? '목차를 수정하고 있습니다...' : '목차를 생성하고 있습니다...'}</p>
          </div>
        ) : (
          <>
            <div className={styles.actionBar}>
              <button
                onClick={async () => {
                  if (confirm('목차 데이터가 삭제됩니다. 질문 단계로 돌아가시겠습니까?')) {
                    console.log('OutlineSelectionPage - AI 질문 페이지로 돌아가기, 목차 데이터 삭제');
                    
                    // 6단계(질문 완료)로 돌아가면서 목차, 원고 데이터 삭제
                    await resetToStep(6);
                    
                    // 추가 안전 지연
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    navigate(`/project/${projectId}/questions`, {
                      state: { conversations }
                    });
                  }
                }}
                className={styles.backButton}
                disabled={isLoading}
              >
                ← 질문 단계로 돌아가기
              </button>
              
              <button
                onClick={generateInitialOutlines}
                className={styles.refreshButton}
                disabled={isLoading}
              >
                🔄 새로운 시안 받기
              </button>
              
              {isEditMode && editHistory.length > 1 && (
                <button
                  onClick={handleRevertToPrevious}
                  className={styles.revertButton}
                >
                  ↩️ 이전 버전으로
                </button>
              )}
              
              {isEditMode && selectedOutline && (
                <button
                  onClick={handleConfirmOutline}
                  className={styles.confirmButton}
                >
                  ✅ 목차 확정하기
                </button>
              )}
            </div>

            {/* 캐러셀 컨테이너 */}
            <div className={styles.carouselContainer}>
              {/* 네비게이션 헤더 */}
              {outlines.length > 1 && (
                <div className={styles.carouselHeader}>
                  <button
                    onClick={goToPrevious}
                    className={styles.carouselButton}
                    disabled={isLoading}
                  >
                    ◀
                  </button>
                  
                  <div className={styles.carouselIndicators}>
                    {outlines.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => goToIndex(index)}
                        className={`${styles.indicator} ${
                          index === currentOutlineIndex ? styles.indicatorActive : ''
                        }`}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                  
                  <button
                    onClick={goToNext}
                    className={styles.carouselButton}
                    disabled={isLoading}
                  >
                    ▶
                  </button>
                </div>
              )}
              
              {/* 현재 목차 카드 */}
              <div 
                className={styles.currentOutlineContainer}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {outlines.length > 0 && renderOutlineCard(outlines[currentOutlineIndex], currentOutlineIndex)}
              </div>
              
              {/* 키보드/터치 안내 */}
              {outlines.length > 1 && !isEditMode && (
                <div className={styles.navigationHint}>
                  <span className={styles.desktopHint}>← → 키로 목차를 탐색할 수 있습니다</span>
                  <span className={styles.mobileHint}>좌우로 스와이프하여 목차를 탐색할 수 있습니다</span>
                </div>
              )}
            </div>

            {isEditMode && (
              <div className={styles.modificationSection}>
                <h3>목차 수정하기</h3>
                <p>원하는 수정 사항을 자유롭게 입력해주세요.</p>
                <textarea
                  value={modificationRequest}
                  onChange={(e) => setModificationRequest(e.target.value)}
                  placeholder="예: 5장과 6장 순서를 바꿔주세요 / 어린 시절 부분을 더 자세히 / 가족 이야기를 별도 장으로 / 제목을 더 감성적으로..."
                  className={styles.modificationInput}
                  rows={4}
                />
                <button
                  onClick={handleModifyOutline}
                  disabled={!modificationRequest.trim() || isLoading}
                  className={styles.modifyButton}
                >
                  수정 요청하기
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default OutlineSelectionPage;