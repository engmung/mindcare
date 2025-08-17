/**
 * ProjectStore - Simplified version
 */

import { create } from 'zustand';

export const useProjectStore = create((set, get) => ({
  // 기본 상태
  currentProject: null,
  projects: [],

  // 간단한 로드 메서드
  loadProjects: () => {
    console.log('loadProjects called');
    const savedProjects = localStorage.getItem('autobiography_projects');
    if (savedProjects) {
      try {
        const projects = JSON.parse(savedProjects);
        set({ projects });
      } catch (error) {
        console.error('Error loading projects:', error);
      }
    }
  },

  // 프로젝트 생성
  createProject: (title, format) => {
    const newProject = {
      id: Date.now().toString(),
      title,
      format,
      status: 'in_progress',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentStep: 4,
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

  // 프로젝트 데이터 업데이트
  updateProjectData: (dataUpdates) => {
    const state = get();
    if (!state.currentProject) return;

    const updatedProject = {
      ...state.currentProject,
      data: {
        ...state.currentProject.data,
        ...dataUpdates
      },
      updatedAt: new Date().toISOString()
    };

    const updatedProjects = state.projects.map(p => 
      p.id === updatedProject.id ? updatedProject : p
    );

    localStorage.setItem('autobiography_projects', JSON.stringify(updatedProjects));

    set({
      currentProject: updatedProject,
      projects: updatedProjects
    });
  },

  // 프로젝트 기본 정보 업데이트 (제목, 형식, 주제)
  updateProjectInfo: (projectId, updates) => {
    const state = get();
    const { title, format, topic } = updates;

    const updatedProjects = state.projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          ...(title !== undefined && { title }),
          ...(format !== undefined && { format }),
          data: {
            ...p.data,
            ...(topic !== undefined && { topic })
          },
          updatedAt: new Date().toISOString()
        };
      }
      return p;
    });

    localStorage.setItem('autobiography_projects', JSON.stringify(updatedProjects));

    const updatedCurrentProject = state.currentProject?.id === projectId 
      ? updatedProjects.find(p => p.id === projectId) 
      : state.currentProject;

    set({
      projects: updatedProjects,
      currentProject: updatedCurrentProject
    });

    return updatedProjects.find(p => p.id === projectId);
  },

  // 프로젝트 단계 업데이트
  updateProjectStep: (projectId, step) => {
    const state = get();
    const updatedProjects = state.projects.map(p => 
      p.id === projectId 
        ? { 
            ...p, 
            currentStep: Math.max(p.currentStep || 0, step),
            updatedAt: new Date().toISOString() 
          }
        : p
    );

    localStorage.setItem('autobiography_projects', JSON.stringify(updatedProjects));

    set({
      projects: updatedProjects,
      currentProject: state.currentProject?.id === projectId 
        ? { 
            ...state.currentProject, 
            currentStep: Math.max(state.currentProject.currentStep || 0, step),
            updatedAt: new Date().toISOString() 
          }
        : state.currentProject
    });
  },

  // 프로젝트 삭제
  deleteProject: (projectId) => {
    const state = get();
    const updatedProjects = state.projects.filter(p => p.id !== projectId);
    
    localStorage.setItem('autobiography_projects', JSON.stringify(updatedProjects));

    set({
      projects: updatedProjects,
      currentProject: state.currentProject?.id === projectId ? null : state.currentProject
    });
  },

  // 프로젝트 상태 변경
  updateProjectStatus: (projectId, status) => {
    const state = get();
    const updatedProjects = state.projects.map(p => 
      p.id === projectId 
        ? { ...p, status, updatedAt: new Date().toISOString() }
        : p
    );

    localStorage.setItem('autobiography_projects', JSON.stringify(updatedProjects));

    set({
      projects: updatedProjects,
      currentProject: state.currentProject?.id === projectId 
        ? { ...state.currentProject, status }
        : state.currentProject
    });
  },

  // 진행률 계산
  getProjectProgress: (projectId) => {
    const state = get();
    const project = projectId 
      ? state.projects.find(p => p.id === projectId)
      : state.currentProject;
    
    if (!project) return 0;

    // 간단한 진행률 계산 (currentStep 기반)
    return Math.round((project.currentStep / 12) * 100);
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
  },

  // 프로젝트 복사
  duplicateProject: (projectId) => {
    const state = get();
    const originalProject = state.projects.find(p => p.id === projectId);
    
    if (!originalProject) {
      console.error('복사할 프로젝트를 찾을 수 없습니다.');
      return null;
    }

    // 대화 데이터에 새로운 ID 부여하는 헬퍼 함수
    const generateNewConversationIds = (conversations) => {
      if (!conversations || !Array.isArray(conversations)) return [];
      
      return conversations.map((conv, index) => ({
        ...conv,
        id: `${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}` // 고유한 ID 생성
      }));
    };

    // 복사본 생성
    const duplicatedProject = {
      ...originalProject,
      id: Date.now().toString(),
      title: `${originalProject.title} (복사본)`,
      status: 'in_progress',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data: {
        ...originalProject.data,
        // 설정 대화와 자서전 대화 모두 새로운 ID 부여
        setupConversations: generateNewConversationIds(originalProject.data.setupConversations),
        conversations: generateNewConversationIds(originalProject.data.conversations),
        outline: originalProject.data.outline ? { ...originalProject.data.outline } : null
      }
    };

    const updatedProjects = [...state.projects, duplicatedProject];
    localStorage.setItem('autobiography_projects', JSON.stringify(updatedProjects));

    set({
      projects: updatedProjects
    });


    return duplicatedProject;
  },

  // 프로젝트 이름 변경
  updateProjectTitle: (projectId, newTitle) => {
    const state = get();
    const updatedProjects = state.projects.map(p => 
      p.id === projectId 
        ? { ...p, title: newTitle, updatedAt: new Date().toISOString() }
        : p
    );

    localStorage.setItem('autobiography_projects', JSON.stringify(updatedProjects));

    set({
      projects: updatedProjects,
      currentProject: state.currentProject?.id === projectId 
        ? { ...state.currentProject, title: newTitle, updatedAt: new Date().toISOString() }
        : state.currentProject
    });
  },

  // 목차 저장
  saveOutline: (projectId, outline) => {
    const state = get();
    const updatedProjects = state.projects.map(p => 
      p.id === projectId 
        ? { 
            ...p, 
            data: { ...p.data, outline },
            currentStep: Math.max(p.currentStep, 8), // 초안 생성 준비 단계
            updatedAt: new Date().toISOString() 
          }
        : p
    );

    localStorage.setItem('autobiography_projects', JSON.stringify(updatedProjects));

    set({
      projects: updatedProjects,
      currentProject: state.currentProject?.id === projectId 
        ? { 
            ...state.currentProject, 
            data: { ...state.currentProject.data, outline },
            currentStep: Math.max(state.currentProject.currentStep, 8),
            updatedAt: new Date().toISOString() 
          }
        : state.currentProject
    });
  },

  // 특정 단계로 돌아가면서 이후 단계 데이터 삭제
  resetToStep: async (targetStep) => {
    const state = get();
    if (!state.currentProject) return;


    // 각 단계별로 삭제할 데이터 정의
    const getResetData = (step) => {
      const resetData = { ...state.currentProject.data };
      
      // 6단계(질문 완료) 이후 데이터 삭제
      if (step < 7) {
        delete resetData.outline;
        delete resetData.manuscript;
        delete resetData.selectedStyle;
      }
      // 7단계(목차 완료) 이후 데이터 삭제  
      else if (step < 8) {
        delete resetData.manuscript;
        delete resetData.selectedStyle;
      }
      // 8단계(원고 완료) 이후 데이터 삭제
      else if (step < 10) {
        delete resetData.selectedStyle;
      }

      return resetData;
    };

    const updatedProject = {
      ...state.currentProject,
      currentStep: targetStep,
      data: getResetData(targetStep),
      updatedAt: new Date().toISOString()
    };

    // 프로젝트 목록에서 업데이트
    const updatedProjects = state.projects.map(p => 
      p.id === updatedProject.id ? updatedProject : p
    );

    // Zustand 상태 먼저 업데이트
    set({
      currentProject: updatedProject,
      projects: updatedProjects
    });

    // WriteStore도 함께 업데이트 (중복 방지)
    import('./writeStore.js').then(({ useWriteStore }) => {
      const writeStore = useWriteStore.getState();
      if (writeStore.loadProjectData) {
        writeStore.loadProjectData(updatedProject.data);
      }
    });

    // localStorage에 저장 (비동기 처리)
    try {
      localStorage.setItem('autobiography_projects', JSON.stringify(updatedProjects));
    } catch (error) {
      console.error('ProjectStore - localStorage 저장 실패:', error);
    }


    // 저장 완료를 보장하기 위한 약간의 지연
    return new Promise(resolve => setTimeout(resolve, 100));
  }
}));