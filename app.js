const STORAGE_KEY = 'link-jump-v1';

const elements = {
  input: document.querySelector('#links-input'),
  saveLinks: document.querySelector('#save-links'),
  clearLinks: document.querySelector('#clear-links'),
  saveState: document.querySelector('#save-state'),
  inputError: document.querySelector('#input-error'),
  currentLabel: document.querySelector('#current-label'),
  statusLabel: document.querySelector('#status-label'),
  progressNumber: document.querySelector('#progress-number'),
  progressTotal: document.querySelector('#progress-total'),
  progressBar: document.querySelector('#progress-bar'),
  orbitRing: document.querySelector('.orbit-ring'),
  savedCount: document.querySelector('#saved-count'),
  sessionState: document.querySelector('#session-state'),
  queueSummary: document.querySelector('#queue-summary'),
  queueList: document.querySelector('#queue-list'),
  emptyState: document.querySelector('#empty-state'),
  start: document.querySelector('#start-session'),
  completeNext: document.querySelector('#complete-next'),
  reopenCurrent: document.querySelector('#reopen-current'),
  reset: document.querySelector('#reset-session'),
  jumpInput: document.querySelector('#jump-input'),
  jump: document.querySelector('#jump-session'),
  failed: document.querySelector('#mark-failed'),
  // 打开方式（已停用）
  // openModeCurrent: document.querySelector('#open-mode-current'),
  // openModeNewTab: document.querySelector('#open-mode-new-tab'),
};

let state = {
  links: [],
  currentIndex: 0,
  sessionActive: false,
  openedCurrent: false,
  failedIndexes: [],
  openMode: 'current',
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && Array.isArray(saved.links)) {
      state = {
        links: saved.links,
        currentIndex: Number.isInteger(saved.currentIndex) ? Math.max(0, saved.currentIndex) : 0,
        sessionActive: saved.sessionActive === true,
        openedCurrent: saved.openedCurrent === true,
        failedIndexes: Array.isArray(saved.failedIndexes) ? saved.failedIndexes.filter(Number.isInteger) : [],
        openMode: 'current',
      };
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  elements.input.value = state.links.join('\n');
  // 打开方式（已停用）：始终从当前页面打开
  // elements.openModeCurrent.checked = state.openMode === 'current';
  // elements.openModeNewTab.checked = state.openMode === 'new-tab';
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function parseLinks(raw) {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const invalid = [];
  const links = lines.filter((line, index) => {
    try {
      const parsed = new URL(line);
      if (!parsed.protocol) throw new Error('missing protocol');
      return true;
    } catch {
      invalid.push(index + 1);
      return false;
    }
  });
  return { links, invalid };
}

function setStatus(message) {
  elements.statusLabel.textContent = message;
}

function currentIsComplete() {
  return state.links.length > 0 && state.currentIndex >= state.links.length;
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function render() {
  const total = state.links.length;
  const complete = currentIsComplete();
  const visibleIndex = complete ? total : state.currentIndex;
  const shownNumber = total === 0 ? 0 : Math.min(visibleIndex + 1, total);
  const percent = total === 0 ? 0 : Math.round((visibleIndex / total) * 100);

  elements.progressNumber.textContent = total === 0 ? '0' : String(shownNumber);
  elements.progressTotal.textContent = `/ ${total}`;
  elements.progressBar.style.width = `${percent}%`;
  elements.orbitRing.style.background = `conic-gradient(var(--accent) ${percent * 3.6}deg, rgba(212,243,107,.12) 0deg)`;
  elements.orbitRing.classList.toggle('complete', complete);
  elements.savedCount.textContent = `${total} 条`;
  elements.currentLabel.textContent = total === 0 ? '还没有链接' : complete ? '全部处理完成' : `第 ${shownNumber} 条链接`;
  elements.sessionState.textContent = complete ? '已完成' : state.sessionActive ? '等待确认' : '未开始';
  elements.queueSummary.textContent = total === 0 ? '等待配置' : `${state.failedIndexes.length} 条失败 · ${percent}% 完成`;

  elements.start.disabled = total === 0 || state.sessionActive || complete;
  elements.completeNext.disabled = total === 0 || !state.sessionActive || !state.openedCurrent || complete;
  elements.reopenCurrent.disabled = total === 0 || complete;
  elements.failed.disabled = total === 0 || complete;
  elements.completeNext.innerHTML = complete
    ? '处理已完成 <span>✓</span>'
    : state.currentIndex === total - 1
      ? '完成全部处理 <span>✓</span>'
      : '本条已完成，打开下一条 <span>↗</span>';

  elements.queueList.innerHTML = state.links.map((link, index) => {
    const isCurrent = index === state.currentIndex && !complete;
    const isCompleted = index < state.currentIndex;
    const isFailed = state.failedIndexes.includes(index);
    const classes = ['queue-item', isCurrent ? 'current' : '', isCompleted ? 'completed' : '', isFailed ? 'failed' : ''].filter(Boolean).join(' ');
    const status = isCurrent
      ? (state.openedCurrent ? '等待手动确认' : state.sessionActive ? '当前条' : '待打开')
      : isFailed ? '已标记失败' : isCompleted ? '已完成' : '待处理';
    return `<li class="${classes}"><span class="queue-index">${String(index + 1).padStart(2, '0')}</span><div><div class="queue-url" title="${escapeHtml(link)}">${escapeHtml(link)}</div><div class="queue-status">${status}</div></div></li>`;
  }).join('');
  elements.emptyState.hidden = total > 0;
}

function saveLinks() {
  const { links, invalid } = parseLinks(elements.input.value);
  elements.inputError.textContent = invalid.length ? `第 ${invalid.join('、')} 行不是有效网址，已忽略。` : '';
  if (links.length === 0) {
    elements.saveState.textContent = '没有可保存的链接';
    return;
  }
  state = { ...state, links, currentIndex: 0, sessionActive: false, openedCurrent: false, failedIndexes: [] };
  persist();
  elements.saveState.textContent = `已保存 ${links.length} 条 · ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  setStatus('链接已就绪，点击“打开当前链接”开始处理。');
  render();
}

function clearLinks() {
  elements.input.value = '';
  elements.inputError.textContent = '';
  state = { links: [], currentIndex: 0, sessionActive: false, openedCurrent: false, failedIndexes: [], openMode: 'current' };
  localStorage.removeItem(STORAGE_KEY);
  elements.saveState.textContent = '已清空';
  setStatus('粘贴链接后保存，再手动打开第 1 条。');
  render();
}

function openCurrentLink() {
  if (!state.links.length || currentIsComplete()) return;
  const link = state.links[state.currentIndex];
  state.sessionActive = true;
  state.openedCurrent = true;
  persist();
  setStatus(`已打开第 ${state.currentIndex + 1} 条。返回后请手动确认完成或重新打开。`);
  render();

  // 打开方式（已停用）：始终从当前页面打开
  // if (state.openMode === 'new-tab') {
  //   const openedWindow = window.open(link, 'link-jump-target');
  //   if (!openedWindow) {
  //     state.openedCurrent = false;
  //     persist();
  //     setStatus('新标签页被 Safari 拦截，请允许弹窗后重新打开当前条。');
  //     render();
  //   }
  //   return;
  // }
  window.location.href = link;
}

// 打开方式（已停用）
// function changeOpenMode(mode) {
//   state.openMode = mode === 'new-tab' ? 'new-tab' : 'current';
//   persist();
//   setStatus(state.openMode === 'new-tab' ? '已切换为新标签页打开。' : '已切换为当前页面打开。');
//   render();
// }

function startSession() {
  if (!state.links.length || currentIsComplete()) return;
  openCurrentLink();
}

function completeAndOpenNext() {
  if (!state.links.length || !state.sessionActive || !state.openedCurrent || currentIsComplete()) return;
  if (state.currentIndex === state.links.length - 1) {
    state.currentIndex = state.links.length;
    state.sessionActive = false;
    state.openedCurrent = false;
    persist();
    setStatus('全部处理完成。');
    render();
    return;
  }

  state.currentIndex += 1;
  state.openedCurrent = false;
  persist();
  openCurrentLink();
}

function reopenCurrent() {
  if (!state.links.length || currentIsComplete()) return;
  openCurrentLink();
}

function resetSession() {
  if (!window.confirm('确定要重置到第 1 条吗？失败标记也会清除。')) return;
  state = { ...state, currentIndex: 0, sessionActive: false, openedCurrent: false, failedIndexes: [] };
  persist();
  setStatus('已重置到第 1 条，点击“打开当前条”重新开始。');
  render();
}

function jumpTo() {
  const number = Number(elements.jumpInput.value);
  if (!Number.isInteger(number) || number < 1 || number > state.links.length) {
    setStatus(`请输入 1 到 ${state.links.length} 之间的编号。`);
    return;
  }
  state.currentIndex = number - 1;
  state.sessionActive = false;
  state.openedCurrent = false;
  persist();
  setStatus(`已定位到第 ${number} 条，点击“打开当前链接”开始。`);
  render();
}

function markFailed() {
  if (!state.links.length || currentIsComplete()) return;
  if (!state.failedIndexes.includes(state.currentIndex)) state.failedIndexes.push(state.currentIndex);
  persist();
  setStatus(`第 ${state.currentIndex + 1} 条已标记失败。确认后可手动进入下一条。`);
  render();
}

elements.saveLinks.addEventListener('click', saveLinks);
elements.clearLinks.addEventListener('click', clearLinks);
elements.start.addEventListener('click', startSession);
elements.completeNext.addEventListener('click', completeAndOpenNext);
elements.reopenCurrent.addEventListener('click', reopenCurrent);
elements.reset.addEventListener('click', resetSession);
elements.jump.addEventListener('click', jumpTo);
elements.failed.addEventListener('click', markFailed);
// 打开方式（已停用）
// elements.openModeCurrent.addEventListener('change', () => changeOpenMode('current'));
// elements.openModeNewTab.addEventListener('change', () => changeOpenMode('new-tab'));
window.addEventListener('pageshow', render);
elements.input.addEventListener('input', () => { elements.saveState.textContent = '有未保存修改'; });

loadState();
if (state.links.length && state.sessionActive && state.openedCurrent) {
  setStatus('已恢复上次进度。页面不会自动跳转，请手动确认当前条。');
}
render();
