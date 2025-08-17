/**
 * ProjectStore
 * 
 * 용도: 자서전 프로젝트 관리 상태
 * 사용처: 마이페이지, 프로젝트 생성, 프로젝트 진행 상황 관리
 */

import { create } from 'zustand';

export const useProjectStore = create((set, get) => ({
  // 현재 진행 중인 프로젝트 정보
  currentProject: null,
  
  // 모든 프로젝트 목록
  projects: [],

  // 프로젝트 생성 - title: 프로젝트 제목, format: 선택한 형식
  createProject: (title, format) => {
    const newProject = {
      id: Date.now().toString(),
      title,
      format, // 연대기순/에세이형/회고록형/인터뷰형
      status: 'in_progress', // in_progress, completed, paused
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      
      // 진행 단계 (1-12)
      currentStep: 4, // 주제 입력 및 형식 선택 완료 후 시작
      
      // 각 단계별 완료 상태
      steps: {
        signup: true,           // 1. 회원가입
        mypage: true,           // 2. 마이페이지
        projectCreation: true,  // 3. 프로젝트 생성
        topicAndFormat: true,   // 4. 주제 입력 및 형식 선택
        aiQuestion: false,      // 5. AI 질문
        writingComplete: false, // 6. 글쓰기 완료
        outlineOptions: false,  // 7. 목차 시안 제공
        draftGeneration: false, // 8. 초안 생성
        detailEditing: false,   // 9. 내용 세부 수정
        styleSelection: false,  // 10. 문체 선택
        bookComplete: false,    // 11. 책 완성
        backToMypage: false     // 12. 마이페이지로 돌아가기
      },
      
      // 프로젝트 관련 데이터
      data: {
        topic: '',
        conversations: [],
        outline: null,
        manuscript: '',
        selectedStyle: null
      }
    };

    set((state) => {
      const updatedProjects = [...state.projects, newProject];
      
      // localStorage에 저장
      localStorage.setItem('autobiography_projects', JSON.stringify(updatedProjects));
      
      return {
        projects: updatedProjects,
        currentProject: newProject
      };
    });

    return newProject;
  },

  // 프로젝트 선택
  selectProject: (projectId) => {
    const state = get();
    const project = state.projects.find(p => p.id === projectId);
    if (project) {
      set({ currentProject: project });
    }
  },

  // 현재 프로젝트 업데이트
  updateCurrentProject: (updates) => set((state) => {
    if (!state.currentProject) return state;

    const updatedProject = {
      ...state.currentProject,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const updatedProjects = state.projects.map(p => 
      p.id === updatedProject.id ? updatedProject : p
    );

    // localStorage에 저장
    localStorage.setItem('autobiography_projects', JSON.stringify(updatedProjects));

    return {
      currentProject: updatedProject,
      projects: updatedProjects
    };
  }),

  // 프로젝트 단계 완료 처리
  completeStep: (stepName) => set((state) => {
    if (!state.currentProject) return state;

    const updatedSteps = {
      ...state.currentProject.steps,
      [stepName]: true
    };

    // 다음 단계 계산
    const stepOrder = [
      'signup', 'mypage', 'projectCreation', 'topicAndFormat',
      'aiQuestion', 'writingComplete', 'outlineOptions', 'draftGeneration',
      'detailEditing', 'styleSelection', 'bookComplete', 'backToMypage'
    ];
    
    const completedSteps = stepOrder.filter(step => updatedSteps[step]).length;
    const nextStep = Math.min(completedSteps + 1, 12);

    return get().updateCurrentProject({
      steps: updatedSteps,
      currentStep: nextStep
    });
  }),

  // 프로젝트 데이터 업데이트
  updateProjectData: (dataUpdates) => set((state) => {
    if (!state.currentProject) return state;

    const updatedData = {
      ...state.currentProject.data,
      ...dataUpdates
    };

    return get().updateCurrentProject({
      data: updatedData
    });
  }),

  // 대화 추가
  addConversation: (conversation) => set((state) => {
    if (!state.currentProject) return state;

    const updatedConversations = [
      ...state.currentProject.data.conversations,
      {
        ...conversation,
        id: Date.now().toString(),
        timestamp: new Date().toISOString()
      }
    ];

    return get().updateProjectData({
      conversations: updatedConversations
    });
  }),

  // 대화 삭제
  removeConversation: (conversationId) => set((state) => {
    if (!state.currentProject) return state;

    const updatedConversations = state.currentProject.data.conversations.filter(
      conv => conv.id !== conversationId
    );

    return get().updateProjectData({
      conversations: updatedConversations
    });
  }),

  // 프로젝트 삭제
  deleteProject: (projectId) => set((state) => {
    const updatedProjects = state.projects.filter(p => p.id !== projectId);
    
    // localStorage 업데이트
    localStorage.setItem('autobiography_projects', JSON.stringify(updatedProjects));

    return {
      projects: updatedProjects,
      currentProject: state.currentProject?.id === projectId ? null : state.currentProject
    };
  }),

  // 프로젝트 상태 변경
  updateProjectStatus: (projectId, status) => set((state) => {
    const updatedProjects = state.projects.map(p => 
      p.id === projectId 
        ? { ...p, status, updatedAt: new Date().toISOString() }
        : p
    );

    // localStorage 업데이트
    localStorage.setItem('autobiography_projects', JSON.stringify(updatedProjects));

    return {
      projects: updatedProjects,
      currentProject: state.currentProject?.id === projectId 
        ? { ...state.currentProject, status }
        : state.currentProject
    };
  }),

  // 프로젝트 목록 로드 (앱 시작 시)
  loadProjects: () => {
    const savedProjects = localStorage.getItem('autobiography_projects');
    if (savedProjects) {
      const projects = JSON.parse(savedProjects);
      set({ projects });
    }
  },

  // 현재 프로젝트 초기화
  clearCurrentProject: () => set({
    currentProject: null
  }),

  // 진행률 계산
  getProjectProgress: (projectId) => {
    const state = get();
    const project = projectId 
      ? state.projects.find(p => p.id === projectId)
      : state.currentProject;
    
    if (!project) return 0;

    const completedSteps = Object.values(project.steps).filter(Boolean).length;
    return Math.round((completedSteps / 12) * 100);
  },

  // 프로젝트 통계
  getProjectStats: () => {
    const state = get();
    return {
      total: state.projects.length,
      inProgress: state.projects.filter(p => p.status === 'in_progress').length,
      completed: state.projects.filter(p => p.status === 'completed').length,
      paused: state.projects.filter(p => p.status === 'paused').length
    };
  }
}));