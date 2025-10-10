let envs = [];
let accounts = [];
let currentEnv = "";
let searchKey = "";
function renderEnvSelect() {
  const envSelect = document.getElementById('envSelect');
  envSelect.innerHTML = envs.map(e => `<option value="${e.url}">${e.name}</option>`).join('');
  envSelect.value = currentEnv;
}

function renderAccountList() {
  const list = document.getElementById('accountList');
  if (!accounts.length) {
    list.innerHTML = '<div class="empty">暂无账号，请添加</div>';
    return;
  }
  list.innerHTML = accounts.map((a, i) => `
    <div class="item">
      <input value="${a.username}" onchange="updateAccUser(${i}, this.value)" />
      <input value="${a.password}" onchange="updateAccPwd(${i}, this.value)" />
      <input value="${a.remark}" onchange="updateAccRemark(${i}, this.value)" />
      <select onchange="updateAccEnv(${i}, this.value)">
        ${envs.map((e, idx) => `<option value="${idx}" ${a.envIdx==idx?'selected':''}>${e.name}</option>`).join('')}
      </select>
      <button class="btn delete" onclick="deleteAccount(${i})">删除</button>
    </div>
  `).join('');
}

function loadData() {
  chrome.storage.local.get(['envs', 'accounts'], (result) => {
    envs = result.envs || [];
    accounts = result.accounts || [];
    renderEnvList();
    renderAccountList();
    renderEnvSelect();
  });
}

function saveData() {
  chrome.storage.local.set({ envs, accounts });
}

function renderEnvList() {
  const list = document.getElementById('envList');
  if (!envs.length) {
    list.innerHTML = '<div class="empty">暂无环境，请添加</div>';
    return;
  }
  list.innerHTML = envs.map((e, i) => `
    <div class="item">
      <input value="${e.name}" onchange="updateEnvName(${i}, this.value)" />
      <input value="${e.url}" onchange="updateEnvUrl(${i}, this.value)" />
      <input value='${e.rule || ""}' onchange="updateEnvRule(${i}, this.value)" />
      <button class="btn" onclick="deleteEnv(${i})">删除</button>
    </div>
  `).join('');
}

window.updateEnvName = (i, v) => { envs[i].name = v; saveData(); renderEnvList(); renderEnvSelect(); }
window.updateEnvUrl = (i, v) => { envs[i].url = v; saveData(); renderEnvList(); }
window.updateEnvRule = (i, v) => { envs[i].rule = v; saveData(); renderEnvList(); }
window.deleteEnv = (i) => { envs.splice(i, 1); saveData(); renderEnvList(); renderEnvSelect(); }


document.getElementById('openSettings').addEventListener('click', () => {
  console.log('openSettings');
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open('options.html');
  }
});