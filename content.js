// Multi-environment Account Auto-fill Helper content.js

// 1. Get environment and account data
function getEnvAndAccounts(callback) {
  chrome.storage.local.get(['envs', 'accounts'], (result) => {
    callback(result.envs || [], result.accounts || []);
  });
}

// 严格域名匹配工具：支持主机名、完整URL、以及通配符 *.domain.com
// 规则：
// 1) 完全相等匹配
// 2) 真子域匹配：host 以 "." + pattern 结尾（点号边界避免 testexample.com 命中 example.com）
// 3) pattern 可为完整 URL（含协议/路径），仅取 host 部分再比较
// 4) 支持通配符前缀：*.example.com 仅匹配子域，不匹配 example.com 本身
function matchEnv(host, pattern) {
  const h = (host || '').trim().toLowerCase();
  let p = (pattern || '').trim().toLowerCase();
  if (!h || !p) return false;

  // 通配符前缀：仅匹配子域
  if (p.startsWith('*.')) {
    const base = p.slice(2);
    return h.endsWith('.' + base);
  }

  // 若为完整 URL，仅取 host 部分
  try {
    const testUrl = p.includes('://') ? p : ('https://' + p);
    const u = new URL(testUrl);
    p = u.host;
  } catch {
    // 非URL，按主机名处理
  }

  return h === p || h.endsWith('.' + p);
}

// 2. Account selection panel styles
function injectPanelStyle() {
  if (document.getElementById('account-helper-style')) return;
  const style = document.createElement('style');
  style.id = 'account-helper-style';
  style.innerHTML = `
    #account-helper-panel {
      position: absolute; z-index: 2147483647; background: #fff; box-shadow: 0 2px 8px #0002; border-radius: 8px;
      min-width: 320px; max-width: 400px; max-height: 300px; overflow: auto; padding: 10px;
      font-family: 'Segoe UI', Arial, sans-serif;
      animation: ah-fadein .15s;
    }
    @keyframes ah-fadein { from { opacity: 0; transform: translateY(-8px);} to { opacity: 1; transform: none;}}
    #account-helper-panel input[type="text"] {
      width: 95%; margin-bottom: 8px; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px;
    }
    .account-helper-item {
      padding: 8px 6px; cursor: pointer; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;
      transition: background 0.15s;
    }
    .account-helper-item:hover, .account-helper-item.active {
      background: #f0f4ff;
    }
    .account-helper-item b { font-size: 15px; }
    .account-helper-item .ah-remark { color: #888; font-size: 12px; margin-left: 8px; }
    .account-helper-item .ah-fill { color: #3575f6; font-size: 12px; }
  `;
  document.head.appendChild(style);
}

// 3. Show account selection panel
function showAccountPanel(input) {
  injectPanelStyle();
  getEnvAndAccounts((envs, accounts) => {
    const host = window.location.hostname;
    // 严格匹配当前环境
    const envIdx = envs.findIndex(e => matchEnv(host, e.url));
    if (envIdx === -1) return;
    // Filter accounts
    let filtered = accounts.filter(a => a.envIdx === envIdx);
    let currentList = filtered;

    // Create panel
    let panel = document.getElementById('account-helper-panel');
    if (panel) panel.remove();
    panel = document.createElement('div');
    panel.id = 'account-helper-panel';
    // Position panel aligned to the input left, prefer below; fallback to above if not enough space
    const rect = input.getBoundingClientRect();
    const estimatedHeight = 220; // better estimate
    const margin = 6;
    const belowTop = rect.bottom + window.scrollY + margin;
    const aboveTop = rect.top + window.scrollY - estimatedHeight - margin;
    const spaceBelow = window.innerHeight - rect.bottom;
    const useBelow = spaceBelow >= 140 || aboveTop < window.scrollY + 10;
    panel.style.position = 'absolute';
    panel.style.left = (rect.left + window.scrollX) + 'px';
    panel.style.top = (useBelow ? belowTop : aboveTop) + 'px';
    // Make width follow the input (within panel min/max constraints from CSS)
    panel.style.minWidth = Math.max(260, Math.floor(rect.width)) + 'px';
    panel.style.maxWidth = Math.max(320, Math.floor(rect.width)) + 'px';
    panel.innerHTML = `
      <input id="account-helper-search" type="text" placeholder="Search username/remark" autocomplete="off" />
      <div id="account-helper-list"></div>
    `;
    document.body.appendChild(panel);
    // 显示面板时隐藏触发按钮，避免重叠
    if (input._ah_btn) input._ah_btn.style.display = 'none';

    function renderList(list, activeIdx = -1) {
      const listDiv = panel.querySelector('#account-helper-list');
      if (!list.length) {
        listDiv.innerHTML = '<div style="color:#aaa;text-align:center;padding:16px;">No accounts</div>';
        return;
      }
      listDiv.innerHTML = list.map((a, idx) => `
        <div class="account-helper-item${activeIdx===idx?' active':''}" tabindex="0"
          data-username="${a.username}" data-password="${a.password}">
          <span><b>${a.username}</b><span class="ah-remark">${a.remark || ''}</span></span>
        </div>
      `).join('');
    }
    let activeIdx = -1;
    renderList(currentList, activeIdx);

    // Search
    panel.querySelector('#account-helper-search').addEventListener('input', function() {
      const key = this.value.trim().toLowerCase();
      currentList = filtered.filter(a =>
        a.username.toLowerCase().includes(key) || (a.remark && a.remark.toLowerCase().includes(key))
      );
      activeIdx = -1;
      renderList(currentList, activeIdx);
    });

    // Click to fill
    panel.addEventListener('click', function(e) {
      const item = e.target.closest('.account-helper-item');
      if (item && (e.target.classList.contains('ah-fill') || item.contains(e.target))) {
        input.value = item.dataset.username;
        // Find password input box and fill (supports custom selectors)
        const env = envs[envIdx];
        let pwdSelector = 'input[type="password"]';
        if (env) {
          const sel = (env.passwordSelector && env.passwordSelector.trim())
            || (env.pwdSelector && env.pwdSelector.trim());
          if (sel) pwdSelector = sel;
        }
        const pwdInput = document.querySelector(pwdSelector);
        if (pwdInput) {
          pwdInput.value = item.dataset.password;
          pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        panel.remove();
      }
    });

    // Keyboard support
    panel.querySelector('#account-helper-search').addEventListener('keydown', function(e) {
      if (!currentList.length) return;
      if (e.key === 'ArrowDown') {
        activeIdx = (activeIdx + 1) % currentList.length;
        renderList(currentList, activeIdx);
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        activeIdx = (activeIdx - 1 + currentList.length) % currentList.length;
        renderList(currentList, activeIdx);
        e.preventDefault();
      } else if (e.key === 'Enter' && activeIdx >= 0) {
        const a = currentList[activeIdx];
        input.value = a.username;
        // Find password input box and fill (supports custom selectors)
        const env = envs[envIdx];
        let pwdSelector = 'input[type="password"]';
        if (env) {
          const sel = (env.passwordSelector && env.passwordSelector.trim())
            || (env.pwdSelector && env.pwdSelector.trim());
          if (sel) pwdSelector = sel;
        }
        const pwdInput = document.querySelector(pwdSelector);
        if (pwdInput) {
          pwdInput.value = a.password;
          pwdInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        panel.remove();
      } else if (e.key === 'Escape') {
        panel.remove();
      }
    });

    // Don't auto focus search box, keep input box editable
    // setTimeout(() => {
    //   panel.querySelector('#account-helper-search').focus();
    // }, 10);

    // Close panel
    document.addEventListener('mousedown', function handler(e) {
      if (!panel.contains(e.target) && e.target !== input) {
        panel.remove();
        if (input._ah_btn) input._ah_btn.style.display = '';
        document.removeEventListener('mousedown', handler);
      }
    });
  });
}

// 4. Bind to account input box (supports dynamic pages)
function bindAccountInputPanel() {
  function tryBind() {
    chrome.storage.local.get(['envs'], (result) => {
      const envs = result.envs || [];
      const host = window.location.hostname;
      // 严格匹配当前环境
      const envIdx = envs.findIndex(e => matchEnv(host, e.url));
      if (envIdx === -1) return;
      const env = envs[envIdx];
      // Current environment's userSelector
      const selectors = [];
      if (env.userSelector && env.userSelector.trim()) {
        selectors.push(env.userSelector.trim());
      }
      // Default selectors
      selectors.push('input[placeholder*="account"],input[placeholder*="phone"],input[placeholder*="username"]');
      const allSelector = selectors.join(',');
      document.querySelectorAll(allSelector).forEach(input => {
        if (input._ah_bind) return;
        // 跳过插件内部的搜索输入框
        if (input.closest && input.closest('#account-helper-panel')) return;
        input._ah_bind = true;
        // 禁用浏览器自动填充（按环境开关）
        if (env.disableAutofill) {
          input.setAttribute('autocomplete', 'off');
          input.setAttribute('autocapitalize', 'off');
          input.setAttribute('autocorrect', 'off');
          input.setAttribute('spellcheck', 'false');
          // 只在 focus 期间使用 readonly 抑制下拉
          const removeReadonly = () => {
            input.readOnly = false;
            input.removeEventListener('keydown', removeReadonly);
          };
          input.addEventListener('focus', () => {
            input.readOnly = true;
            input.addEventListener('keydown', removeReadonly);
          });
          input.addEventListener('blur', () => {
            input.readOnly = false;
            input.removeEventListener('keydown', removeReadonly);
          });
          // 处理密码框
          const pwdSel = (env.passwordSelector && env.passwordSelector.trim())
            || (env.pwdSelector && env.pwdSelector.trim())
            || 'input[type="password"]';
          const pwd = document.querySelector(pwdSel);
          if (pwd) {
            pwd.setAttribute('autocomplete', 'new-password');
            pwd.setAttribute('autocapitalize', 'off');
            pwd.setAttribute('autocorrect', 'off');
            pwd.setAttribute('spellcheck', 'false');
          }
        }
        // 绑定触发
        input.addEventListener('focus', function() {
          showAccountPanel(input);
        });
        // 在输入框右侧插入触发按钮（使用 icons/logo.png）
        if (!input._ah_btn) {
          const btn = document.createElement('img');
          btn.src = chrome.runtime.getURL('icons/logo.png');
          btn.alt = 'open';
          btn.title = 'Select account (Alt+L)';
          btn.style.position = 'absolute';
          btn.style.zIndex = 2147483647;
          btn.style.width = '16px';
          btn.style.height = '16px';
          btn.style.cursor = 'pointer';
          btn.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,.2))';
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showAccountPanel(input);
          });
          document.body.appendChild(btn);
          input._ah_btn = btn;
          const reposition = () => {
            const r = input.getBoundingClientRect();
            btn.style.left = (window.scrollX + r.right - 18) + 'px';
            btn.style.top = (window.scrollY + r.top + (r.height - 16) / 2) + 'px';
          };
          reposition();
          window.addEventListener('scroll', reposition, { passive: true });
          window.addEventListener('resize', reposition);
        }
      });
      // Alt+L 快捷键
      window.addEventListener('keydown', (e) => {
        if ((e.altKey || e.ctrlKey) && (e.key.toLowerCase() === 'l') && document.activeElement) {
          const active = document.activeElement;
          if (active && (active.tagName === 'INPUT')) {
            showAccountPanel(active);
          }
        }
      }, { once: true });
    });
  }
  tryBind();
  const observer = new MutationObserver(tryBind);
  observer.observe(document.body, { childList: true, subtree: true });
}
bindAccountInputPanel(); 