import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

// HTTPS 설정 함수 - 인증서가 있을 때만 활성화
function getHttpsConfig() {
  try {
    // 라즈베리파이 환경 (인증서 존재)
    if (fs.existsSync('/etc/letsencrypt/live/aengmung.tplinkdns.com/privkey.pem')) {
      return {
        key: fs.readFileSync('/etc/letsencrypt/live/aengmung.tplinkdns.com/privkey.pem'),
        cert: fs.readFileSync('/etc/letsencrypt/live/aengmung.tplinkdns.com/fullchain.pem')
      }
    }
  } catch (error) {
    console.log('SSL 인증서를 찾을 수 없습니다. HTTP 모드로 실행합니다.');
  }
  
  // 로컬 개발 환경 - HTTPS 비활성화
  return false;
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // 모든 네트워크 인터페이스에서 접근 가능
    port: 5177,
    strictPort: true, // 포트가 사용 중이면 에러 발생
    // 환경에 따른 HTTPS 설정
    https: getHttpsConfig(),
    // 명시적으로 허용할 호스트 목록
    allowedHosts: [
      'localhost',
      'aengmung.tplinkdns.com'
    ]
  }
})
