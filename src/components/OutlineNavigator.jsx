import { useState } from 'react';
import useManuscriptStore from '../stores/manuscriptStore.js';
import styles from './OutlineNavigator.module.css';

/**
 * OutlineNavigator
 * 
 * 용도: 목차 기반 네비게이션 제공
 * 사용처: ManuscriptEditPage 좌측 상단 (접을 수 있음)
 * 기능: 목차 표시, 클릭 시 해당 장으로 스크롤
 */

function OutlineNavigator() {
  const { outline } = useManuscriptStore();
  const [expandedChapters, setExpandedChapters] = useState(new Set());
  
  // 특정 장으로 스크롤
  const scrollToChapter = (chapterNumber) => {
    const element = document.getElementById(`chapter-${chapterNumber}`);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  };
  
  // 장 확장/축소 토글
  const toggleChapter = (chapterNumber) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(chapterNumber)) {
      newExpanded.delete(chapterNumber);
    } else {
      newExpanded.add(chapterNumber);
    }
    setExpandedChapters(newExpanded);
  };
  
  if (!outline || !outline.chapters || outline.chapters.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h3>목차</h3>
        </div>
        <div className={styles.emptyState}>
          <p>목차 정보가 없습니다.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>목차</h3>
        <div className={styles.outlineInfo}>
          <span className={styles.formatType}>{outline.format_type}</span>
          <span className={styles.chapterCount}>{outline.chapters.length}개 장</span>
        </div>
      </div>
      
      <div className={styles.content}>
        {/* 전체 주제 */}
        {outline.overall_theme && (
          <div className={styles.overallTheme}>
            <strong>전체 주제:</strong> {outline.overall_theme}
          </div>
        )}
        
        {/* 장 목록 */}
        <div className={styles.chapterList}>
          {outline.chapters.map((chapter) => {
            const isExpanded = expandedChapters.has(chapter.chapter_number);
            
            return (
              <div key={chapter.chapter_number} className={styles.chapterItem}>
                {/* 장 제목 */}
                <div 
                  className={styles.chapterHeader}
                  onClick={() => scrollToChapter(chapter.chapter_number)}
                >
                  <span className={styles.chapterNumber}>
                    제{chapter.chapter_number}장
                  </span>
                  <span className={styles.chapterTitle}>
                    {chapter.title}
                  </span>
                  
                  {/* 확장/축소 버튼 */}
                  <button
                    className={`${styles.expandButton} ${isExpanded ? styles.expanded : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleChapter(chapter.chapter_number);
                    }}
                    title={isExpanded ? '축소' : '확장'}
                  >
                    ▼
                  </button>
                </div>
                
                {/* 장 세부 정보 (확장 시) */}
                {isExpanded && (
                  <div className={styles.chapterDetails}>
                    {/* 주제 */}
                    {chapter.theme && (
                      <div className={styles.detailItem}>
                        <strong>주제:</strong> {chapter.theme}
                      </div>
                    )}
                    
                    {/* 주요 사건 */}
                    {chapter.key_events && chapter.key_events.length > 0 && (
                      <div className={styles.detailItem}>
                        <strong>주요 사건:</strong>
                        <ul className={styles.eventList}>
                          {chapter.key_events.map((event, index) => (
                            <li key={index}>{event}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* 감정 톤 */}
                    {chapter.emotional_tone && (
                      <div className={styles.detailItem}>
                        <strong>감정 톤:</strong> {chapter.emotional_tone}
                      </div>
                    )}
                    
                    {/* 추가 설명 */}
                    {chapter.description && (
                      <div className={styles.detailItem}>
                        <strong>설명:</strong> {chapter.description}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* 빠른 액션 */}
        <div className={styles.quickActions}>
          <button
            className={styles.actionButton}
            onClick={() => {
              // 모든 장 확장
              setExpandedChapters(new Set(outline.chapters.map(ch => ch.chapter_number)));
            }}
          >
            모두 확장
          </button>
          <button
            className={styles.actionButton}
            onClick={() => {
              // 모든 장 축소
              setExpandedChapters(new Set());
            }}
          >
            모두 축소
          </button>
        </div>
      </div>
    </div>
  );
}

export default OutlineNavigator;