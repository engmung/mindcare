/**
 * ProjectSettingsModal
 * 
 * 용도: 프로젝트 정보 수정 모달
 * 사용처: AI 질문 페이지, 마이페이지에서 프로젝트 설정 변경 시 사용
 * props: isOpen, onClose, onSave, currentProject
 */

import { useState, useEffect } from 'react';
import styles from './ProjectSettingsModal.module.css';

const ProjectSettingsModal = ({ isOpen, onClose, onSave, currentProject }) => {
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [format, setFormat] = useState('');
  const [errors, setErrors] = useState({});

  // 형식 목록
  const formats = [
    {
      id: 'free',
      name: '자유형',
      description: '특정 형식에 얽매이지 않고 자연스럽게 이야기를 풀어나가는 방식',
      icon: '🌟'
    },
    {
      id: 'chronological',
      name: '연대기순',
      description: '시간 순서대로 인생의 주요 사건들을 기록하는 전통적인 자서전 형식',
      icon: '📅'
    },
    {
      id: 'essay',
      name: '에세이형',
      description: '주제별로 나누어 개인적인 경험과 생각을 깊이 있게 다루는 형식',
      icon: '✍️'
    },
    {
      id: 'memoir',
      name: '회고록형',
      description: '인생의 특별한 순간들과 중요한 사건들을 중심으로 한 기억 중심의 형식',
      icon: '💭'
    },
    {
      id: 'interview',
      name: '인터뷰형',
      description: '질문과 답변 형식으로 구성되어 독자와의 대화하는 듯한 친근한 형식',
      icon: '💬'
    }
  ];

  // 프로젝트 정보로 초기화
  useEffect(() => {
    if (currentProject) {
      // 프로젝트 제목을 직접 사용 (프로젝트 제목 = 자서전 제목)
      setTitle(currentProject.title || '');
      setTopic(currentProject.data?.topic || '');
      setFormat(currentProject.format || '');
      setErrors({});
    }
  }, [currentProject, isOpen]);

  const validateForm = () => {
    const newErrors = {};

    if (!title.trim()) {
      newErrors.title = '프로젝트 제목을 입력해주세요.';
    } else if (title.trim().length < 2) {
      newErrors.title = '제목은 2자 이상 입력해주세요.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    const updatedData = {
      title: title.trim(), // 프로젝트 제목 = 자서전 제목
      topic: topic.trim() || '나의 인생 이야기',
      format: format || 'free'
    };

    onSave(updatedData);
    onClose();
  };

  const handleCancel = () => {
    // 원래 값으로 복원
    if (currentProject) {
      setTitle(currentProject.title || '');
      setTopic(currentProject.data?.topic || '');
      setFormat(currentProject.format || '');
    }
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleCancel}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>프로젝트 설정 변경</h2>
          <button className={styles.closeButton} onClick={handleCancel}>
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* 제목 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              프로젝트 제목 <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) {
                  setErrors(prev => ({ ...prev, title: '' }));
                }
              }}
              className={`${styles.input} ${errors.title ? styles.error : ''}`}
              placeholder="예: 나의 인생 이야기, 꿈을 향한 여정"
              maxLength={50}
            />
            {errors.title && <span className={styles.errorText}>{errors.title}</span>}
          </div>

          {/* 주제 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>주제</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className={styles.textarea}
              placeholder="어떤 이야기를 담고 싶으신가요? (기본값: '나의 인생 이야기')"
              rows={3}
              maxLength={500}
            />
            <div className={styles.hint}>
              {topic.length}/500자 - 비워두면 '나의 인생 이야기'로 설정됩니다.
            </div>
          </div>

          {/* 형식 선택 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>자서전 형식</label>
            <div className={styles.formatList}>
              {formats.map((formatOption) => (
                <div
                  key={formatOption.id}
                  className={`${styles.formatOption} ${
                    format === formatOption.id ? styles.selected : ''
                  }`}
                  onClick={() => setFormat(formatOption.id)}
                >
                  <div className={styles.formatHeader}>
                    <span className={styles.formatIcon}>{formatOption.icon}</span>
                    <span className={styles.formatName}>{formatOption.name}</span>
                    {formatOption.id === 'free' && <span className={styles.defaultBadge}>기본값</span>}
                  </div>
                  <p className={styles.formatDescription}>{formatOption.description}</p>
                </div>
              ))}
            </div>
            <div className={styles.hint}>
              선택하지 않으면 자유형으로 설정됩니다.
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button
            onClick={handleCancel}
            className={styles.cancelButton}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className={styles.saveButton}
            disabled={!title.trim()}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectSettingsModal;