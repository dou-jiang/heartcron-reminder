/**
 * 变量渲染：把模板中的 {{变量名}} 替换为实际内容
 */

/**
 * 渲染模板字符串
 * @param {string} template 含 {{变量}} 的模板
 * @param {Object} data 变量表
 * @returns {string}
 */
function renderPromptTemplate(template, data = {}) {
  return String(template || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    const value = data[key];
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

module.exports = { renderPromptTemplate };
