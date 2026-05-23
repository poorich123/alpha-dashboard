# 🚀 Alpha Dashboard — Auto-Start Setup

วิธีทำให้เว็บ Alpha Dashboard เปิดทุกครั้งที่เปิดคอมพิวเตอร์ (Windows)

## ⚡ ขั้นตอน (5 นาที)

### Step 1: ทดสอบ build ก่อน

เปิด PowerShell ในโฟลเดอร์ investing แล้วรัน:

```bash
npm run build
```

ถ้า build สำเร็จ จะมีโฟลเดอร์ `.next/` เกิดขึ้น

### Step 2: ทดสอบสคริปต์ `start-alpha.bat`

ดับเบิ้ลคลิกที่ไฟล์ `start-alpha.bat` → ควรเห็น:

```
Alpha Dashboard starting on http://localhost:3000
```

เปิด browser ไปที่ http://localhost:3000 → ต้องใช้งานได้

### Step 3: ตั้ง Task Scheduler ให้รันอัตโนมัติ

1. กด `Win + R` → พิมพ์ `taskschd.msc` → Enter
2. คลิกขวาที่ **Task Scheduler Library** → **Create Task...** (ไม่ใช่ Basic Task)
3. **General tab:**
   - Name: `Alpha Dashboard`
   - ✅ Run only when user is logged on
   - ✅ Run with highest privileges (optional)
4. **Triggers tab** → คลิก **New...**
   - Begin the task: **At log on**
   - Specific user: เลือก account ของคุณ
   - ✅ Enabled
5. **Actions tab** → คลิก **New...**
   - Action: **Start a program**
   - Program/script: `wscript`
   - Add arguments: `"C:\Users\sauen\OneDrive\เอกสาร\investing\start-alpha-silent.vbs"`
6. **Conditions tab:**
   - ❌ **Uncheck** "Start the task only if the computer is on AC power" (ถ้าใช้ laptop ก็ปิด)
7. **Settings tab:**
   - ✅ Allow task to be run on demand
   - ✅ If the task fails, restart every: 1 minute
   - Attempt to restart up to: 3 times
8. **OK** → ใส่รหัส Windows ถ้าถาม

### Step 4: ทดสอบ

1. คลิกขวา task ที่สร้าง → **Run** → ดูว่า server ขึ้นไหม (รอ ~30 วินาที)
2. Restart คอม → รอ ~1 นาทีหลัง login → เปิด http://localhost:3000

✅ **เสร็จ!** ตอนนี้ทุกครั้งที่เปิดคอม Alpha Dashboard จะเปิดเองอัตโนมัติ

---

## 📱 อยากใช้จากมือถือ/อุปกรณ์อื่นใน Wi-Fi เดียวกัน?

แก้ `start-alpha.bat` บรรทัด `call npm start` เป็น:

```
call npm start -- -H 0.0.0.0
```

แล้วหา IP ของคอม:
```bash
ipconfig
```
(ดู IPv4 Address — เช่น `192.168.1.36`)

จากมือถือ → เปิด browser ไปที่ `http://192.168.1.36:3000`

⚠️ Windows Firewall อาจต้อง allow port 3000

---

## 🌐 อยากใช้ได้ 24/7 จากทุกที่? — Deploy ที่ Vercel (ฟรี)

### ข้อดี:
- ✅ 24/7 ไม่ต้องเปิดคอม
- ✅ HTTPS, fast CDN ทั่วโลก
- ✅ เปิดจากมือถือที่ไหนก็ได้
- ✅ Free tier ใช้ได้สบาย (เกินพอสำหรับ personal use)

### ข้อเสีย:
- ⚠️ ต้องมี GitHub account
- ⚠️ Code จะอยู่บน cloud (แต่ private repo ก็ทำได้)
- ⚠️ localStorage data ไม่ sync ข้าม device (ต้อง Export/Import ในหน้า Settings)
- ⚠️ API keys ต้องใส่ใหม่ในแต่ละ browser ที่ใช้

### ขั้นตอน:
1. สมัคร [github.com](https://github.com) (ถ้ายังไม่มี)
2. สมัคร [vercel.com](https://vercel.com) (login ด้วย GitHub)
3. ใน folder investing เปิด PowerShell:
   ```bash
   git init
   git add .
   git commit -m "Initial Alpha Dashboard"
   ```
4. สร้าง repo ใหม่บน GitHub (private) แล้ว push:
   ```bash
   git remote add origin <YOUR_REPO_URL>
   git branch -M main
   git push -u origin main
   ```
5. ที่ Vercel → **Add New Project** → เลือก repo → Deploy
6. ได้ URL เช่น `alpha-dashboard.vercel.app`

---

## 🛠️ Troubleshooting

### ⚠️ Task รันแล้ว แต่เปิด localhost:3000 ไม่ได้
- รอ 30-60 วินาที (npm start ใช้เวลา bootstrap)
- เปิด Task Scheduler → ดู Last Run Result (ควรเป็น `0x0` = success)
- ลองรัน `start-alpha.bat` แบบ double-click ก่อน → ดู error

### ⚠️ npm command not found
- เปิด PowerShell ใหม่ (admin) แล้วรัน:
  ```powershell
  $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine")
  ```
- หรือเพิ่ม Node.js path ใน `start-alpha.bat` (มีอยู่แล้ว แต่ปรับ path ให้ตรงกับที่ติดตั้ง)

### ⚠️ Build error เวลา restart
- ลบโฟลเดอร์ `.next/` → ให้สคริปต์ build ใหม่อัตโนมัติ

### ⚠️ ต้องการ stop server
- Task Manager → หา `node.exe` ที่ใช้ port 3000 → End Task
- หรือ Task Scheduler → คลิกขวา task → End

---

## 🎯 สรุป — แนะนำใช้แบบไหน?

| สถานการณ์ | วิธี |
|---------|------|
| ใช้คนเดียว, ในบ้าน, ปิด-เปิดคอมบ่อย | **Task Scheduler** ⭐ |
| อยากเปิดจากมือถือในบ้านด้วย | Task Scheduler + `-H 0.0.0.0` |
| อยากเปิดได้ทุกที่ตลอด 24 ชม. | **Vercel** ⭐ |
| ต้องการความเร็วสูง + ไม่ติดอินเทอร์เน็ต | Task Scheduler + production build |
