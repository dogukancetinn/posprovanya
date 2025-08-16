# PROVANYA POS Sistemi

Standalone Desktop Point of Sale (POS) uygulaması - Windows 10 64-bit için geliştirilmiş, WooCommerce entegrasyonlu, offline çalışabilen profesyonel satış noktası sistemi.

## 📋 İçindekiler

- [Sistem Gereksinimleri](#sistem-gereksinimleri)
- [Kurulum](#kurulum)
- [WooCommerce API Kurulumu](#woocommerce-api-kurulumu)
- [phpMyAdmin Database Bağlantısı](#phpmyadmin-database-bağlantısı)
- [Özellikler](#özellikler)
- [Kullanım](#kullanım)
- [Troubleshooting](#troubleshooting)
- [API Referansı](#api-referansı)
- [Database Şeması](#database-şeması)
- [Backup/Restore](#backuprestore)

## 🖥️ Sistem Gereksinimleri

- **İşletim Sistemi:** Windows 10 64-bit veya üzeri
- **Node.js:** v20.19.4 (önerilen)
- **npm:** 10.8.2 veya üzeri
- **RAM:** Minimum 4GB (8GB önerilen)
- **Disk Alanı:** 500MB boş alan
- **İnternet:** WooCommerce senkronizasyonu için (offline çalışabilir)

## 🚀 Kurulum

### Geliştirici Kurulumu

\`\`\`bash
# Projeyi klonlayın
git clone https://github.com/provanya/pos-system.git
cd pos-system

# Bağımlılıkları yükleyin
npm install

# Geliştirme modunda çalıştırın
npm run dev
\`\`\`

### Üretim Kurulumu

\`\`\`bash
# Windows için EXE dosyası oluşturun
npm run build:win

# Oluşturulan installer: dist/PROVANYA POS Setup 1.0.0.exe
\`\`\`

### Otomatik Kurulum

1. `PROVANYA POS Setup 1.0.0.exe` dosyasını çift tıklayın
2. Kurulum sihirbazını takip edin
3. Program Files klasörüne kurulum yapılacak
4. Desktop kısayolu otomatik oluşturulacak
5. Kurulum sonrası uygulama otomatik başlayacak

## 🛒 WooCommerce API Kurulumu

### 1. WooCommerce REST API Anahtarları Oluşturma

1. WordPress Admin paneline giriş yapın
2. **WooCommerce > Ayarlar > Gelişmiş > REST API** bölümüne gidin
3. **Anahtar Ekle** butonuna tıklayın
4. Aşağıdaki bilgileri girin:
   - **Açıklama:** PROVANYA POS Sistemi
   - **Kullanıcı:** Admin kullanıcı seçin
   - **İzinler:** Okuma/Yazma
5. **Anahtar Oluştur** butonuna tıklayın
6. **Consumer Key** ve **Consumer Secret** değerlerini kaydedin

### 2. POS Uygulamasında API Yapılandırması

1. PROVANYA POS uygulamasını açın
2. **Ayarlar** sekmesine gidin
3. **WooCommerce API Ayarları** bölümünde:
   - **Site URL:** `https://siteniz.com`
   - **Consumer Key:** Yukarıda oluşturduğunuz key
   - **Consumer Secret:** Yukarıda oluşturduğunuz secret
   - **API Version:** `wc/v3` (varsayılan)
4. **Bağlantıyı Test Et** butonuna tıklayın
5. Başarılı bağlantı mesajını bekleyin

### 3. Ürün Senkronizasyonu

\`\`\`javascript
// Otomatik senkronizasyon ayarları
{
  "syncInterval": 300000,        // 5 dakikada bir (milisaniye)
  "autoSync": true,              // Otomatik senkronizasyon
  "syncOnStartup": true,         // Başlangıçta senkronize et
  "stockUpdateOnly": true        // Sadece stok güncelle (sipariş gönderme)
}
\`\`\`

## 🗄️ phpMyAdmin Database Bağlantısı

### 1. MySQL Database Oluşturma

\`\`\`sql
-- Database oluştur
CREATE DATABASE provanya_pos_remote CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Kullanıcı oluştur
CREATE USER 'pos_user'@'%' IDENTIFIED BY 'güçlü_şifre_123';

-- İzinleri ver
GRANT ALL PRIVILEGES ON provanya_pos_remote.* TO 'pos_user'@'%';
FLUSH PRIVILEGES;
\`\`\`

### 2. POS Uygulamasında Database Yapılandırması

1. **Ayarlar > Database Ayarları** bölümüne gidin
2. **Subdomain Database** ayarlarını girin:
   - **Host:** `subdomain.siteniz.com` veya IP adresi
   - **Port:** `3306` (varsayılan MySQL portu)
   - **Database:** `provanya_pos_remote`
   - **Username:** `pos_user`
   - **Password:** `güçlü_şifre_123`
   - **SSL:** Güvenlik için etkinleştirin

### 3. Bağlantı Testi

\`\`\`bash
# Terminal'de bağlantıyı test edin
mysql -h subdomain.siteniz.com -P 3306 -u pos_user -p provanya_pos_remote
\`\`\`

### 4. Güvenlik Ayarları

\`\`\`sql
-- SSL bağlantısı zorunlu kılma
ALTER USER 'pos_user'@'%' REQUIRE SSL;

-- Belirli IP'lerden erişim sınırlama
CREATE USER 'pos_user'@'192.168.1.100' IDENTIFIED BY 'güçlü_şifre_123';
\`\`\`

## ✨ Özellikler

### 🏪 POS Özellikleri
- **Barkod Okuma:** GTIN/EAN/UPC desteği
- **Ürün Yönetimi:** Stok takibi, kategori yönetimi
- **Sepet İşlemleri:** Ürün ekleme/çıkarma, miktar güncelleme
- **İndirim Sistemi:** Yüzde/tutar bazlı indirimler
- **Çoklu Ödeme:** Nakit, kart, karma ödeme

### 💳 Ödeme Sistemi
- **POS Entegrasyonu:** Beko 300TR desteği
- **Nakit Ödeme:** Para üstü hesaplama
- **Karma Ödeme:** Nakit + kart kombinasyonu
- **Fatura Yazdırma:** Thermal yazıcı desteği

### 🌐 WooCommerce Entegrasyonu
- **Ürün Senkronizasyonu:** Otomatik ürün güncelleme
- **Stok Yönetimi:** Satış sonrası otomatik stok düşürme
- **Fiyat Güncelleme:** Anlık fiyat senkronizasyonu
- **Kategori Yönetimi:** Ürün kategorilerini senkronize etme

### 📊 Raporlama ve Analiz
- **Satış Raporları:** Günlük, haftalık, aylık raporlar
- **Stok Raporları:** Düşük stok uyarıları
- **Müşteri Analizi:** Satış geçmişi ve istatistikler
- **Grafik Gösterimler:** Chart.js ile görsel raporlar

### 🔄 Senkronizasyon
- **Offline Mod:** İnternet olmadan çalışma
- **Otomatik Sync:** Bağlantı geldiğinde otomatik senkronizasyon
- **Çakışma Çözümü:** Veri çakışmalarını otomatik çözme
- **Backup Sistemi:** Otomatik yedekleme

## 📱 Kullanım

### İlk Kurulum Sonrası

1. **Ayarlar Yapılandırması:**
   - WooCommerce API bilgilerini girin
   - Database bağlantısını kurun
   - POS cihazı ayarlarını yapın

2. **Ürün Senkronizasyonu:**
   - **Ürünler** sekmesine gidin
   - **WooCommerce'den Senkronize Et** butonuna tıklayın
   - Senkronizasyon tamamlanmasını bekleyin

3. **İlk Satış:**
   - **POS** sekmesine gidin
   - Barkod okutun veya ürün arayın
   - Sepete ürün ekleyin
   - Ödeme işlemini tamamlayın

### Günlük Kullanım

\`\`\`
1. Uygulamayı açın
2. Otomatik senkronizasyon bekleyin
3. Barkod okutarak ürün ekleyin
4. Sepeti kontrol edin
5. Ödeme yöntemini seçin
6. Fiş yazdırın
7. İşlemi tamamlayın
\`\`\`

## 🔧 Troubleshooting

### Yaygın Sorunlar ve Çözümleri

#### 1. WooCommerce Bağlantı Hatası

\`\`\`
Hata: "API anahtarları geçersiz"
Çözüm:
- Consumer Key/Secret'i kontrol edin
- WooCommerce REST API'nin etkin olduğunu doğrulayın
- SSL sertifikasını kontrol edin
\`\`\`

#### 2. Database Bağlantı Sorunu

\`\`\`
Hata: "Database bağlantısı kurulamadı"
Çözüm:
- Host ve port bilgilerini kontrol edin
- Kullanıcı adı/şifre doğruluğunu kontrol edin
- Firewall ayarlarını kontrol edin
- MySQL servisinin çalıştığını doğrulayın
\`\`\`

#### 3. Barkod Okuma Sorunu

\`\`\`
Hata: "Barkod okunamadı"
Çözüm:
- Barkod formatını kontrol edin (GTIN/EAN/UPC)
- Ürünün WooCommerce'de tanımlı olduğunu doğrulayın
- Senkronizasyon durumunu kontrol edin
\`\`\`

#### 4. POS Cihazı Bağlantı Hatası

\`\`\`
Hata: "POS cihazı bulunamadı"
Çözüm:
- USB/Serial bağlantısını kontrol edin
- Cihaz sürücülerini güncelleyin
- COM port ayarlarını kontrol edin
\`\`\`

### Log Dosyaları

\`\`\`
Windows: %APPDATA%/PROVANYA POS/logs/
- main.log: Ana uygulama logları
- sync.log: Senkronizasyon logları
- pos.log: POS işlem logları
- error.log: Hata logları
\`\`\`

## 📡 API Referansı

### WooCommerce API Endpoints

\`\`\`javascript
// Ürünleri getir
GET /wp-json/wc/v3/products

// Stok güncelle
PUT /wp-json/wc/v3/products/{id}
{
  "stock_quantity": 50
}

// Kategorileri getir
GET /wp-json/wc/v3/products/categories
\`\`\`

### Internal API

\`\`\`javascript
// Satış kaydet
window.electronAPI.saveSale({
  items: [...],
  total: 100.50,
  payment_method: 'cash'
});

// Ürün ara
window.electronAPI.searchProduct('barcode_or_name');

// Senkronizasyon başlat
window.electronAPI.startSync();
\`\`\`

## 🗃️ Database Şeması

### SQLite (Local Database)

\`\`\`sql
-- Ürünler tablosu
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wc_id INTEGER UNIQUE,
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    barcode TEXT,
    price DECIMAL(10,2),
    stock_quantity INTEGER DEFAULT 0,
    category_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Satışlar tablosu
CREATE TABLE sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT NOT NULL,
    customer_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    synced BOOLEAN DEFAULT FALSE
);

-- Satış detayları tablosu
CREATE TABLE sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales (id),
    FOREIGN KEY (product_id) REFERENCES products (id)
);
\`\`\`

### MySQL (Remote Database)

\`\`\`sql
-- Aynı şema yapısı, ek olarak:
CREATE TABLE sync_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    operation_type VARCHAR(50) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id INT,
    status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

## 💾 Backup/Restore

### Otomatik Backup

\`\`\`javascript
// Günlük otomatik backup (config.json)
{
  "backup": {
    "enabled": true,
    "interval": "daily",
    "retention": 30,
    "location": "%APPDATA%/PROVANYA POS/backups/"
  }
}
\`\`\`

### Manuel Backup

1. **Ayarlar > Backup/Restore** bölümüne gidin
2. **Backup Oluştur** butonuna tıklayın
3. Backup dosyası `backups/` klasörüne kaydedilir

### Restore İşlemi

\`\`\`bash
# Backup dosyasından geri yükleme
1. Ayarlar > Backup/Restore
2. Backup dosyasını seçin
3. "Geri Yükle" butonuna tıklayın
4. Uygulamayı yeniden başlatın
\`\`\`

## 🔐 Güvenlik

### Veri Şifreleme

- **Local Database:** AES-256 şifreleme
- **API İletişimi:** HTTPS/TLS 1.3
- **Stored Credentials:** Electron Store ile şifreli saklama

### Güvenlik Önerileri

\`\`\`
✅ Güçlü API anahtarları kullanın
✅ Database şifrelerini düzenli değiştirin
✅ SSL sertifikalarını güncel tutun
✅ Firewall kurallarını yapılandırın
✅ Düzenli backup alın
\`\`\`

## 📞 Destek

### Teknik Destek
- **E-posta:** support@provanya.com
- **Telefon:** +90 XXX XXX XX XX
- **Çalışma Saatleri:** 09:00 - 18:00 (Pazartesi-Cuma)

### Dokümantasyon
- **GitHub:** https://github.com/provanya/pos-system
- **Wiki:** https://github.com/provanya/pos-system/wiki
- **Issues:** https://github.com/provanya/pos-system/issues

### Sürüm Geçmişi

\`\`\`
v1.0.0 (2024-01-15)
- İlk stabil sürüm
- WooCommerce entegrasyonu
- Offline/Online senkronizasyon
- POS cihazı desteği

v1.1.0 (Planlanan)
- Çoklu mağaza desteği
- Gelişmiş raporlama
- Mobil uygulama entegrasyonu
\`\`\`

---

**© 2024 PROVANYA - Tüm hakları saklıdır.**
