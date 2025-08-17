# MindCare - AI 심리상담 챗봇

AI 기반 심리상담 서비스로, 사용자의 마음을 편안하게 들어주고 공감하는 대화형 챗봇입니다.

## 주요 기능

- 🤖 AI 기반 공감형 대화
- 🎤 음성 입력 지원 (HTTPS 환경)
- 💬 실시간 채팅 인터페이스
- 📱 모바일 반응형 디자인
- 🔐 개인정보 보호 (로컬 저장)

## 기술 스택

- **Frontend**: React 19, Vite
- **State Management**: Zustand
- **AI**: Google Gemini API, OpenAI Whisper API
- **Styling**: CSS Modules

## 설치 및 실행

### 1. 저장소 클론
```bash
git clone https://github.com/engmung/mindcare.git
cd mindcare
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경변수 설정
`.env` 파일을 생성하고 다음 내용을 추가:
```
VITE_GEMINI_API_KEY=your-gemini-api-key
VITE_OPENAI_API_KEY=your-openai-api-key
VITE_ENV=development
```

### 4. 개발 서버 실행
```bash
npm run dev
```

### 5. 프로덕션 빌드
```bash
npm run build
```

## 라즈베리파이 배포

라즈베리파이에서 HTTPS로 서비스하는 경우:

1. Let's Encrypt 인증서 설치
2. `vite.config.js`에서 인증서 경로 확인
3. 서버 실행

## 음성 입력 기능

음성 입력 기능은 HTTPS 환경에서만 작동합니다:
- 로컬 개발: `http://localhost:5177`
- 프로덕션: HTTPS 인증서가 설치된 서버

## 라이선스

MIT License
