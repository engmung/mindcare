export const loadPrompt = async (filename) => {
  try {
    const response = await fetch(`/prompts/${filename}`);
    if (!response.ok) {
      throw new Error(`프롬프트 파일을 찾을 수 없습니다: ${filename}`);
    }
    const text = await response.text();
    console.log(`프롬프트 로드 성공: ${filename}`, text.substring(0, 100) + '...');
    return text;
  } catch (error) {
    console.error('프롬프트 로딩 실패:', error);
    return null;
  }
};

export const loadPromptWithTemplate = async (filename, variables = {}) => {
  const template = await loadPrompt(filename);
  if (!template) return null;
  
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value);
  });
  
  return result;
};