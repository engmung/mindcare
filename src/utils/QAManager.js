const QA_STORAGE_KEY = 'autobiography_qa_pairs';

export class QAManager {
  // QA 쌍 저장
  static saveQAPair(qaPair) {
    try {
      const qaPairs = this.loadAllQAPairs();
      qaPairs[qaPair.id] = {
        ...qaPair,
        updatedAt: Date.now()
      };
      localStorage.setItem(QA_STORAGE_KEY, JSON.stringify(qaPairs));
      return qaPair;
    } catch (error) {
      console.error('QA 쌍 저장 실패:', error);
      return null;
    }
  }

  // 모든 QA 쌍 로드
  static loadAllQAPairs() {
    try {
      const data = localStorage.getItem(QA_STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('QA 쌍 로드 실패:', error);
      return {};
    }
  }

  // 특정 QA 쌍 로드
  static loadQAPair(id) {
    const qaPairs = this.loadAllQAPairs();
    return qaPairs[id] || null;
  }

  // QA 쌍 생성
  static createQAPair(selectedText, textPosition, question, targetChapter = null) {
    const id = `qa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const qaPair = {
      id,
      type: 'question', // 'question' or 'direct_edit'
      selectedText,
      textPosition,
      question,
      answer: '',
      status: 'pending', // pending, answered, applied
      targetChapter,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    return this.saveQAPair(qaPair);
  }

  // 직접 수정 생성
  static createDirectEdit(selectedText, textPosition, editRequest, improvedText, targetChapter = null) {
    const id = `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const editPair = {
      id,
      type: 'direct_edit',
      selectedText,
      textPosition,
      editRequest,
      improvedText,
      status: 'ready', // ready, applied
      targetChapter,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    return this.saveQAPair(editPair);
  }

  // 답변 업데이트
  static updateAnswer(id, answer) {
    try {
      const qaPairs = this.loadAllQAPairs();
      if (qaPairs[id]) {
        qaPairs[id].answer = answer;
        qaPairs[id].status = answer.trim() ? 'answered' : 'pending';
        qaPairs[id].updatedAt = Date.now();
        localStorage.setItem(QA_STORAGE_KEY, JSON.stringify(qaPairs));
        return qaPairs[id];
      }
      return null;
    } catch (error) {
      console.error('답변 업데이트 실패:', error);
      return null;
    }
  }

  // QA 쌍 삭제
  static deleteQAPair(id) {
    try {
      const qaPairs = this.loadAllQAPairs();
      delete qaPairs[id];
      localStorage.setItem(QA_STORAGE_KEY, JSON.stringify(qaPairs));
      return true;
    } catch (error) {
      console.error('QA 쌍 삭제 실패:', error);
      return false;
    }
  }

  // 상태별 QA 쌍 조회
  static getQAPairsByStatus(status) {
    const qaPairs = this.loadAllQAPairs();
    return Object.values(qaPairs).filter(qa => qa.status === status);
  }

  // 답변 완료된 QA 쌍들 조회
  static getAnsweredQAPairs() {
    return this.getQAPairsByStatus('answered');
  }

  // 대기 중인 QA 쌍들 조회  
  static getPendingQAPairs() {
    return this.getQAPairsByStatus('pending');
  }

  // QA 쌍 상태 변경
  static updateStatus(id, status) {
    try {
      const qaPairs = this.loadAllQAPairs();
      if (qaPairs[id]) {
        qaPairs[id].status = status;
        qaPairs[id].updatedAt = Date.now();
        localStorage.setItem(QA_STORAGE_KEY, JSON.stringify(qaPairs));
        return qaPairs[id];
      }
      return null;
    } catch (error) {
      console.error('상태 업데이트 실패:', error);
      return null;
    }
  }

  // 텍스트 위치를 기반으로 원고에서 QA 찾기
  static findQAAtPosition(position) {
    const qaPairs = this.loadAllQAPairs();
    return Object.values(qaPairs).find(qa => 
      qa.textPosition.start <= position && position <= qa.textPosition.end
    );
  }

  // 원고 내 모든 하이라이트 위치 정보 반환
  static getAllHighlightPositions() {
    const qaPairs = this.loadAllQAPairs();
    return Object.values(qaPairs)
      .sort((a, b) => a.textPosition.start - b.textPosition.start)
      .map(qa => ({
        id: qa.id,
        type: qa.type,
        start: qa.textPosition.start,
        end: qa.textPosition.end,
        status: qa.status
      }));
  }

  // 통계 정보
  static getStatistics() {
    const qaPairs = this.loadAllQAPairs();
    const all = Object.values(qaPairs);
    
    return {
      total: all.length,
      pending: all.filter(qa => qa.status === 'pending').length,
      answered: all.filter(qa => qa.status === 'answered').length,
      applied: all.filter(qa => qa.status === 'applied').length
    };
  }

  // 모든 QA 쌍 초기화
  static clearAllQAPairs() {
    try {
      localStorage.removeItem(QA_STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('QA 쌍 초기화 실패:', error);
      return false;
    }
  }

  // QA 쌍들을 원고에 적용 가능한 형태로 변환
  static prepareForBatchUpdate() {
    const answeredQAs = this.getAnsweredQAPairs();
    
    // 위치순으로 정렬 (뒤에서부터 적용하기 위해 역순)
    return answeredQAs.sort((a, b) => b.textPosition.start - a.textPosition.start);
  }
}

export default QAManager;