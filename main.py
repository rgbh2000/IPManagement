import eel
import wmi
import subprocess
import ctypes
import sys
import json
import os

# --- 1. 自动提权检查 ---
def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

if not is_admin():
    ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, " ".join(sys.argv), None, 1)
    sys.exit()

# --- 2. 初始化 Eel 和 WMI ---
eel.init('web')
wmi_service = wmi.WMI()
PRESET_FILE = 'presets.json'

# --- 3. 核心功能函数 (暴露给 JS 调用) ---

@eel.expose
def get_adapters():
    """获取所有可用网卡"""
    adapters = []
    configs = wmi_service.Win32_NetworkAdapterConfiguration(IPEnabled=True)
    for conf in configs:
        try:
            adapter = wmi_service.Win32_NetworkAdapter(Index=conf.Index)[0]
            net_name = adapter.NetConnectionID
            if not net_name: continue
            
            # 获取当前信息
            current_info = {
                "name": net_name,
                "desc": conf.Description,
                "dhcp": conf.DHCPEnabled,
                "ip": conf.IPAddress[0] if conf.IPAddress else "",
                "mask": conf.IPSubnet[0] if conf.IPSubnet else "",
                "gateway": conf.DefaultIPGateway[0] if conf.DefaultIPGateway else "",
                "dns1": conf.DNSServerSearchOrder[0] if conf.DNSServerSearchOrder else "",
                "dns2": conf.DNSServerSearchOrder[1] if conf.DNSServerSearchOrder and len(conf.DNSServerSearchOrder) > 1 else ""
            }
            adapters.append(current_info)
        except:
            continue
    return adapters

@eel.expose
def apply_dhcp(name):
    """设置为自动获取"""
    cmd_ip = f'netsh interface ip set address name="{name}" source=dhcp'
    cmd_dns = f'netsh interface ip set dns name="{name}" source=dhcp'
    
    subprocess.run(cmd_ip, shell=True, creationflags=0x08000000)
    subprocess.run(cmd_dns, shell=True, creationflags=0x08000000)
    return True

@eel.expose
def apply_static(data):
    """应用静态 IP"""
    name = data['name']
    ip = data['ip']
    mask = data['mask']
    gateway = data['gateway']
    dns1 = data['dns1']
    dns2 = data['dns2']

    # 设置 IP
    cmd_ip = f'netsh interface ip set address name="{name}" static {ip} {mask}'
    if gateway:
        cmd_ip += f" {gateway}"
    
    result = subprocess.run(cmd_ip, shell=True, creationflags=0x08000000)
    if result.returncode != 0:
        return False

    # 设置 DNS
    if dns1:
        subprocess.run(f'netsh interface ip set dns name="{name}" static {dns1}', shell=True, creationflags=0x08000000)
        if dns2:
            subprocess.run(f'netsh interface ip add dns name="{name}" {dns2} index=2', shell=True, creationflags=0x08000000)
    
    return True

@eel.expose
def save_preset(preset_data):
    """保存预设"""
    try:
        if os.path.exists(PRESET_FILE):
            with open(PRESET_FILE, 'r', encoding='utf-8') as f:
                presets = json.load(f)
        else:
            presets = {}
        
        presets[preset_data['preset_name']] = preset_data
        
        with open(PRESET_FILE, 'w', encoding='utf-8') as f:
            json.dump(presets, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        return str(e)

@eel.expose
def load_presets():
    """读取预设列表"""
    if os.path.exists(PRESET_FILE):
        with open(PRESET_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

@eel.expose
def delete_preset(name):
    """删除预设"""
    if os.path.exists(PRESET_FILE):
        with open(PRESET_FILE, 'r', encoding='utf-8') as f:
            presets = json.load(f)
        if name in presets:
            del presets[name]
            with open(PRESET_FILE, 'w', encoding='utf-8') as f:
                json.dump(presets, f, ensure_ascii=False, indent=2)
    return True

# --- 4. 启动窗口 ---
# size 设置窗口大小
eel.start('index.html', size=(900, 650))