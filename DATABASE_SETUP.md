# คำแนะนำการเลือกที่เก็บข้อมูลออนไลน์ฟรี (Free Cloud Database)
สำหรับระบบทะเบียนคุม กองสาธารณสุขและสิ่งแวดล้อม เทศบาลนครบางบัวทอง

---

## 🏆 ตัวเลือกที่ 1: Supabase (แนะนำเป็นอันดับ 1 - เสถียรและเร็วที่สุด)
Supabase เป็นฐานข้อมูล PostgreSQL บน Cloud ที่มีบริการฟรี (Free Tier) ตลอดชีพ เหมาะสำหรับเว็บ Static บน GitHub Pages ที่ไม่มี Server ของตัวเอง

### จุดเด่น
- **ฟรีตลอดชีพ:** ฐานข้อมูลขนาด 500 MB (ข้อมูลทะเบียน 300 - 10,000 รายการ ใช้พื้นที่ไม่ถึง 5-10 MB)
- **ไม่ต้องมี Server:** เว็บไซต์บน GitHub Pages สามารถคุยกับ Supabase ได้โดยตรงผ่าน JavaScript SDK
- **รองรับหลายคนพร้อมกัน:** เจ้าหน้าที่หลายคนสามารถเปิดเว็บและบันทึกข้อมูลพร้อมกันได้ ข้อมูลจะอัปเดตตรงกันทันที

### วิธีเปิดใช้งาน (ใช้เวลาประมาณ 3 นาที):
1. สมัครใช้งานฟรีที่ [supabase.com](https://supabase.com) (เข้าสู่ระบบด้วยบัญชี GitHub ได้)
2. กด **New Project** ตั้งชื่อโครงการ เช่น `tabien-khum`
3. ไปที่เมนู **SQL Editor** แล้ววางคำสั่งสร้างตารางนี้:
```sql
create table if not exists records (
  id bigint primary key,
  name text not null,
  address text,
  business text,
  category text,
  code text,
  fee text,
  activity_detail text,
  cancelled boolean default false,
  cancel_year text,
  latitude double precision,
  longitude double precision,
  history jsonb default '[]'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- เปิดสิทธิ์ให้เว็บไซต์อ่านและบันทึกข้อมูลได้
alter table records enable row level security;
create policy "Allow public read and write" on records for all using (true) with check (true);
```
4. ไปที่ **Project Settings** -> **API**
   - คัดลอก `Project URL`
   - คัดลอก `anon` `public key`
5. นำ URL และ Key มาบันทึกในหน้าตั้งค่าของระบบทะเบียนคุม

---

## 📊 ตัวเลือกที่ 2: Google Sheets (คุ้นเคยที่สุดสำหรับหน่วยงานราชการ)
ใช้ Google Sheets เป็นฐานข้อมูลออนไลน์ เจ้าหน้าที่สามารถดูและแก้ไขข้อมูลผ่าน Google Sheets เหมือน Excel ได้เลย

### จุดเด่น
- **ฟรี 100%:** ผูกกับบัญชี Gmail หรือ Google Workspace ของเทศบาล
- **ใช้งานง่าย:** ข้อมูลทั้งหมดอยู่ในตาราง Google Sheets สามารถกด Print, Filter หรือ Export ได้ตลอดเวลา

### วิธีเปิดใช้งาน:
1. สร้าง Google Sheets ใหม่ขึ้นมา 1 ไฟล์
2. ไปที่เมนู **ส่วนขยาย (Extensions)** -> **Apps Script**
3. วางโค้ด Apps Script สำหรับรับส่งข้อมูล JSON (GET/POST)
4. กด **Deploy** -> **New Deployment** เลือกเป็น **Web app** และเลือกสิทธิ์เป็น *Anyone (ทุกคน)*
5. นำ Web App URL ที่ได้มาเชื่อมต่อกับระบบ

---

## 🔥 ตัวเลือกที่ 3: Firebase Firestore (ของ Google Cloud)
- **ฟรี:** ความจุ 1 GB, อ่านข้อมูลได้วันละ 50,000 ครั้ง
- ใช้งานง่ายผ่าน Google Firebase Console

