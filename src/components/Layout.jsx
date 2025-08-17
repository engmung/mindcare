/**
 * Layout
 * 
 * 용도: 전체 애플리케이션의 기본 레이아웃 구조
 * 사용처: 모든 페이지의 공통 레이아웃
 * props: children - 렌더링할 페이지 컴포넌트
 */

import { Outlet } from 'react-router-dom';
import Header from './Header';
import styles from './Layout.module.css';

const Layout = () => {
  return (
    <div className={styles.layout}>
      <Header />
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;