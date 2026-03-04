let envs = [];
let accounts = [];

let currentSection = 'account';
let currentGroupFilter = 'All';
let searchTerm = '';
const expandedEnvRows = new Set();

const DEFAULT_ENVS = [
  { name: 'GitHub', group: 'Default', url: 'https://github.com', userSelector: '#login_field', passwordSelector: '#password', disableAutofill: false }
];

function saveData() {
  chrome.storage.local.set({ envs, accounts });
}

function loadData() {
  chrome.storage.local.get(['envs', 'accounts'], (result) => {
    envs = (result.envs && result.envs.length ? result.envs : DEFAULT_ENVS).map((env) => ({
      ...env,
      group: (env.group || 'Ungrouped').trim() || 'Ungrouped',
      passwordSelector: env.passwordSelector || env.pwdSelector || '',
      disableAutofill: !!env.disableAutofill
    }));
    accounts = result.accounts || [];
    renderApp();
  });
}

function getGroupsWithCount() {
  const map = new Map();
  map.set('All', currentSection === 'account' ? accounts.length : envs.length);
  if (currentSection === 'account') {
    accounts.forEach((acc) => {
      const key = envs[acc.envIdx]?.group || 'Ungrouped';
      map.set(key, (map.get(key) || 0) + 1);
    });
  } else {
    envs.forEach((env) => {
      const key = env.group || 'Ungrouped';
      map.set(key, (map.get(key) || 0) + 1);
    });
  }
  return [...map.entries()].map(([name, count]) => ({ name, count }));
}

function applyAccountFilters(data) {
  return data.filter((acc) => {
    const env = envs[acc.envIdx] || {};
    const matchesGroup = currentGroupFilter === 'All' || (env.group || 'Ungrouped') === currentGroupFilter;
    const blob = `${acc.username || ''} ${acc.remark || ''} ${env.url || ''}`.toLowerCase();
    const matchesSearch = !searchTerm || blob.includes(searchTerm.toLowerCase());
    return matchesGroup && matchesSearch;
  });
}

function applyEnvFilters(data) {
  return data.filter((env) => {
    const matchesGroup = currentGroupFilter === 'All' || env.group === currentGroupFilter;
    const blob = `${env.name || ''} ${env.url || ''} ${env.group || ''}`.toLowerCase();
    const matchesSearch = !searchTerm || blob.includes(searchTerm.toLowerCase());
    return matchesGroup && matchesSearch;
  });
}

function renderDirectory() {
  const subtitle = document.getElementById('directorySubtitle');
  subtitle.textContent = currentSection === 'account' ? 'Groups' : 'Environment Groups';

  const container = document.getElementById('directoryList');
  container.innerHTML = '';
  getGroupsWithCount().forEach((item) => {
    const btn = document.createElement('button');
    btn.className = `directory-item ${item.name === currentGroupFilter ? 'active' : ''}`;
    btn.innerHTML = `
      <span class="folder-label"><span>📁</span>${item.name}</span>
      <span class="badge">${item.count}</span>
    `;
    btn.onclick = () => {
      currentGroupFilter = item.name;
      renderApp();
    };
    container.appendChild(btn);
  });
}

function renderFilterChips() {
  const chips = document.getElementById('filterChips');
  chips.innerHTML = '';
  getGroupsWithCount().forEach((item) => {
    const chip = document.createElement('button');
    chip.className = `chip ${item.name === currentGroupFilter ? 'active' : ''}`;
    chip.textContent = item.name;
    chip.onclick = () => {
      currentGroupFilter = item.name;
      renderApp();
    };
    chips.appendChild(chip);
  });
}

function renderHeader() {
  document.getElementById('breadcrumbCurrent').textContent = currentGroupFilter;
  document.querySelector('.breadcrumbs').innerHTML = `${currentSection === 'account' ? 'Account Management' : 'Environment Management'} <span>›</span> <b id="breadcrumbCurrent">${currentGroupFilter}</b>`;
}

function renderAccountsTable() {
  const data = applyAccountFilters(accounts);
  const wrap = document.getElementById('accountList');
  if (!data.length) {
    wrap.innerHTML = '<div class="empty">No accounts found.</div>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Account/Username</th>
        <th>Remark</th>
        <th>Environment URL</th>
        <th>Last Used</th>
        <th></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');
  data.forEach((acc) => {
    const originalIndex = accounts.indexOf(acc);
    const env = envs[acc.envIdx] || {};
    const tr = document.createElement('tr');
    tr.dataset.idx = String(originalIndex);
    tr.innerHTML = `
      <td><input class="inline-input acc-username" value="${acc.username || ''}" /></td>
      <td><input class="inline-input acc-remark" value="${acc.remark || ''}" /></td>
      <td><a class="url-link" href="${env.url || '#'}" target="_blank">${env.url || '-'}</a></td>
      <td class="muted">${acc.lastUsed || 'Never'}</td>
      <td>
        <div class="actions">
          <button class="action-btn edit-account" title="Edit">✎</button>
          <button class="action-btn delete-account" title="Delete">🗑</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  wrap.innerHTML = '';
  wrap.appendChild(table);
}

function renderEnvsTable() {
  const data = applyEnvFilters(envs);
  const wrap = document.getElementById('envList');
  if (!data.length) {
    wrap.innerHTML = '<div class="empty">No environments found.</div>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Environment</th>
        <th>Group</th>
        <th>Environment URL</th>
        <th>Disable Autofill</th>
        <th></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  data.forEach((env) => {
    const originalIndex = envs.indexOf(env);
    const mainRow = document.createElement('tr');
    mainRow.dataset.idx = String(originalIndex);
    mainRow.innerHTML = `
      <td><input class="inline-input env-name" value="${env.name}" /></td>
      <td><input class="inline-input env-group" value="${env.group}" /></td>
      <td><input class="inline-input env-url" value="${env.url || ''}" /></td>
      <td>
        <label class="switch">
          <input class="env-disable" type="checkbox" ${env.disableAutofill ? 'checked' : ''} />
          <span class="switch-slider"></span>
        </label>
      </td>
      <td>
        <div class="actions">
          <button class="action-btn toggle-settings" title="Settings">⚙</button>
          <button class="action-btn delete-env" title="Delete">🗑</button>
        </div>
      </td>
    `;

    const settingsRow = document.createElement('tr');
    settingsRow.className = 'env-settings-row';
    settingsRow.style.display = expandedEnvRows.has(originalIndex) ? '' : 'none';
    settingsRow.innerHTML = `
      <td colspan="5" class="env-settings">
        <div class="field">
          <label>Username Selector</label>
          <input class="env-user-selector" data-idx="${originalIndex}" value="${env.userSelector || ''}" placeholder="#login_field" />
        </div>
        <div class="field">
          <label>Password Selector</label>
          <input class="env-password-selector" data-idx="${originalIndex}" value="${env.passwordSelector || ''}" placeholder="#password" />
        </div>
      </td>
    `;

    tbody.appendChild(mainRow);
    tbody.appendChild(settingsRow);
  });

  wrap.innerHTML = '';
  wrap.appendChild(table);
}

function renderApp() {
  renderHeader();
  renderDirectory();
  renderFilterChips();

  const isAccount = currentSection === 'account';
  document.getElementById('account-section').style.display = isAccount ? '' : 'none';
  document.getElementById('env-section').style.display = isAccount ? 'none' : '';
  document.getElementById('nav-account').classList.toggle('active', isAccount);
  document.getElementById('nav-env').classList.toggle('active', !isAccount);

  if (isAccount) {
    renderAccountsTable();
  } else {
    renderEnvsTable();
  }
}

function showModal() {
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalFields');

  if (currentSection === 'account') {
    title.textContent = 'Add New Account';
    body.innerHTML = `
      <div class="field"><label>Account/Username</label><input id="newAccUsername" /></div>
      <div class="field"><label>Password</label><input id="newAccPassword" type="password" /></div>
      <div class="field"><label>Remark</label><input id="newAccRemark" /></div>
      <div class="field"><label>Environment</label><select id="newAccEnv">${envs.map((env, i) => `<option value="${i}">${env.name}</option>`).join('')}</select></div>
    `;
  } else {
    title.textContent = 'Add New Environment';
    body.innerHTML = `
      <div class="field"><label>Environment Name</label><input id="newEnvName" /></div>
      <div class="field"><label>Group</label><input id="newEnvGroup" placeholder="Default / Git / Dev" /></div>
      <div class="field"><label>Environment URL</label><input id="newEnvUrl" /></div>
      <div class="field"><label>Username Selector</label><input id="newEnvUserSelector" placeholder="#login_field" /></div>
      <div class="field"><label>Password Selector</label><input id="newEnvPasswordSelector" placeholder="#password" /></div>
    `;
  }

  document.getElementById('addModalMask').style.display = 'block';
  document.getElementById('addModal').style.display = 'block';
}

function hideModal() {
  document.getElementById('addModalMask').style.display = 'none';
  document.getElementById('addModal').style.display = 'none';
}

function bindEvents() {
  document.getElementById('nav-account').onclick = () => {
    currentSection = 'account';
    currentGroupFilter = 'All';
    renderApp();
  };

  document.getElementById('nav-env').onclick = () => {
    currentSection = 'env';
    currentGroupFilter = 'All';
    renderApp();
  };

  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchTerm = e.target.value.trim();
    renderApp();
  });

  document.getElementById('addNewBtn').onclick = showModal;
  document.getElementById('modalClose').onclick = hideModal;
  document.getElementById('modalCancel').onclick = hideModal;
  document.getElementById('addModalMask').onclick = hideModal;

  document.getElementById('modalSave').onclick = () => {
    if (currentSection === 'account') {
      const username = document.getElementById('newAccUsername').value.trim();
      const password = document.getElementById('newAccPassword').value.trim();
      const remark = document.getElementById('newAccRemark').value.trim();
      const envIdx = Number(document.getElementById('newAccEnv').value);
      if (!username || !password || Number.isNaN(envIdx)) return;
      accounts.push({ username, password, remark, envIdx, lastUsed: new Date().toLocaleString() });
    } else {
      const name = document.getElementById('newEnvName').value.trim();
      const group = document.getElementById('newEnvGroup').value.trim() || 'Ungrouped';
      const url = document.getElementById('newEnvUrl').value.trim();
      if (!name || !url) return;
      envs.push({
        name,
        group,
        url,
        userSelector: document.getElementById('newEnvUserSelector').value.trim(),
        passwordSelector: document.getElementById('newEnvPasswordSelector').value.trim(),
        disableAutofill: false
      });
    }
    saveData();
    hideModal();
    renderApp();
  };

  document.getElementById('accountList').addEventListener('input', (e) => {
    const row = e.target.closest('tr[data-idx]');
    if (!row) return;
    const idx = Number(row.dataset.idx);
    if (e.target.classList.contains('acc-username')) accounts[idx].username = e.target.value;
    if (e.target.classList.contains('acc-remark')) accounts[idx].remark = e.target.value;
    saveData();
  });

  document.getElementById('accountList').addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-idx]');
    if (!row) return;
    const idx = Number(row.dataset.idx);
    if (e.target.classList.contains('delete-account')) {
      accounts.splice(idx, 1);
      saveData();
      renderApp();
    }
    if (e.target.classList.contains('edit-account')) {
      const input = row.querySelector('.acc-username');
      if (input) input.focus();
    }
  });

  document.getElementById('envList').addEventListener('input', (e) => {
    const row = e.target.closest('tr[data-idx]');
    if (row) {
      const idx = Number(row.dataset.idx);
      if (e.target.classList.contains('env-name')) envs[idx].name = e.target.value;
      if (e.target.classList.contains('env-group')) envs[idx].group = e.target.value;
      if (e.target.classList.contains('env-url')) envs[idx].url = e.target.value;
      saveData();
      return;
    }

    if (e.target.classList.contains('env-user-selector')) {
      envs[Number(e.target.dataset.idx)].userSelector = e.target.value;
      saveData();
    }
    if (e.target.classList.contains('env-password-selector')) {
      envs[Number(e.target.dataset.idx)].passwordSelector = e.target.value;
      saveData();
    }
  });

  document.getElementById('envList').addEventListener('change', (e) => {
    const row = e.target.closest('tr[data-idx]');
    if (!row) return;
    const idx = Number(row.dataset.idx);
    if (e.target.classList.contains('env-disable')) {
      envs[idx].disableAutofill = e.target.checked;
      saveData();
    }
  });

  document.getElementById('envList').addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-idx]');
    if (!row) return;
    const idx = Number(row.dataset.idx);

    if (e.target.classList.contains('toggle-settings')) {
      if (expandedEnvRows.has(idx)) expandedEnvRows.delete(idx);
      else expandedEnvRows.add(idx);
      renderApp();
    }

    if (e.target.classList.contains('delete-env')) {
      envs.splice(idx, 1);
      accounts = accounts.filter((acc) => acc.envIdx !== idx).map((acc) => ({
        ...acc,
        envIdx: acc.envIdx > idx ? acc.envIdx - 1 : acc.envIdx
      }));
      saveData();
      renderApp();
    }
  });
}

bindEvents();
loadData();
