/**
 * Header
 * 
 * 용도: 애플리케이션 상단 헤더 (심리상담 서비스)
 * 사용처: Layout 컴포넌트 내부
 */

import { Link } from 'react-router-dom';
import { useState } from 'react';
import styles from './Header.module.css';

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link to="/projects" className={styles.logo}>
          <h1>AI 심리상담</h1>
        </Link>
        
        {/* 모바일 햄버거 메뉴 버튼 */}
        <button 
          className={styles.mobileMenuButton}
          onClick={toggleMobileMenu}
          aria-label="메뉴"
        >
          <span className={styles.hamburger}></span>
          <span className={styles.hamburger}></span>
          <span className={styles.hamburger}></span>
        </button>
        
        {/* 데스크탑 네비게이션 */}
        <nav className={`${styles.nav} ${isMobileMenuOpen ? styles.mobileOpen : ''}`}>
          <div className={styles.navSection}>
            <Link to="/projects" className={styles.navLink} onClick={() => setIsMobileMenuOpen(false)}>
              상담 목록
            </Link>
            <Link to="/project/create" className={styles.navLink} onClick={() => setIsMobileMenuOpen(false)}>
              새 상담 시작
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Header;