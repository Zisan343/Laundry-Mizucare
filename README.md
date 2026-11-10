# 🧺 LaundryPro — Sistem Manajemen Laundry

Aplikasi web manajemen laundry berbasis PHP + MySQL yang berjalan di XAMPP.

## ⚙️ Cara Setup

### 1. Import Database
1. Buka phpMyAdmin -> http://localhost/phpmyadmin
2. Klik tab "Import"
3. Pilih file laundry_db.sql dari folder project ini
4. Klik "Go" — database laundry_db akan terbuat otomatis

### 2. Jalankan XAMPP
- Start Apache dan MySQL

### 3. Akses Aplikasi
http://localhost/laundry/

## 🔑 Default Login
- admin / admin123 (Admin)
- budi_k / admin123 (Kasir)
- siti_o / admin123 (Operator)
- ahmad_k / admin123 (Kasir)

## 🔧 Konfigurasi Database
Edit api/config.php jika MySQL berbeda:
- host: localhost
- db: laundry_db
- user: root
- pass: (kosong)
