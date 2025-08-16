// Barkod işleme ve ürün arama servisi
const log = require("electron-log")
class BarcodeService {
  constructor(dbManager) {
    this.dbManager = dbManager
    this.scannerConnected = false
    this.lastScanTime = 0
    this.scanCooldown = 500 // 500ms cooldown between scans
    this.supportedFormats = ['EAN-13', 'EAN-8', 'UPC-A', 'UPC-E', 'Code128']
  }

  // Barkod formatını doğrula
  validateBarcode(barcode) {
    if (!barcode || typeof barcode !== "string") {
      return { valid: false, error: "Geçersiz barkod formatı" }
    }

    // Boşlukları temizle
    barcode = barcode.trim()

    // Minimum uzunluk kontrolü
    if (barcode.length < 8) {
      return { valid: false, error: "Barkod çok kısa" }
    }

    // Maksimum uzunluk kontrolü
    if (barcode.length > 18) {
      return { valid: false, error: "Barkod çok uzun" }
    }

    // Sadece rakam kontrolü (EAN/UPC için)
    if (!/^\d+$/.test(barcode)) {
      return { valid: false, error: "Barkod sadece rakam içermelidir" }
    }

    return { valid: true, barcode: barcode }
  }

  // EAN-13 checksum doğrulama
  validateEAN13(barcode) {
    if (barcode.length !== 13) {
      return false
    }

    let sum = 0
    for (let i = 0; i < 12; i++) {
      const digit = Number.parseInt(barcode[i])
      sum += i % 2 === 0 ? digit : digit * 3
    }

    const checkDigit = (10 - (sum % 10)) % 10
    return checkDigit === Number.parseInt(barcode[12])
  }

  // Barkod tarama işlemi
  async scanBarcode(barcodeInput) {
    try {
      // Cooldown kontrolü
      const now = Date.now()
      if (now - this.lastScanTime < this.scanCooldown) {
        return { success: false, error: "Çok hızlı tarama, lütfen bekleyin" }
      }
      this.lastScanTime = now

      // Barkod doğrulama
      const validation = this.validateBarcode(barcodeInput)
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }

      const barcode = validation.barcode

      // Veritabanından ürün ara
      const product = await this.dbManager.searchProductByBarcode(barcode)

      if (!product) {
        log.warn(`Product not found for barcode: ${barcode}`)
        // Ürün bulunamadı, alternatif arama yap
        const alternatives = await this.searchAlternatives(barcode)
        return {
          success: false,
          error: "Ürün bulunamadı",
          barcode: barcode,
          alternatives: alternatives,
        }
      }

      // Stok kontrolü
      if (product.stock <= 0) {
        log.warn(`Product out of stock: ${product.name} (${barcode})`)
        return {
          success: false,
          error: "Ürün stokta yok",
          product: product,
        }
      }

      // Ürün aktif mi kontrolü
      if (product.is_active === 0) {
        log.warn(`Product inactive: ${product.name} (${barcode})`)
        return {
          success: false,
          error: "Ürün satışa kapalı",
          product: product,
        }
      }

      log.info(`Product found: ${product.name} (${barcode})`)
      return {
        success: true,
        product: {
          id: product.id,
          name: product.name,
          barcode: product.barcode,
          price: product.price,
          stock: product.stock,
          category: product.category,
          description: product.description,
          image: product.image,
          tax_rate: product.tax_rate || 0.18,
        },
      }
    } catch (error) {
      log.error("Barcode scan error:", error)
      return {
        success: false,
        error: "Barkod tarama hatası: " + error.message,
      }
    }
  }

  // Alternatif ürün arama
  async searchAlternatives(barcode) {
    try {
      // Benzer barkodları ara (son rakamlar farklı olabilir)
      const baseBarcode = barcode.slice(0, -2)
      const alternatives = await this.dbManager.allQuery(
        "SELECT * FROM products WHERE barcode LIKE ? AND is_active = 1 LIMIT 5",
        [`${baseBarcode}%`],
      )

      return alternatives.map((product) => ({
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        price: product.price,
        stock: product.stock,
      }))
    } catch (error) {
      console.error("Alternative search error:", error)
      return []
    }
  }

  // Manuel ürün arama (isim ile)
  async searchProductByName(searchTerm) {
    try {
      const products = await this.dbManager.allQuery(
        `
        SELECT * FROM products 
        WHERE (name LIKE ? OR description LIKE ?) 
        AND is_active = 1 
        ORDER BY name 
        LIMIT 20
      `,
        [`%${searchTerm}%`, `%${searchTerm}%`],
      )

      return {
        success: true,
        products: products,
      }
    } catch (error) {
      console.error("Product name search error:", error)
      return {
        success: false,
        error: "Ürün arama hatası: " + error.message,
      }
    }
  }

  // Barkod geçmişi
  async getBarcodeHistory(limit = 50) {
    try {
      const history = await this.dbManager.allQuery(
        `
        SELECT DISTINCT si.product_barcode, si.product_name, COUNT(*) as scan_count,
               MAX(s.created_at) as last_scan
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        GROUP BY si.product_barcode
        ORDER BY last_scan DESC
        LIMIT ?
      `,
        [limit],
      )

      return history
    } catch (error) {
      console.error("Barcode history error:", error)
      return []
    }
  }
}

module.exports = BarcodeService
