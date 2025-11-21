let currentAdapters = [];
let presets = {};

// 初始化
window.onload = async () => {
    await refreshAdapters();
    await refreshPresets();
};

// 刷新网卡列表
async function refreshAdapters() {
    currentAdapters = await eel.get_adapters()();
    const select = document.getElementById('adapter-select');
    select.innerHTML = '';
    
    currentAdapters.forEach((adapter, index) => {
        let opt = document.createElement('option');
        opt.value = index;
        opt.innerText = adapter.name; // + " (" + adapter.desc + ")";
        select.appendChild(opt);
    });
    
    loadAdapterInfo();
}

// 显示选中网卡的信息
function loadAdapterInfo() {
    const index = document.getElementById('adapter-select').value;
    if(index === "") return;
    
    const data = currentAdapters[index];
    
    document.getElementById('curr-ip').innerText = data.ip || "未连接";
    document.getElementById('curr-mask').innerText = data.mask || "-";
    document.getElementById('curr-gateway').innerText = data.gateway || "-";
    document.getElementById('curr-dns').innerText = data.dns1 || "-";
    
    const badge = document.getElementById('mode-badge');
    if(data.dhcp) {
        badge.innerText = "DHCP 模式";
        badge.style.background = "#e67e22"; 
        badge.style.color = "#fff"; 
    } else {
        badge.innerText = "静态 IP 模式";
        badge.style.background = "#00f2c3";
        badge.style.color = "#000";
    }

    // 自动填入当前值到输入框，方便修改
    if (!data.dhcp) {
        document.getElementById('ip').value = data.ip;
        document.getElementById('mask').value = data.mask;
        document.getElementById('gateway').value = data.gateway;
        document.getElementById('dns1').value = data.dns1;
        document.getElementById('dns2').value = data.dns2;
    }
}

// 切换选项卡
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    // 这里的逻辑选择器有点hack，但简单有效
    if(tabName === 'apply') {
        document.querySelector('.tabs .tab:nth-child(1)').classList.add('active');
        document.getElementById('tab-apply').classList.add('active');
    } else {
        document.querySelector('.tabs .tab:nth-child(2)').classList.add('active');
        document.getElementById('tab-manage').classList.add('active');
    }
}

// --- 预设管理 ---

async function refreshPresets() {
    presets = await eel.load_presets()();
    
    // 1. 更新“应用配置”页面的下拉框
    const quickSelect = document.getElementById('quick-preset');
    quickSelect.innerHTML = '<option value="">-- 选择预设快速填入 --</option>';
    
    // 2. 更新“管理”页面的列表
    const listDiv = document.getElementById('preset-list');
    listDiv.innerHTML = '';

    for (const [name, data] of Object.entries(presets)) {
        // 下拉框
        let opt = document.createElement('option');
        opt.value = name;
        opt.innerText = name;
        quickSelect.appendChild(opt);
        
        // 列表卡片
        let item = document.createElement('div');
        item.className = 'preset-item';
        item.innerHTML = `
            <div>
                <strong>${name}</strong>
                <div class="preset-info">${data.ip} / ${data.gateway}</div>
            </div>
            <button class="btn btn-del" onclick="removePreset('${name}')">删除</button>
        `;
        listDiv.appendChild(item);
    }
}

function fillFromPreset() {
    const name = document.getElementById('quick-preset').value;
    if (!name) return;
    
    const data = presets[name];
    document.getElementById('ip').value = data.ip;
    document.getElementById('mask').value = data.mask;
    document.getElementById('gateway').value = data.gateway;
    document.getElementById('dns1').value = data.dns1;
    document.getElementById('dns2').value = data.dns2;
}

async function saveNewPreset() {
    const name = document.getElementById('p-name').value;
    if(!name) { alert("请输入预设名称"); return; }
    
    const data = {
        preset_name: name,
        ip: document.getElementById('p-ip').value,
        mask: document.getElementById('p-mask').value,
        gateway: document.getElementById('p-gateway').value,
        dns1: document.getElementById('p-dns1').value,
        dns2: "" 
    };
    
    await eel.save_preset(data)();
    alert("预设已添加");
    document.getElementById('p-name').value = ""; // 清空输入
    await refreshPresets();
}

async function removePreset(name) {
    if(confirm(`确定删除预设 "${name}" 吗?`)) {
        await eel.delete_preset(name)();
        await refreshPresets();
    }
}

// --- 应用设置 ---

function getSelectedAdapterName() {
    const index = document.getElementById('adapter-select').value;
    if(index === "") return null;
    return currentAdapters[index].name;
}

function showLoading(show) {
    const el = document.getElementById('loading');
    if(show) el.classList.remove('hidden');
    else el.classList.add('hidden');
}

async function runDhcp() {
    const name = getSelectedAdapterName();
    if(!name) return;
    
    showLoading(true);
    await eel.apply_dhcp(name)();
    await refreshAdapters(); // 刷新状态
    showLoading(false);
    alert("已设置为自动获取 IP");
}

async function runStatic() {
    const name = getSelectedAdapterName();
    if(!name) return;
    
    const data = {
        name: name,
        ip: document.getElementById('ip').value,
        mask: document.getElementById('mask').value,
        gateway: document.getElementById('gateway').value,
        dns1: document.getElementById('dns1').value,
        dns2: document.getElementById('dns2').value
    };
    
    if(!data.ip || !data.mask) {
        alert("IP 和 子网掩码必填");
        return;
    }
    
    showLoading(true);
    const success = await eel.apply_static(data)();
    showLoading(false);
    
    if(success) {
        alert("静态 IP 设置成功！");
        await refreshAdapters();
    } else {
        alert("设置失败，请检查参数是否正确");
    }
}