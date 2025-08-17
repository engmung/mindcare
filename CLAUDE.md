# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 황금률

요청받지 않은 기능을 구현하지 말 것. 항상 현재 요구사항에만 집중할 것.

## 프로젝트 컨텍스트

AI 자서전 서비스는 사용자가 단계별 프로세스를 통해 자신의 자서전을 작성할 수 있도록 돕는 React 기반 웹 애플리케이션입니다.

## 기술 스택
- **Core**: Vite + React 19 + Zustand 5
- **스타일링**: CSS Modules + CSS 변수 시스템
- **AI**: Google Generative AI (@google/genai), Claude API (@anthropic-ai/sdk)
- **데이터 저장**: localStorage (개발용)
- **라우팅**: React Router v7

## 개발 명령어

```bash
# 개발 서버 실행 (포트 5177)
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 미리보기
npm run preview

# ESLint 실행
npm run lint

# 의존성 설치
npm install
```

## 환경변수 설정

`.env` 파일에 다음 변수들이 필요합니다:
```bash
VITE_GEMINI_API_KEY=your-gemini-api-key
VITE_CLAUDE_API_KEY=your-claude-api-key
VITE_ENV=development
```

## 중요한 아키텍처 결정들

### 왜 Vite + React 19인가?
- 빠른 개발 환경과 HMR 지원
- 최신 React 기능 활용 가능
- 간단한 설정으로 빠른 프로토타이핑

### 왜 Zustand인가?
- Redux보다 단순한 API
- TypeScript 지원 우수
- 보일러플레이트 코드 최소화
- React 19과의 호환성

### 왜 CSS Modules인가?
- 스타일 격리로 디자인 변경 용이
- 클래스명 충돌 방지
- 피그마 디자인 적용 시 수정 최소화

### 왜 기존 AI 에이전트 재활용인가?
- 검증된 코드 활용
- 개발 시간 단축
- 일관된 AI 응답 품질

## 코드 스타일 및 패턴

### 컴포넌트 규칙
- 함수형 컴포넌트와 React Hooks 사용
- 컴포넌트는 PascalCase, 파일명도 동일
- props는 구조 분해 할당으로 받기
- 각 컴포넌트 상단에 용도 주석 작성

### 컴포넌트 주석 형식
```javascript
/**
 * ComponentName
 * 
 * 용도: 이 컴포넌트의 주요 목적
 * 사용처: 어디서 사용되는지
 * props: 받는 props 설명
 */
```

### 상태 관리 주석
```javascript
const useProjectStore = create((set) => ({
  // 현재 진행 중인 프로젝트 정보
  currentProject: null,
  
  // 프로젝트 생성 - title: 프로젝트 제목, format: 선택한 형식
  createProject: (title, format) => { /* ... */ }
}));
```

### AI 에이전트 주석
```javascript
// AGENT-NOTE: 이 메서드는 3개의 목차 시안을 생성하도록 수정됨
// AGENT-TODO: 추후 사용자 선호도 학습 기능 추가 예정
// AGENT-IMPORTANT: 프롬프트 수정 시 반드시 테스트 필요
```

## 파일 구조 및 패턴

```
src/
├── pages/          # 워크플로우 단계별 페이지
├── components/     # 재사용 컴포넌트
├── agents/         # AI 에이전트 (수정 최소화)
├── stores/         # Zustand 스토어
├── styles/         # 전역 스타일, CSS 변수
├── utils/          # 순수 유틸리티 함수
└── services/       # 외부 서비스 통신
```

### 디렉토리별 규칙
- **pages/**: 각 워크플로우 단계별 페이지 컴포넌트
- **components/**: 2곳 이상에서 사용되는 재사용 컴포넌트만
- **agents/**: 기존 에이전트 인터페이스 변경 금지, 확장만 허용
- **stores/**: 전역 상태만 관리, 로컬 상태는 컴포넌트에
- **styles/**: CSS 변수와 전역 리셋만, 컴포넌트 스타일은 CSS Modules로

## AI 에이전트 확장 규칙

### 기존 에이전트 수정 시
- 기존 메서드의 시그니처 변경 금지
- 새로운 기능은 별도 메서드로 추가
- 프롬프트는 public/prompts/에 별도 파일로 관리
- 에이전트 간 의존성 최소화

### 프롬프트 관리
```
public/prompts/
├── autobiography-question-generator.md  # 자서전 질문 생성
├── manuscript-question-generator.md     # 원고 기반 질문
├── manuscript-writer.md                 # 원고 작성
├── orchestrator-analysis.md            # 질문 오케스트레이션
├── outline-generator.md                # 목차 생성
├── outline-refiner.md                  # 목차 개선
├── partial-edit.md                     # 부분 수정
└── topic-transition.md                 # 주제 전환 감지
```

## 개발 가이드라인

### 반드시 할 것
- 요청받은 기능만 정확히 구현
- 각 단계별로 명확한 구분
- 재사용 가능한 컴포넌트 작성
- 디자인 변경을 고려한 유연한 구조
- 모든 컴포넌트에 용도 주석 작성

### 절대 하지 말 것
- 요청하지 않은 최적화 시도
- 기존 에이전트의 핵심 로직 변경
- 복잡한 상태 관리 패턴 도입
- 미래 기능을 위한 과도한 추상화
- 인라인 스타일 사용 (디자인 변경 어려움)
- useEffect 내 직접적인 API 호출
- 전역 CSS 수정 (CSS 변수만 사용)
- AI 에이전트 내부에 UI 로직 포함

### 불확실할 때
- 구현 전 명확히 질문
- 기존 코드 패턴 따르기
- 단순한 해결책 우선
- 주석으로 의도 명확히 표현

## CSS 변수 시스템

모든 디자인 토큰은 CSS 변수로 관리:
```css
:root {
  /* 색상 - 피그마에서 쉽게 변경 가능 */
  --color-primary: #007bff;
  --color-secondary: #6c757d;
  
  /* 간격 - 일관된 spacing 시스템 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  
  /* 타이포그래피 */
  --font-family: 'Pretendard', sans-serif;
  --font-size-base: 16px;
  
  /* 기타 */
  --border-radius: 4px;
  --transition: all 0.3s ease;
}
```

## 메인 워크플로우 단계

1. 회원가입 (계정정보 + 자서전 기본정보)
2. 마이페이지
3. 프로젝트 생성
4. 주제 입력 및 형식 선택
5. AI 질문
6. 글쓰기 완료
7. 목차 시안 제공 (3개, 통합 메뉴얼 사용)
8. 초안 생성
9. 내용 세부 수정
10. 문체 선택
11. 책 완성
12. 마이페이지로 돌아가기

## 주요 라우트 구조

```
/                               # 홈페이지
/login                          # 로그인
/signup                         # 회원가입
/mypage                         # 마이페이지 (로그인 필요)
/project/create                 # 프로젝트 생성 (로그인 필요)
/project/:projectId/questions   # AI 질문 페이지 (로그인 필요)
/project/:projectId/outline     # 목차 선택 페이지
/outline-selection              # 목차 선택 (legacy)
/manuscript-edit                # 원고 편집
```

## 중요 아키텍처 구성요소

### Zustand 스토어 구조

1. **userStore**: 사용자 인증 및 프로필 정보
   - accountInfo: 계정 정보 (name, birthDate, gender, email 등)
   - autobiographyInfo: 자서전 기본 정보 (birthPlace, education, family 등)
   - isLoggedIn, currentUser: 인증 상태
   - login/logout/signup 메서드

2. **projectStore**: 프로젝트 관리
   - currentProject: 현재 작업 중인 프로젝트
   - projects: 모든 프로젝트 목록
   - createProject, updateProjectData 등 CRUD 메서드
   - 진행률 계산 및 통계 기능

3. **manuscriptStore**: 원고 관리
   - manuscript: 현재 원고 데이터
   - outlines: 생성된 목차 시안들
   - selectedOutline: 선택된 목차

4. **writeStore**: 글쓰기 관련 상태 (필요시 확장)

### AI 에이전트 아키텍처

- **QuestionAgent**: 사용자 정보 기반 질문 생성
- **DetailQuestionAgent**: 목차 기반 상세 질문
- **ManuscriptQuestionAgent**: 원고 작성용 질문
- **QuestionOrchestrator**: 질문 흐름 관리
- **TopicTransitionAgent**: 주제 전환 감지
- **OutlineAgent**: 3개의 목차 시안 생성
- **ManuscriptAgent**: 원고 생성
- **PartialEditAgent**: 부분 수정
- **OrganizationAgent**: 목차 정리
- **BatchUpdateAgent**: 일괄 업데이트
- **CompletenessAnalysisAgent**: 완성도 분석
- **StyleAgent**: 문체 변경

### API 서비스 레이어

1. **geminiService.js**: Gemini API 통합
   - Structured Output을 위한 스키마 정의
   - 재시도 로직 및 에러 핸들링
   - 프롬프트는 `public/prompts/` 디렉토리에서 로드

2. **claudeService.js**: Claude API 통합
   - Anthropic SDK 사용
   - 고급 텍스트 생성 및 분석

### 유틸리티

- **promptLoader.js**: 프롬프트 파일 로드
- **dataManager.js**: localStorage 데이터 관리
- **QAManager.js**: Q&A 세션 관리

## 서버 설정

Vite 개발 서버는 다음 설정을 사용합니다:
- 포트: 5177
- 호스트: 0.0.0.0 (모든 네트워크 인터페이스)
- 허용된 호스트: localhost, aengmung.tplinkdns.com

## 확장 예정 기능 (구현하지 말 것)

- AI 질문 고도화 (답변 분량 분석, 주제 전환 감지 등)
- 문체 전체 적용 (청크 단위 처리)
- e-book 생성 및 이메일 전송
- 완성도 분석 에이전트

**기억하세요**: 명시적 요청 없이는 새로운 기능을 추가하지 않습니다. 현재 단계의 요구사항에만 집중하세요.