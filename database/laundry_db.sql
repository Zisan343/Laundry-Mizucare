-- ============================================================
--   SISTEM BASIS DATA LAUNDRY
--   Project UAS - Semester 3
--   Created: 2026-10-09
-- ============================================================

-- Buat dan gunakan database
CREATE DATABASE IF NOT EXISTS laundry_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE laundry_db;

-- ============================================================
-- 1. TABEL USER / KARYAWAN
--    Menyimpan data akun karyawan yang mengoperasikan sistem
-- ============================================================
CREATE TABLE karyawan (
    id_karyawan    INT             NOT NULL AUTO_INCREMENT,
    nama_lengkap   VARCHAR(100)    NOT NULL,
    username       VARCHAR(50)     NOT NULL UNIQUE,
    password_hash  VARCHAR(255)    NOT NULL,
    email          VARCHAR(100)             UNIQUE,
    no_telepon     VARCHAR(20),
    role           ENUM('admin', 'kasir', 'operator')
                                   NOT NULL DEFAULT 'kasir',
    alamat         TEXT,
    tanggal_masuk  DATE            NOT NULL,
    status         ENUM('aktif', 'nonaktif')
                                   NOT NULL DEFAULT 'aktif',
    created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                              ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_karyawan PRIMARY KEY (id_karyawan)
);

-- ============================================================
-- 2. TABEL PELANGGAN
--    Menyimpan data pelanggan / konsumen laundry
-- ============================================================
CREATE TABLE pelanggan (
    id_pelanggan   INT             NOT NULL AUTO_INCREMENT,
    nama_lengkap   VARCHAR(100)    NOT NULL,
    no_telepon     VARCHAR(20)     NOT NULL,
    email          VARCHAR(100)             UNIQUE,
    alamat         TEXT,
    jenis_kelamin  ENUM('L', 'P', 'Lainnya'),
    tanggal_daftar DATE            NOT NULL DEFAULT (CURRENT_DATE),
    poin_loyalitas INT             NOT NULL DEFAULT 0,
    catatan        TEXT,
    created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                              ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_pelanggan PRIMARY KEY (id_pelanggan)
);

-- ============================================================
-- 3. TABEL KATEGORI LAYANAN
--    Mengelompokkan jenis layanan (misal: Cuci Kering, Premium, dll.)
-- ============================================================
CREATE TABLE kategori_layanan (
    id_kategori    INT             NOT NULL AUTO_INCREMENT,
    nama_kategori  VARCHAR(80)     NOT NULL UNIQUE,
    deskripsi      TEXT,
    created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_kategori_layanan PRIMARY KEY (id_kategori)
);

-- ============================================================
-- 4. TABEL JENIS LAYANAN + HARGA
--    Menyimpan semua jenis layanan beserta harga satuannya
-- ============================================================
CREATE TABLE jenis_layanan (
    id_layanan     INT             NOT NULL AUTO_INCREMENT,
    id_kategori    INT             NOT NULL,
    nama_layanan   VARCHAR(100)    NOT NULL,
    satuan         ENUM('kg', 'pcs', 'pasang', 'set')
                                   NOT NULL DEFAULT 'kg',
    harga_satuan   DECIMAL(10,2)   NOT NULL CHECK (harga_satuan >= 0),
    estimasi_jam   INT             NOT NULL DEFAULT 24,
    deskripsi      TEXT,
    is_aktif       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                              ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_jenis_layanan  PRIMARY KEY (id_layanan),
    CONSTRAINT fk_layanan_kategori
        FOREIGN KEY (id_kategori) REFERENCES kategori_layanan (id_kategori)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ============================================================
-- 5. TABEL PESANAN (Header)
--    Satu pesanan berisi informasi umum transaksi
-- ============================================================
CREATE TABLE pesanan (
    id_pesanan       INT             NOT NULL AUTO_INCREMENT,
    kode_pesanan     VARCHAR(20)     NOT NULL UNIQUE,
    id_pelanggan     INT             NOT NULL,
    id_karyawan      INT             NOT NULL,
    tanggal_masuk    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tanggal_estimasi DATETIME        NOT NULL,
    tanggal_selesai  DATETIME,
    tanggal_ambil    DATETIME,
    status_pesanan   ENUM(
                       'menunggu',
                       'diproses',
                       'selesai',
                       'diambil',
                       'dibatalkan'
                     )               NOT NULL DEFAULT 'menunggu',
    catatan_pesanan  TEXT,
    total_berat      DECIMAL(8,2),
    subtotal         DECIMAL(12,2)   NOT NULL DEFAULT 0,
    diskon           DECIMAL(12,2)   NOT NULL DEFAULT 0,
    total_bayar      DECIMAL(12,2)   NOT NULL DEFAULT 0,
    created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                               ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_pesanan       PRIMARY KEY (id_pesanan),
    CONSTRAINT fk_pesanan_pelanggan
        FOREIGN KEY (id_pelanggan) REFERENCES pelanggan (id_pelanggan)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pesanan_karyawan
        FOREIGN KEY (id_karyawan) REFERENCES karyawan (id_karyawan)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ============================================================
-- 6. TABEL DETAIL PESANAN
--    Rincian item / layanan dalam setiap pesanan
-- ============================================================
CREATE TABLE detail_pesanan (
    id_detail      INT             NOT NULL AUTO_INCREMENT,
    id_pesanan     INT             NOT NULL,
    id_layanan     INT             NOT NULL,
    jumlah         DECIMAL(8,2)    NOT NULL CHECK (jumlah > 0),
    harga_satuan   DECIMAL(10,2)   NOT NULL,
    subtotal       DECIMAL(12,2)   NOT NULL,
    catatan_item   VARCHAR(255),
    created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_detail_pesanan PRIMARY KEY (id_detail),
    CONSTRAINT fk_detail_pesanan
        FOREIGN KEY (id_pesanan) REFERENCES pesanan (id_pesanan)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_detail_layanan
        FOREIGN KEY (id_layanan) REFERENCES jenis_layanan (id_layanan)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ============================================================
-- 7. TABEL PEMBAYARAN
--    Mencatat transaksi pembayaran untuk setiap pesanan
-- ============================================================
CREATE TABLE pembayaran (
    id_pembayaran    INT             NOT NULL AUTO_INCREMENT,
    id_pesanan       INT             NOT NULL UNIQUE,
    id_karyawan      INT             NOT NULL,
    metode_bayar     ENUM('tunai', 'transfer', 'qris', 'debit', 'kredit')
                                     NOT NULL DEFAULT 'tunai',
    jumlah_bayar     DECIMAL(12,2)   NOT NULL CHECK (jumlah_bayar >= 0),
    jumlah_kembali   DECIMAL(12,2)   NOT NULL DEFAULT 0,
    status_bayar     ENUM('belum_bayar', 'lunas', 'dp', 'refund')
                                     NOT NULL DEFAULT 'belum_bayar',
    referensi        VARCHAR(100),
    tanggal_bayar    DATETIME,
    catatan          TEXT,
    created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                               ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT pk_pembayaran    PRIMARY KEY (id_pembayaran),
    CONSTRAINT fk_bayar_pesanan
        FOREIGN KEY (id_pesanan) REFERENCES pesanan (id_pesanan)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_bayar_karyawan
        FOREIGN KEY (id_karyawan) REFERENCES karyawan (id_karyawan)
        ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ============================================================
-- 8. INDEKS TAMBAHAN (Performa Query)
-- ============================================================
CREATE INDEX idx_pesanan_pelanggan ON pesanan        (id_pelanggan);
CREATE INDEX idx_pesanan_status    ON pesanan        (status_pesanan);
CREATE INDEX idx_pesanan_tanggal   ON pesanan        (tanggal_masuk);
CREATE INDEX idx_detail_pesanan_id ON detail_pesanan (id_pesanan);
CREATE INDEX idx_pelanggan_telepon ON pelanggan      (no_telepon);
CREATE INDEX idx_karyawan_username ON karyawan       (username);

-- ============================================================
-- DATA AWAL (SEED)
-- ============================================================

-- Kategori Layanan
INSERT INTO kategori_layanan (nama_kategori, deskripsi) VALUES
  ('Reguler',  'Layanan cuci standar dengan waktu normal'),
  ('Express',  'Layanan cuci cepat selesai dalam waktu singkat'),
  ('Premium',  'Layanan perawatan khusus untuk pakaian berkualitas tinggi'),
  ('Khusus',   'Layanan untuk item khusus seperti karpet, selimut, sepatu');

-- Jenis Layanan + Harga
INSERT INTO jenis_layanan (id_kategori, nama_layanan, satuan, harga_satuan, estimasi_jam, deskripsi) VALUES
  (1, 'Cuci + Setrika Reguler',  'kg',      7000, 48, 'Cuci bersih dan setrika, layanan standar'),
  (1, 'Cuci Saja',               'kg',      5000, 48, 'Hanya cuci tanpa setrika'),
  (1, 'Setrika Saja',            'kg',      4000, 24, 'Hanya setrika pakaian bersih'),
  (2, 'Cuci + Setrika Express',  'kg',     12000,  6, 'Selesai dalam 6 jam'),
  (2, 'Cuci Express',            'kg',      9000,  6, 'Cuci saja, selesai dalam 6 jam'),
  (3, 'Dry Cleaning',            'pcs',    35000, 72, 'Dry cleaning untuk pakaian premium'),
  (3, 'Cuci Jas / Blazer',       'pcs',    45000, 72, 'Perawatan khusus jas dan blazer'),
  (3, 'Cuci Gaun / Kebaya',      'pcs',    75000, 72, 'Perawatan khusus gaun dan kebaya'),
  (4, 'Cuci Karpet',             'pcs',    50000, 72, 'Cuci karpet berbagai ukuran'),
  (4, 'Cuci Selimut / Bedcover', 'pcs',    25000, 48, 'Cuci selimut dan bedcover'),
  (4, 'Cuci Sepatu',             'pasang', 30000, 48, 'Cuci dan perawatan sepatu'),
  (4, 'Cuci Tas',                'pcs',    40000, 48, 'Cuci dan perawatan tas');

-- Karyawan
INSERT INTO karyawan (nama_lengkap, username, password_hash, email, no_telepon, role, tanggal_masuk) VALUES
  ('Administrator Sistem', 'admin',   '$2b$12$PLACEHOLDER_HASH', 'admin@laundry.id',  '081200000001', 'admin',    '2024-01-01'),
  ('Budi Santoso',         'budi_k',  '$2b$12$PLACEHOLDER_HASH', 'budi@laundry.id',   '081200000002', 'kasir',    '2024-03-15'),
  ('Siti Rahayu',          'siti_o',  '$2b$12$PLACEHOLDER_HASH', 'siti@laundry.id',   '081200000003', 'operator', '2024-04-01'),
  ('Ahmad Fauzi',          'ahmad_k', '$2b$12$PLACEHOLDER_HASH', 'ahmad@laundry.id',  '081200000004', 'kasir',    '2024-06-10');

-- Pelanggan
INSERT INTO pelanggan (nama_lengkap, no_telepon, email, alamat, jenis_kelamin, poin_loyalitas) VALUES
  ('Rina Kusuma',   '08134567890', 'rina@email.com',    'Jl. Merdeka No. 12, Surabaya',    'P', 150),
  ('Doni Pratama',  '08223456789', 'doni@email.com',    'Jl. Sudirman No. 45, Surabaya',   'L',  80),
  ('Kartika Dewi',  '08312345678', 'kartika@email.com', 'Jl. Pahlawan No. 7, Surabaya',    'P', 220),
  ('Hendra Wijaya', '08198765432', NULL,                'Jl. Diponegoro No. 33, Surabaya', 'L',  40),
  ('Mega Lestari',  '08276543210', 'mega@email.com',    'Jl. Ahmad Yani No. 88, Surabaya', 'P',   0);

-- Pesanan
INSERT INTO pesanan (kode_pesanan, id_pelanggan, id_karyawan, tanggal_masuk, tanggal_estimasi, status_pesanan, subtotal, diskon, total_bayar) VALUES
  ('LND-20261009-001', 1, 2, '2026-10-09 08:30:00', '2026-10-11 08:30:00', 'diproses', 56000,  0,    56000),
  ('LND-20261009-002', 2, 2, '2026-10-09 09:00:00', '2026-10-09 15:00:00', 'menunggu', 36000, 3600, 32400),
  ('LND-20261008-001', 3, 4, '2026-10-08 10:00:00', '2026-10-10 10:00:00', 'selesai',  80000,  0,    80000);

-- Detail Pesanan
INSERT INTO detail_pesanan (id_pesanan, id_layanan, jumlah, harga_satuan, subtotal, catatan_item) VALUES
  (1, 1, 4.0,  7000, 28000, NULL),
  (1, 6, 2.0, 35000, 70000, 'Kemeja putih, tolong ekstra hati-hati'),
  (2, 4, 4.0, 12000, 48000, NULL),
  (3, 8, 1.0, 75000, 75000, 'Kebaya pengantin, sangat hati-hati'),
  (3, 10, 2.0, 25000, 50000, NULL);

-- Pembayaran
INSERT INTO pembayaran (id_pesanan, id_karyawan, metode_bayar, jumlah_bayar, jumlah_kembali, status_bayar, tanggal_bayar) VALUES
  (3, 4, 'qris', 80000, 0, 'lunas', '2026-10-08 10:05:00');

-- ============================================================
-- VIEW
-- ============================================================

CREATE OR REPLACE VIEW v_pesanan_aktif AS
SELECT
    p.kode_pesanan,
    pl.nama_lengkap                                    AS pelanggan,
    pl.no_telepon,
    k.nama_lengkap                                     AS dilayani_oleh,
    p.tanggal_masuk,
    p.tanggal_estimasi,
    p.status_pesanan,
    p.total_bayar,
    COALESCE(pb.status_bayar, 'belum_bayar')           AS status_pembayaran
FROM pesanan p
JOIN pelanggan   pl ON pl.id_pelanggan = p.id_pelanggan
JOIN karyawan    k  ON k.id_karyawan   = p.id_karyawan
LEFT JOIN pembayaran pb ON pb.id_pesanan = p.id_pesanan
WHERE p.status_pesanan NOT IN ('diambil', 'dibatalkan')
ORDER BY p.tanggal_masuk DESC;

CREATE OR REPLACE VIEW v_detail_pesanan_lengkap AS
SELECT
    p.kode_pesanan,
    pl.nama_lengkap   AS pelanggan,
    jl.nama_layanan,
    kl.nama_kategori  AS kategori,
    dp.jumlah,
    jl.satuan,
    dp.harga_satuan,
    dp.subtotal,
    dp.catatan_item,
    p.status_pesanan,
    p.tanggal_masuk,
    p.tanggal_estimasi
FROM detail_pesanan dp
JOIN pesanan          p   ON p.id_pesanan    = dp.id_pesanan
JOIN pelanggan        pl  ON pl.id_pelanggan = p.id_pelanggan
JOIN jenis_layanan    jl  ON jl.id_layanan   = dp.id_layanan
JOIN kategori_layanan kl  ON kl.id_kategori  = jl.id_kategori;

CREATE OR REPLACE VIEW v_pendapatan_harian AS
SELECT
    DATE(pb.tanggal_bayar)  AS tanggal,
    COUNT(pb.id_pembayaran) AS jumlah_transaksi,
    SUM(pb.jumlah_bayar)    AS total_pendapatan,
    SUM(p.diskon)           AS total_diskon
FROM pembayaran pb
JOIN pesanan p ON p.id_pesanan = pb.id_pesanan
WHERE pb.status_bayar = 'lunas'
GROUP BY DATE(pb.tanggal_bayar)
ORDER BY tanggal DESC;

CREATE OR REPLACE VIEW v_pelanggan_aktif AS
SELECT
    pl.id_pelanggan,
    pl.nama_lengkap,
    pl.no_telepon,
    pl.poin_loyalitas,
    COUNT(p.id_pesanan)  AS total_pesanan,
    SUM(p.total_bayar)   AS total_belanja
FROM pelanggan pl
LEFT JOIN pesanan p ON p.id_pelanggan = pl.id_pelanggan
GROUP BY pl.id_pelanggan, pl.nama_lengkap, pl.no_telepon, pl.poin_loyalitas
ORDER BY total_belanja DESC;

-- ============================================================
-- STORED PROCEDURE
-- ============================================================
DELIMITER $$

CREATE PROCEDURE sp_buat_pesanan(
    IN  p_id_pelanggan  INT,
    IN  p_id_karyawan   INT,
    IN  p_catatan       TEXT,
    OUT p_kode_pesanan  VARCHAR(20),
    OUT p_id_pesanan    INT
)
BEGIN
    DECLARE v_seq     INT;
    DECLARE v_tanggal VARCHAR(8);
    SET v_tanggal = DATE_FORMAT(NOW(), '%Y%m%d');
    SELECT COUNT(*) + 1 INTO v_seq
    FROM pesanan WHERE DATE(tanggal_masuk) = CURDATE();
    SET p_kode_pesanan = CONCAT('LND-', v_tanggal, '-', LPAD(v_seq, 3, '0'));
    INSERT INTO pesanan (kode_pesanan, id_pelanggan, id_karyawan,
                         tanggal_masuk, tanggal_estimasi, catatan_pesanan)
    VALUES (p_kode_pesanan, p_id_pelanggan, p_id_karyawan,
            NOW(), DATE_ADD(NOW(), INTERVAL 48 HOUR), p_catatan);
    SET p_id_pesanan = LAST_INSERT_ID();
END$$

CREATE PROCEDURE sp_hitung_total(IN p_id_pesanan INT, IN p_diskon DECIMAL(12,2))
BEGIN
    DECLARE v_subtotal DECIMAL(12,2);
    SELECT SUM(subtotal) INTO v_subtotal
    FROM detail_pesanan WHERE id_pesanan = p_id_pesanan;
    UPDATE pesanan
    SET subtotal    = v_subtotal,
        diskon      = p_diskon,
        total_bayar = v_subtotal - p_diskon
    WHERE id_pesanan = p_id_pesanan;
END$$

DELIMITER ;

-- ============================================================
-- TRIGGER: Auto-update total pesanan
-- ============================================================
DELIMITER $$

CREATE TRIGGER trg_detail_insert
AFTER INSERT ON detail_pesanan FOR EACH ROW
BEGIN
    CALL sp_hitung_total(NEW.id_pesanan, 0);
END$$

CREATE TRIGGER trg_detail_update
AFTER UPDATE ON detail_pesanan FOR EACH ROW
BEGIN
    CALL sp_hitung_total(NEW.id_pesanan, 0);
END$$

CREATE TRIGGER trg_detail_delete
AFTER DELETE ON detail_pesanan FOR EACH ROW
BEGIN
    CALL sp_hitung_total(OLD.id_pesanan, 0);
END$$

DELIMITER ;

-- ============================================================
-- CONTOH QUERY
-- ============================================================
-- SELECT * FROM v_pesanan_aktif;
-- SELECT * FROM v_detail_pesanan_lengkap WHERE kode_pesanan = 'LND-20261009-001';
-- SELECT * FROM v_pendapatan_harian;
-- SELECT * FROM v_pelanggan_aktif LIMIT 10;
-- SELECT p.* FROM pesanan p
--   JOIN pelanggan pl ON pl.id_pelanggan = p.id_pelanggan
--   WHERE pl.no_telepon = '08134567890';
-- ============================================================
