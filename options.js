let envs = [];
let accounts = [];
let currentEnvFilter = "";
let currentPage = 1;
const PAGE_SIZE = 10;

const DEFAULT_ENVS = [
  { name: 'GitHub', url: 'github.com', userSelector: '#login_field', passwordSelector: '#password', disableAutofill: false }
];

// 通用提示工具：创建/显示帮助气泡（供多处复用）
function getOrCreateHelpTip() {
  let tip = document.getElementById('selectorTip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'selectorTip';
    tip.className = 'help-tip';
    document.body.appendChild(tip);
  }
  return tip;
}
function showHelpTip(btn, html) {
  const tip = getOrCreateHelpTip();
  tip.innerHTML = `<pre>${html}</pre>`;
  tip.style.display = 'block';
  const r = btn.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  const margin = 8;
  const top = r.bottom + margin;
  let left = r.left + (btn.offsetWidth / 2) - (tipRect.width / 2);
  const minLeft = margin;
  const maxLeft = window.innerWidth - tipRect.width - margin;
  left = Math.min(Math.max(left, minLeft), maxLeft);
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  // 箭头指向：根据图标中心与 tip 左侧的距离计算
  const arrowLeft = Math.max(12, Math.min(tipRect.width - 12, r.left + r.width / 2 - left));
  tip.setAttribute('data-arrow-left', String(arrowLeft));
  tip.style.setProperty('--arrow-left', `${arrowLeft}px`);
  const hide = (e) => {
    if (!tip.contains(e.target) && e.target !== btn) {
      tip.style.display = 'none';
      document.removeEventListener('mousedown', hide);
    }
  };
  document.addEventListener('mousedown', hide);
}

function saveData() {
  chrome.storage.local.set({ envs, accounts });
}

function loadData() {
  chrome.storage.local.get(['envs', 'accounts'], (result) => {
    if (!result.envs || !result.envs.length) {
      envs = [...DEFAULT_ENVS];
      chrome.storage.local.set({ envs });
    } else {
      envs = result.envs;
      // 兼容旧字段：pwdSelector -> passwordSelector
      envs = envs.map(e => {
        if (!e.passwordSelector && e.pwdSelector) {
          return { ...e, passwordSelector: e.pwdSelector };
        }
        return e;
      });
    }
    accounts = result.accounts || [];
    renderEnvList();
    renderEnvTabs();
    renderEnvSelect();
    // 默认显示环境页数据
    renderAccountList();
  });
}

// Environment Management
function renderEnvList() {
  const list = document.getElementById('envList');
  list.innerHTML = '';
  if (!envs.length) {
    list.innerHTML = '<div class="empty">No environments available, please add one</div>';
    return;
  }
  // 创建表格
  const table = document.createElement('table');
  table.className = 'table env-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th style='width:40px;'>No.</th>
        <th>Environment Name</th>
        <th>Environment URL</th>
        <th>Username Selector <img class="help-icon" id="userSelHelp" data-help="selector" src="icons/help.png" alt="help"></th>
        <th>Password Selector <img class="help-icon" id="pwdSelHelp" data-help="selector" src="icons/help.png" alt="help"></th>
        <th>Disable Autofill <img class="help-icon" id="autofillHelp" data-help="autofill" src="icons/help.png" alt="help"></th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');
  envs.forEach((e, i) => {
    const tr = document.createElement('tr');
    tr.dataset.idx = i;
    // Serial number
    const tdIdx = document.createElement('td');
    tdIdx.textContent = i + 1;
    tr.appendChild(tdIdx);
    // Environment name
    const tdName = document.createElement('td');
    const inputName = document.createElement('input');
    inputName.className = 'env-name';
    inputName.value = e.name;
    tdName.appendChild(inputName);
    tr.appendChild(tdName);
    // Environment URL
    const tdUrl = document.createElement('td');
    const inputUrl = document.createElement('input');
    inputUrl.className = 'env-url';
    inputUrl.value = e.url;
    tdUrl.appendChild(inputUrl);
    tr.appendChild(tdUrl);
    // Username selector
    const tdUserSel = document.createElement('td');
    const inputUserSel = document.createElement('input');
    inputUserSel.className = 'env-user-selector';
    inputUserSel.value = e.userSelector || '';
    tdUserSel.appendChild(inputUserSel);
    tr.appendChild(tdUserSel);
    // Password selector
    const tdPwdSel = document.createElement('td');
    const inputPwdSel = document.createElement('input');
    inputPwdSel.className = 'env-pwd-selector';
    inputPwdSel.value = e.passwordSelector || '';
    tdPwdSel.appendChild(inputPwdSel);
    tr.appendChild(tdPwdSel);
    // Disable autofill
    const tdDisable = document.createElement('td');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'env-disable-autofill';
    cb.checked = !!e.disableAutofill;
    tdDisable.appendChild(cb);
    tr.appendChild(tdDisable);
    // Actions
    const tdOp = document.createElement('td');
    const btnDel = document.createElement('button');
    btnDel.className = 'btn delete-btn';
    btnDel.textContent = 'Delete';
    tdOp.appendChild(btnDel);
    tr.appendChild(tdOp);
    tbody.appendChild(tr);
  });
  list.appendChild(table);
  // 帮助提示：使用事件委托，避免重渲染导致绑定丢失
  const selectorHelpText = `Selector usage examples:\n1) ID: #login_field\n2) Class: .input-class\n3) Tag: input\n4) Attribute contains: input[placeholder*=\"username\"]\n5) Combined: form.login-form input[type=\"text\"]\n6) Hierarchy: #box .row > input[type=\"password\"]\n7) Multiple options: #id1, .class2\n\nTip: Use a selector that uniquely matches the target input.`;
  const autofillHelpText = `Disable Autofill (what it does):\n- Turn off browser suggestions on username/password fields for this environment.\n- We set attributes on inputs: username -> autocomplete=\"off\", password -> autocomplete=\"new-password\"; also disable autocapitalize/autocorrect/spellcheck.\n- When focusing the username field, we temporarily set readonly until you type, which suppresses Chrome's dropdown.\n\nWhen to enable:\n- Browser's password dropdown overlaps the extension panel.\n- You want the extension to be the only account picker.`;
  const mainEl = document.querySelector('.main') || document.body;
  if (mainEl && !mainEl.__helpBound) {
    mainEl.addEventListener('click', (ev) => {
      const icon = (ev.target && ev.target.classList && ev.target.classList.contains('help-icon'))
        ? ev.target
        : (ev.target.closest && ev.target.closest('.help-icon'));
      if (!icon) return;
      const id = icon.id || '';
      if (id === 'autofillHelp') return showHelpTip(icon, autofillHelpText);
      return showHelpTip(icon, selectorHelpText);
    });
    mainEl.__helpBound = true;
  }
}

document.getElementById('envList').addEventListener('input', function(e) {
  const tr = e.target.closest('tr[data-idx]');
  if (!tr) return;
  const idx = Number(tr.dataset.idx);
  if (e.target.classList.contains('env-name')) {
    envs[idx].name = e.target.value;
  } else if (e.target.classList.contains('env-url')) {
    envs[idx].url = e.target.value;
  } else if (e.target.classList.contains('env-user-selector')) {
    envs[idx].userSelector = e.target.value;
  } else if (e.target.classList.contains('env-pwd-selector')) {
    envs[idx].passwordSelector = e.target.value;
  }
  saveData();
  renderEnvSelect();
  renderAccountList();
  renderEnvTabs();
});
document.getElementById('envList').addEventListener('change', function(e) {
  const tr = e.target.closest('tr[data-idx]');
  if (!tr) return;
  const idx = Number(tr.dataset.idx);
  if (e.target.classList.contains('env-disable-autofill')) {
    envs[idx].disableAutofill = e.target.checked;
    saveData();
  }
});
document.getElementById('envList').addEventListener('click', function(e) {
  if (e.target.classList.contains('delete-btn')) {
    const tr = e.target.closest('tr[data-idx]');
    if (!tr) return;
    const idx = Number(tr.dataset.idx);
    envs.splice(idx, 1);
    // Delete associated accounts
    accounts = accounts.filter(a => a.envIdx !== idx);
    // Adjust account envIdx
    accounts.forEach(a => { if (a.envIdx > idx) a.envIdx -= 1; });
    saveData();
    renderEnvList();
    renderEnvSelect();
  renderAccountList();
  renderEnvTabs();
  }
});

document.getElementById('addEnv').onclick = () => {
  const name = document.getElementById('envName').value.trim();
  const url = document.getElementById('envUrl').value.trim();
  const userSelector = document.getElementById('envUserSelector').value.trim();
  const pwdSelector = document.getElementById('envPwdSelector').value.trim();
  if (!name || !url) return alert('Please fill in environment name and URL');
  envs.push({
    name, url,
    userSelector,
    passwordSelector: pwdSelector,
    disableAutofill: false
  });
  saveData();
  renderEnvList();
  renderEnvSelect();
  renderEnvTabs();
  document.getElementById('envName').value = '';
  document.getElementById('envUrl').value = '';
  document.getElementById('envUserSelector').value = '';
  document.getElementById('envPwdSelector').value = '';
};

// Environment filtering - tabs
function renderEnvTabs() {
  const tabs = document.getElementById('envTabs');
  if (!tabs) return;
  tabs.innerHTML = '';
  const createTab = (label, value, active) => {
    const el = document.createElement('span');
    el.className = 'env-tab' + (active ? ' active' : '');
    el.dataset.value = value;
    el.textContent = label;
    return el;
  };
  tabs.appendChild(createTab('All Environments', '', currentEnvFilter === ''));
  envs.forEach((e, i) => {
    tabs.appendChild(createTab(e.name, String(i), String(i) === currentEnvFilter));
  });
  tabs.onclick = (e) => {
    const tab = e.target.closest('.env-tab');
    if (!tab) return;
    currentEnvFilter = tab.dataset.value;
    currentPage = 1;
    // 更新激活样式而不重建整个 tabs
    tabs.querySelectorAll('.env-tab').forEach(el => el.classList.toggle('active', el === tab));
    // 只更新列表，保持滚动区域稳定
    renderAccountList();
  };
}

// 账号管理
function renderEnvSelect() {
  const sel = document.getElementById('accEnv');
  sel.innerHTML = envs.map((e, i) => `<option value="${i}">${e.name}</option>`).join('');
}
function renderAccountList() {
  const list = document.getElementById('accountList');
  list.innerHTML = '';
  let filtered = accounts;
  if (currentEnvFilter !== "") {
    filtered = accounts.filter(a => String(a.envIdx) === currentEnvFilter);
  }
  if (!filtered.length) {
    list.innerHTML = '<div class="empty">No accounts available</div>';
    return;
  }
  // 分页
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageItems = filtered.slice(start, end);

  // 创建表格
  const table = document.createElement('table');
  table.className = 'table acc-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Username</th>
        <th>Password <button class="icon-btn" id="togglePwdAll" title="Toggle Visibility"><img id="togglePwdAllIcon" src="icons/icon_visibility_off.svg" alt="toggle"/></button></th>
        <th>Remark</th>
        <th>Environment</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');
  pageItems.forEach((a, i) => {
    const tr = document.createElement('tr');
    tr.className = 'env-row';
    tr.dataset.idx = accounts.indexOf(a);
    // Phone/Username
    const tdUser = document.createElement('td');
    const inputUser = document.createElement('input');
    inputUser.className = 'acc-user';
    inputUser.value = a.username;
    tdUser.appendChild(inputUser);
    tr.appendChild(tdUser);
    // Password
    const tdPwd = document.createElement('td');
    const inputPwd = document.createElement('input');
    inputPwd.className = 'acc-pwd';
    inputPwd.type = 'password';
    inputPwd.value = a.password;
    tdPwd.appendChild(inputPwd);
    tr.appendChild(tdPwd);
    // Remark
    const tdRemark = document.createElement('td');
    const inputRemark = document.createElement('input');
    inputRemark.className = 'acc-remark';
    inputRemark.value = a.remark;
    tdRemark.appendChild(inputRemark);
    tr.appendChild(tdRemark);
    // Environment
    const tdEnv = document.createElement('td');
    const selectEnv = document.createElement('select');
    selectEnv.className = 'acc-env';
    envs.forEach((e, idx) => {
      const option = document.createElement('option');
      option.value = idx;
      option.textContent = e.name;
      if (a.envIdx == idx) option.selected = true;
      selectEnv.appendChild(option);
    });
    tdEnv.appendChild(selectEnv);
    tr.appendChild(tdEnv);
    // Actions
    const tdOp = document.createElement('td');
    const btnDel = document.createElement('button');
    btnDel.className = 'btn delete-btn acc-delete-btn';
    btnDel.textContent = 'Delete';
    tdOp.appendChild(btnDel);
    tr.appendChild(tdOp);
    tbody.appendChild(tr);
  });
  list.appendChild(table);
  // 确保表头固定不被浏览器焦点滚动带走
  table.querySelector('input,select');

  // 分页器
  const footer = document.createElement('div');
  footer.className = 'table-footer';
  const pg = document.createElement('div');
  pg.className = 'pagination';
  const prev = document.createElement('button');
  prev.className = 'pg'; prev.dataset.act = 'prev'; prev.textContent = '<';
  const next = document.createElement('button');
  next.className = 'pg'; next.dataset.act = 'next'; next.textContent = '>';
  pg.appendChild(prev);
  for (let p = 1; p <= totalPages; p++) {
    const btn = document.createElement('button');
    btn.className = 'pg' + (p === currentPage ? ' active' : '');
    btn.dataset.page = String(p);
    btn.textContent = String(p);
    pg.appendChild(btn);
  }
  pg.appendChild(next);
  footer.appendChild(pg);
  list.appendChild(footer);

  // 密码显示/隐藏切换：作用于当前页
  const toggleBtn = document.getElementById('togglePwdAll');
  if (toggleBtn) {
    let visible = false;
    toggleBtn.onclick = () => {
      visible = !visible;
      document.querySelectorAll('#accountList .acc-pwd').forEach((inp) => {
        inp.type = visible ? 'text' : 'password';
      });
      const icon = document.getElementById('togglePwdAllIcon');
      if (icon) icon.src = visible ? 'icons/icon_visibility.svg' : 'icons/icon_visibility_off.svg';
    };
  }
}

// Import/Export buttons
function renderAccountImportExport() {
  if (document.getElementById('exportAccount')) return; // Prevent duplicate rendering
  document.getElementById('importExportBar').innerHTML = `
    <button class="btn" id="exportAccount">Export</button>
    <button class="btn" id="importAccount" title="">Import</button>
    <input type="file" id="importFile" accept="application/json" style="display:none" />
    <div class="help-tip" id="importTip"></div>
  `;
  const tip = document.getElementById('importTip');
  const importBtn = document.getElementById('importAccount');
  const importHelpText = `Import format:
  [
    {
      "username": "Phone/Username",
      "password": "Password",
      "remark": "Remark",
      "envName": "Environment Name"
    }
  ]`;
  if (importBtn && tip) {
    tip.innerHTML = `<pre>${importHelpText}</pre>`;
    importBtn.addEventListener('mouseenter', () => showHelpTip(importBtn, importHelpText));
    // 导入按钮点击不应显示 tip，保持文件选择
  }
  document.getElementById('exportAccount').onclick = () => {
    // 导出为与导入一致的结构：使用 envName
    const exportAccounts = accounts.map(acc => ({
      username: acc.username,
      password: acc.password,
      remark: acc.remark,
      envName: envs[acc.envIdx] ? envs[acc.envIdx].name : ''
    }));
    const data = JSON.stringify(exportAccounts, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'accounts.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  document.getElementById('importAccount').onclick = () => {
    document.getElementById('importFile').click();
  };
  document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = JSON.parse(evt.target.result);
        if (Array.isArray(imported)) {
          // 使用 envName 关联；不存在则新增环境
          imported.forEach(newAcc => {
            const envName = (newAcc.envName || '').trim();
            let envIdx = -1;
            if (envName) {
              envIdx = envs.findIndex(e => e.name === envName);
              if (envIdx === -1) {
                envs.push({ name: envName, url: '', userSelector: '', passwordSelector: '' });
                envIdx = envs.length - 1;
              }
            }
            if (envIdx === -1) return; // 无有效环境名则跳过
            const idx = accounts.findIndex(acc => acc.username === newAcc.username && acc.envIdx === envIdx);
            const accToSave = { username: newAcc.username, password: newAcc.password, remark: newAcc.remark, envIdx };
            if (idx !== -1) {
              accounts[idx] = accToSave;
            } else {
              accounts.push(accToSave);
            }
          });
          saveData();
          renderEnvList();
          saveData();
          renderAccountList();
          alert('Import successful');
        } else {
          alert('Format error');
        }
      } catch {
        alert('Parse failed');
      }
    };
    reader.readAsText(file);
  });
}

// Account management event delegation

document.getElementById('accountList').addEventListener('input', function(e) {
  const tr = e.target.closest('tr[data-idx]');
  if (!tr) return;
  const idx = Number(tr.dataset.idx);
  if (e.target.classList.contains('acc-user')) {
    accounts[idx].username = e.target.value;
  } else if (e.target.classList.contains('acc-pwd')) {
    accounts[idx].password = e.target.value;
  } else if (e.target.classList.contains('acc-remark')) {
    accounts[idx].remark = e.target.value;
  }
  saveData();
});
document.getElementById('accountList').addEventListener('change', function(e) {
  const tr = e.target.closest('tr[data-idx]');
  if (!tr) return;
  const idx = Number(tr.dataset.idx);
  if (e.target.classList.contains('acc-env')) {
    accounts[idx].envIdx = Number(e.target.value);
    saveData();
  }
});
document.getElementById('accountList').addEventListener('click', function(e) {
  if (e.target.classList.contains('acc-delete-btn')) {
    const tr = e.target.closest('tr[data-idx]');
    if (!tr) return;
    const idx = Number(tr.dataset.idx);
    accounts.splice(idx, 1);
    saveData();
    renderAccountList();
  } else if (e.target.classList.contains('pg')) {
    const btn = e.target;
    if (btn.dataset.page) {
      currentPage = Number(btn.dataset.page);
    } else if (btn.dataset.act === 'prev') {
      currentPage = Math.max(1, currentPage - 1);
    } else if (btn.dataset.act === 'next') {
      const total = (currentEnvFilter !== "") ? accounts.filter(a => String(a.envIdx) === currentEnvFilter).length : accounts.length;
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      currentPage = Math.min(totalPages, currentPage + 1);
    }
    renderAccountList();
  }
});

document.getElementById('addAccount').onclick = () => {
  const username = document.getElementById('accUser').value.trim();
  const password = document.getElementById('accPwd').value.trim();
  const remark = document.getElementById('accRemark').value.trim();
  const envIdx = Number(document.getElementById('accEnv').value);
  if (!username || !password || isNaN(envIdx)) return alert('Please fill in complete account information');
  accounts.push({ username, password, remark, envIdx });
  saveData();
  renderAccountList();
  document.getElementById('accUser').value = '';
  document.getElementById('accPwd').value = '';
  document.getElementById('accRemark').value = '';
};

// 与表格密码显示/隐藏联动：监听总开关变化，同时影响新增密码输入框
document.addEventListener('click', function(e) {
  if (e.target.id === 'togglePwdAll' || (e.target.closest && e.target.closest('#togglePwdAll'))) {
    setTimeout(() => {
      const icon = document.getElementById('togglePwdAllIcon');
      const visible = icon && icon.getAttribute('src') === 'icons/icon_visibility.svg';
      const addPwd = document.getElementById('accPwd');
      if (addPwd) addPwd.type = visible ? 'text' : 'password';
    }, 0);
  }
});

document.getElementById('nav-env').onclick = () => {
  document.getElementById('env-section').style.display = '';
  document.getElementById('account-section').style.display = 'none';
  document.querySelector('.section-title').textContent = '';
  document.getElementById('tabsBar').style.display = 'none';
  document.getElementById('envAddRow').style.display = '';
  document.getElementById('accAddRow').style.display = 'none';
  document.getElementById('nav-env').classList.add('active');
  document.getElementById('nav-account').classList.remove('active');
};
document.getElementById('nav-account').onclick = () => {
  document.getElementById('env-section').style.display = 'none';
  document.getElementById('account-section').style.display = '';
  document.querySelector('.section-title').textContent = '';
  document.getElementById('tabsBar').style.display = '';
  document.getElementById('envAddRow').style.display = 'none';
  document.getElementById('accAddRow').style.display = '';
  document.getElementById('nav-account').classList.add('active');
  document.getElementById('nav-env').classList.remove('active');
};

// Initialization
loadData();
renderAccountImportExport();

// 右侧悬浮按钮交互：手册弹窗与 GitHub 跳转
(function initFloatingActions() {
  const mask = document.getElementById('manualMask');
  const modal = document.getElementById('manualModal');
  const openManual = () => { if (mask) mask.style.display = 'block'; if (modal) modal.style.display = 'block'; };
  const closeManual = () => { if (mask) mask.style.display = 'none'; if (modal) modal.style.display = 'none'; };
  const btnManual = document.getElementById('btnManual');
  const btnGithub = document.getElementById('btnGithub');
  const btnClose = document.getElementById('manualClose');
  if (btnManual) btnManual.onclick = openManual;
  if (btnClose) btnClose.onclick = closeManual;
  if (mask) mask.onclick = closeManual;
  if (btnGithub) btnGithub.onclick = () => {
    try {
      const url = (window.APP_CONFIG && window.APP_CONFIG.githubUrl) || 'https://github.com/lustan/account-picker';
      window.open(url, '_blank');
    } catch (e) {
      window.open('https://github.com/lustan/account-picker', '_blank');
    }
  };
})();