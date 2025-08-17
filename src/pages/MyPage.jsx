/**
 * MyPage
 * 
 * 용도: 심리상담 프로젝트 관리 페이지
 * 사용처: /projects 경로
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { useProjectStore } from '../stores/projectStore';
import { useWriteStore } from '../stores/writeStore';
import styles from './MyPage.module.css';

const MyPage = () => {
  const navigate = useNavigate();
  const { userInfo } = useUserStore();
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const { 
    projects, 
    createProject,
    deleteProject, 
    updateProjectStatus, 
    getProjectStats, 
    getProjectProgress,
    selectProject,
    duplicateProject,
    updateProjectTitle 
  } = useProjectStore();
  const { resetWriteData } = useWriteStore();

  const stats = getProjectStats();

  const handleProjectClick = (project) => {
    selectProject(project.id);
    
    // 프로젝트 단계와 데이터 상태에 따라 적절한 페이지로 이동
    const { currentStep, data } = project;
    
    console.log('MyPage - 프로젝트 클릭:', {
      projectId: project.id,
      currentStep,
      hasConversations: !!data.conversations?.length,
      conversationsCount: data.conversations?.length || 0,
      hasOutline: !!data.outline,
      hasManuscript: !!data.manuscript
    });
    
    // 1. 원고 편집 단계 (목차 완료, 대화 완료)
    if (currentStep >= 8 && data.outline && data.conversations?.length > 0) {
      console.log('MyPage - 원고 편집 페이지로 이동');
      navigate('/manuscript-edit', {
        state: {
          conversations: data.conversations,
          outlineData: data.outline,
          manuscript: data.manuscript || '',
          projectId: project.id
        }
      });
      return;
    }
    
    // 2. 목차 선택 단계 (currentStep이 정확히 7이고, 대화 완료, 목차 미완료)
    if (currentStep === 7 && data.conversations?.length > 0 && !data.outline) {
      console.log('MyPage - 목차 선택 페이지로 이동 (step 7)');
      navigate('/outline-selection', {
        state: {
          conversations: data.conversations,
          projectId: project.id
        }
      });
      return;
    }
    
    // 2-1. 목차가 있고 currentStep >= 7인 경우 원고 편집으로
    if (currentStep >= 7 && data.conversations?.length > 0 && data.outline) {
      console.log('MyPage - 목차가 있으므로 원고 편집 페이지로 이동');
      navigate('/manuscript-edit', {
        state: {
          conversations: data.conversations,
          outlineData: data.outline,
          manuscript: data.manuscript || '',
          projectId: project.id
        }
      });
      return;
    }
    
    // 3. AI 질문 단계 (currentStep <= 6 또는 기타 모든 경우)
    console.log('MyPage - AI 질문 페이지로 이동 (step 6 이하 또는 기본)');
    navigate(`/project/${project.id}/questions`);
  };

  const handleCreateNewProject = () => {
    // 임시 프로젝트 생성 (AI가 나중에 설정 질문으로 정보 수집)
    const newProject = createProject('새 자서전 프로젝트', 'free');
    
    // WriteStore 초기화 
    resetWriteData();
    
    // AI 질문 페이지로 이동
    navigate(`/project/${newProject.id}/questions`);
  };

  const handleDeleteProject = (projectId, projectTitle) => {
    if (window.confirm(`"${projectTitle}" 프로젝트를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      deleteProject(projectId);
    }
  };

  const handleDuplicateProject = (projectId, projectTitle) => {
    if (window.confirm(`"${projectTitle}" 프로젝트를 복사하시겠습니까?`)) {
      const duplicated = duplicateProject(projectId);
      if (duplicated) {
        alert(`프로젝트가 복사되었습니다: ${duplicated.title}`);
      }
    }
  };

  const handleStartEditTitle = (e, projectId, currentTitle) => {
    e.stopPropagation(); // 프로젝트 클릭 이벤트 방지
    setEditingProjectId(projectId);
    setEditingTitle(currentTitle);
  };

  const handleSaveTitle = (projectId) => {
    const trimmedTitle = editingTitle.trim();
    if (trimmedTitle && trimmedTitle !== '') {
      updateProjectTitle(projectId, trimmedTitle);
    }
    setEditingProjectId(null);
    setEditingTitle('');
  };

  const handleCancelEdit = () => {
    setEditingProjectId(null);
    setEditingTitle('');
  };

  const handleTitleKeyDown = (e, projectId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTitle(projectId);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'in_progress': return '진행중';
      case 'completed': return '완료';
      case 'paused': return '일시정지';
      default: return status;
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'in_progress': return styles.statusInProgress;
      case 'completed': return styles.statusCompleted;
      case 'paused': return styles.statusPaused;
      default: return '';
    }
  };

  const getStepText = (step) => {
    const stepMap = {
      1: '상담 준비',
      2: '기본 정보',
      3: '상담 시작',
      4: '주제 선택',
      5: 'AI 대화',
      6: '대화 완료',
      7: '상담 정리',
      8: '초안 생성',
      9: '내용 수정',
      10: '스타일 선택',
      11: '상담 완성',
      12: '완료'
    };
    return stepMap[step] || `단계 ${step}`;
  };

  return (
    <div className={styles.myPage}>
      <div className={styles.container}>
        {/* 헤더 섹션 */}
        <div className={styles.header}>
          <div className={styles.welcome}>
            <h1>{userInfo?.nickname}님의 심리상담 공간</h1>
            <p>AI와 함께하는 편안한 마음 여행</p>
          </div>
          
          <button onClick={handleCreateNewProject} className={styles.createButton}>
            + 새 상담 시작
          </button>
        </div>

        {/* 통계 섹션 */}
        <div className={styles.statsSection}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>{stats.total}</div>
              <div className={styles.statLabel}>전체 상담</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>{stats.inProgress}</div>
              <div className={styles.statLabel}>진행중</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>{stats.completed}</div>
              <div className={styles.statLabel}>완료</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statNumber}>{stats.paused}</div>
              <div className={styles.statLabel}>일시정지</div>
            </div>
          </div>
        </div>

        {/* 프로젝트 목록 */}
        <div className={styles.projectsSection}>
          <h2>내 상담 목록</h2>
          
          {projects.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>💙</div>
              <h3>아직 상담 기록이 없습니다</h3>
              <p>AI와 함께 첫 심리상담을 시작해보세요!</p>
              <button onClick={handleCreateNewProject} className={styles.createFirstButton}>
                첫 상담 시작하기
              </button>
            </div>
          ) : (
            <div className={styles.projectGrid}>
              {projects.map((project) => (
                <div key={project.id} className={styles.projectCard}>
                  <div className={styles.projectHeader}>
                    {editingProjectId === project.id ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => handleTitleKeyDown(e, project.id)}
                        onBlur={() => handleSaveTitle(project.id)}
                        className={styles.titleInput}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <h3 
                        className={styles.projectTitle}
                        onClick={(e) => handleStartEditTitle(e, project.id, project.title)}
                        title="클릭하여 이름 변경"
                      >
                        {project.title}
                        <span className={styles.editIcon}>✏️</span>
                      </h3>
                    )}
                    <div className={styles.projectActions}>
                      <button 
                        onClick={() => updateProjectStatus(
                          project.id, 
                          project.status === 'paused' ? 'in_progress' : 'paused'
                        )}
                        className={styles.pauseButton}
                        title={project.status === 'paused' ? '재시작' : '일시정지'}
                      >
                        {project.status === 'paused' ? '▶️' : '⏸️'}
                      </button>
                      <button 
                        onClick={() => handleDuplicateProject(project.id, project.title)}
                        className={styles.duplicateButton}
                        title="복사"
                      >
                        📋
                      </button>
                      <button 
                        onClick={() => handleDeleteProject(project.id, project.title)}
                        className={styles.deleteButton}
                        title="삭제"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  
                  <div className={styles.projectInfo}>
                    <div className={styles.projectMeta}>
                      <span className={`${styles.status} ${getStatusClass(project.status)}`}>
                        {getStatusText(project.status)}
                      </span>
                      <span className={styles.format}>{project.format}</span>
                    </div>
                    
                    <div className={styles.progressSection}>
                      <div className={styles.progressInfo}>
                        <span>진행률: {getProjectProgress(project.id)}%</span>
                        <span className={styles.currentStep}>
                          {getStepText(project.currentStep)}
                        </span>
                      </div>
                      <div className={styles.progressBar}>
                        <div 
                          className={styles.progressFill}
                          style={{ width: `${getProjectProgress(project.id)}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className={styles.projectDates}>
                      <span>생성: {new Date(project.createdAt).toLocaleDateString()}</span>
                      <span>수정: {new Date(project.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  <div className={styles.projectFooter}>
                    <button 
                      onClick={() => handleProjectClick(project)}
                      className={styles.continueButton}
                      disabled={project.status === 'paused'}
                    >
                      {project.status === 'completed' ? '보기' : '계속하기'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default MyPage;