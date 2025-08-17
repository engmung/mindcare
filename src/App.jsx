/**
 * App
 * 
 * 용도: 메인 애플리케이션 컴포넌트 - 라우팅 설정
 * 사용처: main.jsx에서 렌더링
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useUserStore } from './stores/userStore';
import { useProjectStore } from './stores/projectStore';

// 레이아웃
import Layout from './components/Layout';

// 페이지 컴포넌트들
import MyPage from './pages/MyPage';
import ProjectCreationPage from './pages/ProjectCreationPage';
import AIQuestionPage from './pages/AIQuestionPage';
import OutlineSelectionPage from './pages/OutlineSelectionPage';
import ManuscriptEditPage from './pages/ManuscriptEditPage';

import './App.css';

function App() {
  const { restoreUserInfo } = useUserStore();
  const { loadProjects } = useProjectStore();

  // 앱 시작 시 프로젝트 데이터 로드
  useEffect(() => {
    restoreUserInfo(); // 선택적 사용자 정보 복원
    loadProjects();
  }, []); // 빈 의존성 배열로 한 번만 실행

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* 메인 페이지 - 바로 프로젝트 관리로 리다이렉트 */}
          <Route index element={<Navigate to="/projects" replace />} />
          
          {/* 프로젝트 관리 (구 MyPage) */}
          <Route path="/projects" element={<MyPage />} />
          <Route path="/project/create" element={<ProjectCreationPage />} />
          <Route path="/project/:projectId/questions" element={<AIQuestionPage />} />
          <Route path="/project/:projectId/outline" element={<OutlineSelectionPage />} />
          <Route path="/outline-selection" element={<OutlineSelectionPage />} />
          <Route path="/manuscript-edit" element={<ManuscriptEditPage />} />
          
          {/* 404 페이지 */}
          <Route path="*" element={
            <div style={{ 
              textAlign: 'center', 
              padding: '2rem',
              color: 'var(--color-text-secondary)' 
            }}>
              <h2>페이지를 찾을 수 없습니다</h2>
              <p>요청하신 페이지가 존재하지 않습니다.</p>
            </div>
          } />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;