const STORAGE_KEY = 'autobiography-conversations';
const MINDMAP_STORAGE_KEY = 'autobiography-mindmap';
const OUTLINE_STORAGE_KEY = 'autobiography-outline';
const PHASE_STORAGE_KEY = 'autobiography-phase';
const COMPLETENESS_STORAGE_KEY = 'autobiography-completeness';

export const saveConversations = (conversations) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (error) {
    console.error('대화 저장 실패:', error);
  }
};

export const loadConversations = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('대화 불러오기 실패:', error);
    return [];
  }
};

export const addConversation = (questionData, answer = '') => {
  const conversations = loadConversations();
  
  // Structured output 지원: questionData가 객체인 경우와 문자열인 경우 모두 처리
  const question = typeof questionData === 'object' 
    ? questionData.question || questionData
    : questionData;
    
  const newConversation = {
    id: Date.now().toString(),
    question,
    answer,
    // Structured output의 추가 정보 저장 (있는 경우)
    ...(typeof questionData === 'object' && {
      context: questionData.context,
      expected_info_type: questionData.expected_info_type,
      isDetailQuestion: questionData.isDetailQuestion,
      targetChapter: questionData.targetChapter
    })
  };
  
  conversations.push(newConversation);
  saveConversations(conversations);
  return newConversation;
};

export const updateAnswer = (id, answer) => {
  const conversations = loadConversations();
  const conversation = conversations.find(c => c.id === id);
  if (conversation) {
    conversation.answer = answer;
    saveConversations(conversations);
  }
  return conversation;
};

export const deleteConversation = (id) => {
  try {
    const conversations = loadConversations();
    const filteredConversations = conversations.filter(conv => conv.id !== id);
    saveConversations(filteredConversations);
    return filteredConversations;
  } catch (error) {
    console.error('대화 삭제 실패:', error);
    return loadConversations();
  }
};

export const clearConversations = () => {
  localStorage.removeItem(STORAGE_KEY);
};

// 마인드맵 데이터 관리
export const saveMindmapData = (mindmapData) => {
  try {
    localStorage.setItem(MINDMAP_STORAGE_KEY, JSON.stringify(mindmapData));
  } catch (error) {
    console.error('마인드맵 데이터 저장 실패:', error);
  }
};

export const loadMindmapData = () => {
  try {
    const data = localStorage.getItem(MINDMAP_STORAGE_KEY);
    return data ? JSON.parse(data) : {
      keywords: [],
      emotions: [],
      people: [],
      connections: [],
      timeframe: {}
    };
  } catch (error) {
    console.error('마인드맵 데이터 불러오기 실패:', error);
    return {
      keywords: [],
      emotions: [],
      people: [],
      connections: [],
      timeframe: {}
    };
  }
};

export const updateMindmapData = (newData) => {
  const currentData = loadMindmapData();
  
  // 기존 데이터와 새 데이터 병합
  const mergedData = {
    keywords: [...currentData.keywords, ...newData.keywords],
    emotions: [...currentData.emotions, ...newData.emotions],
    people: [...currentData.people, ...newData.people],
    connections: [...currentData.connections, ...newData.connections],
    timeframe: { ...currentData.timeframe, ...newData.timeframe }
  };
  
  // 중복 키워드 제거 (content 기준)
  const uniqueKeywords = [];
  const keywordContents = new Set();
  mergedData.keywords.forEach(keyword => {
    if (!keywordContents.has(keyword.content.toLowerCase())) {
      keywordContents.add(keyword.content.toLowerCase());
      uniqueKeywords.push(keyword);
    }
  });
  mergedData.keywords = uniqueKeywords;
  
  // 중복 사람 제거 (name 기준)
  const uniquePeople = [];
  const peopleNames = new Set();
  mergedData.people.forEach(person => {
    if (!peopleNames.has(person.name.toLowerCase())) {
      peopleNames.add(person.name.toLowerCase());
      uniquePeople.push(person);
    }
  });
  mergedData.people = uniquePeople;
  
  saveMindmapData(mergedData);
  return mergedData;
};

// 개요 데이터 관리
export const saveOutlineData = (outlineData) => {
  try {
    localStorage.setItem(OUTLINE_STORAGE_KEY, JSON.stringify(outlineData));
  } catch (error) {
    console.error('개요 데이터 저장 실패:', error);
  }
};

export const loadOutlineData = () => {
  try {
    const data = localStorage.getItem(OUTLINE_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('개요 데이터 불러오기 실패:', error);
    return null;
  }
};

export const deleteOutlineData = () => {
  try {
    localStorage.removeItem(OUTLINE_STORAGE_KEY);
  } catch (error) {
    console.error('개요 데이터 삭제 실패:', error);
  }
};

// 단계 관리
export const getCurrentPhase = () => {
  try {
    const phase = localStorage.getItem(PHASE_STORAGE_KEY);
    return phase ? parseInt(phase) : 1;
  } catch (error) {
    console.error('단계 정보 불러오기 실패:', error);
    return 1;
  }
};

export const setCurrentPhase = (phase) => {
  try {
    localStorage.setItem(PHASE_STORAGE_KEY, phase.toString());
  } catch (error) {
    console.error('단계 정보 저장 실패:', error);
  }
};

// 전체 데이터 통합 조회
export const loadAllData = () => {
  return {
    conversations: loadConversations(),
    mindmap: loadMindmapData(),
    outline: loadOutlineData(),
    phase: getCurrentPhase()
  };
};

// 완성도 분석 데이터 관리
export const saveCompletenessAnalysis = (analysisData) => {
  try {
    localStorage.setItem(COMPLETENESS_STORAGE_KEY, JSON.stringify(analysisData));
  } catch (error) {
    console.error('완성도 분석 데이터 저장 실패:', error);
  }
};

export const loadCompletenessAnalysis = () => {
  try {
    const data = localStorage.getItem(COMPLETENESS_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('완성도 분석 데이터 불러오기 실패:', error);
    return null;
  }
};

export const deleteCompletenessAnalysis = () => {
  try {
    localStorage.removeItem(COMPLETENESS_STORAGE_KEY);
  } catch (error) {
    console.error('완성도 분석 데이터 삭제 실패:', error);
  }
};

// QA 쌍 관리 (QAManager로 위임)
import QAManager from './QAManager.js';

export { QAManager };

// 전체 데이터 초기화
export const clearAllData = () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(MINDMAP_STORAGE_KEY);
  localStorage.removeItem(OUTLINE_STORAGE_KEY);
  localStorage.removeItem(PHASE_STORAGE_KEY);
  localStorage.removeItem(COMPLETENESS_STORAGE_KEY);
  
  // QA 쌍 데이터도 초기화
  QAManager.clearAllQAPairs();
};