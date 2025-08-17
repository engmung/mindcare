/**
 * UserStore
 * 
 * 용도: 심리상담 서비스용 간소화된 사용자 정보 관리
 * 사용처: 프로젝트 생성 시 기본 정보 참조
 */

import { create } from 'zustand';

export const useUserStore = create((set, get) => ({
  // 사용자 기본 정보 (선택적)
  userInfo: {
    nickname: '사용자', // 기본 닉네임
    preferredThemes: [] // 선호 상담 주제
  },

  // 닉네임 업데이트
  updateNickname: (nickname) => set((state) => ({
    userInfo: {
      ...state.userInfo,
      nickname
    }
  })),

  // 선호 테마 추가
  addPreferredTheme: (theme) => set((state) => ({
    userInfo: {
      ...state.userInfo,
      preferredThemes: [...state.userInfo.preferredThemes, theme]
    }
  })),

  // 선호 테마 제거
  removePreferredTheme: (theme) => set((state) => ({
    userInfo: {
      ...state.userInfo,
      preferredThemes: state.userInfo.preferredThemes.filter(t => t !== theme)
    }
  })),

  // 사용자 정보 초기화
  resetUserInfo: () => set({
    userInfo: {
      nickname: '사용자',
      preferredThemes: []
    }
  }),

  // localStorage에서 사용자 정보 복원 (선택적)
  restoreUserInfo: () => {
    const savedInfo = localStorage.getItem('counseling_user_info');
    if (savedInfo) {
      try {
        const parsed = JSON.parse(savedInfo);
        set({ userInfo: parsed });
      } catch (error) {
        console.error('Failed to restore user info:', error);
      }
    }
  },

  // localStorage에 사용자 정보 저장
  saveUserInfo: () => {
    const state = get();
    localStorage.setItem('counseling_user_info', JSON.stringify(state.userInfo));
  }
}));