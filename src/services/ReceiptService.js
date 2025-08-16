// Fiş yazdırma servisi
const fs = require("fs")
const path = require("path")
const { app } = require("electron")

class ReceiptService {
  constructor() {
    this.printerConnected = false
    this.printerName = null
    this.receiptTemplate = null
    this.companyInfo = {
      name: "PROVANYA",
      address: "İstanbul, Türkiye",
      phone: "+90 (212) 123 45 67",
      taxNumber: "1234567890",
      website: "www.provanya.com",
    }
  }

  // Yazıcı bağlantısını başlat
  async initializePrinter() {
    try {
      // Mevcut yazıcıları listele
      const printers = await this.getAvailablePrinters()

      // Termal yazıcı ara
      const thermalPrinter = printers.find(
        (printer) =>
          printer.name.toLowerCase().includes("thermal") ||
          printer.name.toLowerCase().includes("receipt") ||
          printer.name.toLowerCase().includes("pos"),
      )

      if (thermalPrinter) {
        this.printerName = thermalPrinter.name
        this.printerConnected = true
        console.log("Thermal printer found:", this.printerName)
        return { success: true, printer: this.printerName }
      }

      // Varsayılan yazıcı kullan
      if (printers.length > 0) {
        this.printerName = printers[0].name
        this.printerConnected = true
        console.log("Using default printer:", this.printerName)
        return { success: true, printer: this.printerName }
      }

      return {
        success: false,
        error: "Yazıcı bulunamadı",
      }
    } catch (error) {
      console.error("Printer initialization error:", error)
      return {
        success: false,
        error: "Yazıcı başlatılamadı: " + error.message,
      }
    }
  }

  // Mevcut yazıcıları listele
  async getAvailablePrinters() {
    return new Promise((resolve) => {
      // Mock printer list - gerçek implementasyonda sistem yazıcıları listelenecek
      const mockPrinters = [
        { name: "POS Thermal Printer", status: "ready" },
        { name: "Microsoft Print to PDF", status: "ready" },
        { name: "Default Printer", status: "ready" },
      ]

      resolve(mockPrinters)
    })
  }

  // Satış fişi yazdır
  async printSalesReceipt(saleData, transactionData) {
    try {
      if (!this.printerConnected) {
        // Yazıcı yoksa PDF olarak kaydet
        return await this.savePDFReceipt(saleData, transactionData)
      }

      const receiptContent = this.generateReceiptContent(saleData, transactionData)

      // Fiş yazdırma işlemi
      const printResult = await this.sendToPrinter(receiptContent)

      if (printResult.success) {
        // Fiş kopyasını kaydet
        await this.saveReceiptCopy(saleData, transactionData, receiptContent)

        return {
          success: true,
          receiptNumber: saleData.saleNumber,
        }
      } else {
        return printResult
      }
    } catch (error) {
      console.error("Print receipt error:", error)
      return {
        success: false,
        error: "Fiş yazdırılamadı: " + error.message,
      }
    }
  }

  // Fiş içeriği oluştur
  generateReceiptContent(saleData, transactionData) {
    const now = new Date()
    const dateStr = now.toLocaleDateString("tr-TR")
    const timeStr = now.toLocaleTimeString("tr-TR")

    let content = ""

    // Başlık
    content += this.centerText(this.companyInfo.name, 32) + "\n"
    content += this.centerText(this.companyInfo.address, 32) + "\n"
    content += this.centerText(`Tel: ${this.companyInfo.phone}`, 32) + "\n"
    content += this.centerText(`VKN: ${this.companyInfo.taxNumber}`, 32) + "\n"
    content += this.printLine(32) + "\n"

    // Fiş bilgileri
    content += `Fiş No: ${saleData.saleNumber}\n`
    content += `Tarih: ${dateStr} ${timeStr}\n`
    content += `Kasiyer: POS Kullanıcısı\n`

    if (saleData.customer && saleData.customer.name) {
      content += `Müşteri: ${saleData.customer.name}\n`
      if (saleData.customer.phone) {
        content += `Tel: ${saleData.customer.phone}\n`
      }
    }

    content += this.printLine(32) + "\n"

    // Ürünler
    saleData.items.forEach((item) => {
      content += `${item.name}\n`
      content += `${item.quantity} x ${item.price.toFixed(2)} TL`
      content += `${item.total.toFixed(2).padStart(32 - `${item.quantity} x ${item.price.toFixed(2)} TL`.length)} TL\n`

      if (item.taxRate > 0) {
        content += `  (KDV %${(item.taxRate * 100).toFixed(0)})\n`
      }
    })

    content += this.printLine(32) + "\n"

    // Toplamlar
    content += `Ara Toplam:${saleData.subtotal.toFixed(2).padStart(32 - "Ara Toplam:".length)} TL\n`

    if (saleData.discount > 0) {
      content += `İndirim:${saleData.discount.toFixed(2).padStart(32 - "İndirim:".length)} TL\n`
    }

    if (saleData.taxAmount > 0) {
      content += `KDV:${saleData.taxAmount.toFixed(2).padStart(32 - "KDV:".length)} TL\n`
    }

    content += this.printLine(32) + "\n"
    content += `TOPLAM:${saleData.total.toFixed(2).padStart(32 - "TOPLAM:".length)} TL\n`
    content += this.printLine(32) + "\n"

    // Ödeme bilgileri
    if (transactionData.method === "cash") {
      content += `Ödeme: Nakit\n`
      if (transactionData.receivedAmount > saleData.total) {
        content += `Alınan:${transactionData.receivedAmount.toFixed(2).padStart(32 - "Alınan:".length)} TL\n`
        content += `Para Üstü:${transactionData.change.toFixed(2).padStart(32 - "Para Üstü:".length)} TL\n`
      }
    } else if (transactionData.method === "card") {
      content += `Ödeme: Kredi Kartı\n`
      content += `Kart: ${transactionData.maskedCardNumber}\n`
      content += `Onay Kodu: ${transactionData.approvalCode}\n`
      if (transactionData.installments > 1) {
        content += `Taksit: ${transactionData.installments}\n`
      }
    } else if (transactionData.method === "mixed") {
      content += `Ödeme: Karma\n`
      content += `Nakit: ${transactionData.cashAmount.toFixed(2)} TL\n`
      content += `Kart: ${transactionData.cardAmount.toFixed(2)} TL\n`
    }

    content += this.printLine(32) + "\n"

    // Alt bilgi
    content += this.centerText("Teşekkür Ederiz!", 32) + "\n"
    content += this.centerText(this.companyInfo.website, 32) + "\n"
    content += "\n\n\n" // Kağıt kesimi için boşluk

    return content
  }

  // Metni ortala
  centerText(text, width) {
    const padding = Math.max(0, Math.floor((width - text.length) / 2))
    return " ".repeat(padding) + text
  }

  // Çizgi yazdır
  printLine(width, char = "-") {
    return char.repeat(width)
  }

  // Yazıcıya gönder
  async sendToPrinter(content) {
    return new Promise((resolve) => {
      // Mock printing - gerçek implementasyonda yazıcı API'si kullanılacak
      setTimeout(() => {
        console.log("Printing receipt...")
        console.log(content)

        // %95 başarı oranı simülasyonu
        if (Math.random() > 0.05) {
          resolve({ success: true })
        } else {
          resolve({
            success: false,
            error: "Yazıcı hatası",
          })
        }
      }, 1000)
    })
  }

  // PDF fiş kaydet
  async savePDFReceipt(saleData, transactionData) {
    try {
      const receiptContent = this.generateReceiptContent(saleData, transactionData)

      // Fiş dizini oluştur
      const receiptsDir = path.join(app.getPath("userData"), "receipts")
      if (!fs.existsSync(receiptsDir)) {
        fs.mkdirSync(receiptsDir, { recursive: true })
      }

      // HTML içeriği oluştur
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Fiş - ${saleData.saleNumber}</title>
          <style>
            body { 
              font-family: 'Courier New', monospace; 
              font-size: 12px; 
              margin: 20px; 
              white-space: pre-line;
            }
            .receipt { 
              width: 300px; 
              margin: 0 auto; 
              border: 1px solid #ccc; 
              padding: 20px; 
            }
          </style>
        </head>
        <body>
          <div class="receipt">${receiptContent}</div>
        </body>
        </html>
      `

      const filename = `receipt_${saleData.saleNumber}_${Date.now()}.html`
      const filepath = path.join(receiptsDir, filename)

      fs.writeFileSync(filepath, htmlContent)

      return {
        success: true,
        receiptNumber: saleData.saleNumber,
        filepath: filepath,
        message: "Fiş HTML olarak kaydedildi",
      }
    } catch (error) {
      console.error("Save PDF receipt error:", error)
      return {
        success: false,
        error: "PDF fiş kaydedilemedi: " + error.message,
      }
    }
  }

  // Fiş kopyasını kaydet
  async saveReceiptCopy(saleData, transactionData, content) {
    try {
      const receiptsDir = path.join(app.getPath("userData"), "receipt_copies")
      if (!fs.existsSync(receiptsDir)) {
        fs.mkdirSync(receiptsDir, { recursive: true })
      }

      const filename = `${saleData.saleNumber}_${Date.now()}.txt`
      const filepath = path.join(receiptsDir, filename)

      const receiptData = {
        saleData: saleData,
        transactionData: transactionData,
        content: content,
        printedAt: new Date().toISOString(),
      }

      fs.writeFileSync(filepath, JSON.stringify(receiptData, null, 2))
      console.log("Receipt copy saved:", filepath)
    } catch (error) {
      console.error("Save receipt copy error:", error)
    }
  }

  // X raporu yazdır (gün içi rapor)
  async printXReport(reportData) {
    try {
      let content = ""

      content += this.centerText(this.companyInfo.name, 32) + "\n"
      content += this.centerText("X RAPORU", 32) + "\n"
      content += this.printLine(32) + "\n"

      content += `Tarih: ${new Date().toLocaleDateString("tr-TR")}\n`
      content += `Saat: ${new Date().toLocaleTimeString("tr-TR")}\n`
      content += this.printLine(32) + "\n"

      content += `Toplam Satış: ${reportData.totalSales}\n`
      content += `Toplam Tutar: ${reportData.totalAmount.toFixed(2)} TL\n`
      content += `Nakit: ${reportData.cashAmount.toFixed(2)} TL\n`
      content += `Kart: ${reportData.cardAmount.toFixed(2)} TL\n`
      content += `İndirim: ${reportData.discountAmount.toFixed(2)} TL\n`
      content += `KDV: ${reportData.taxAmount.toFixed(2)} TL\n`

      content += this.printLine(32) + "\n"
      content += "\n\n\n"

      if (this.printerConnected) {
        return await this.sendToPrinter(content)
      } else {
        // Raporu dosyaya kaydet
        const reportsDir = path.join(app.getPath("userData"), "reports")
        if (!fs.existsSync(reportsDir)) {
          fs.mkdirSync(reportsDir, { recursive: true })
        }

        const filename = `x_report_${Date.now()}.txt`
        const filepath = path.join(reportsDir, filename)

        fs.writeFileSync(filepath, content)

        return {
          success: true,
          message: "X raporu dosyaya kaydedildi",
          filepath: filepath,
        }
      }
    } catch (error) {
      console.error("Print X report error:", error)
      return {
        success: false,
        error: "X raporu yazdırılamadı: " + error.message,
      }
    }
  }

  // Z raporu yazdır (gün sonu rapor)
  async printZReport(reportData) {
    try {
      let content = ""

      content += this.centerText(this.companyInfo.name, 32) + "\n"
      content += this.centerText("Z RAPORU", 32) + "\n"
      content += this.printLine(32) + "\n"

      content += `Tarih: ${reportData.date}\n`
      content += `Saat: ${new Date().toLocaleTimeString("tr-TR")}\n`
      content += this.printLine(32) + "\n"

      content += `Toplam Satış: ${reportData.totalSales}\n`
      content += `Toplam Tutar: ${reportData.totalAmount.toFixed(2)} TL\n`
      content += `Nakit: ${reportData.cashAmount.toFixed(2)} TL\n`
      content += `Kart: ${reportData.cardAmount.toFixed(2)} TL\n`
      content += `İade: ${reportData.refundAmount.toFixed(2)} TL\n`
      content += `İndirim: ${reportData.discountAmount.toFixed(2)} TL\n`
      content += `KDV: ${reportData.taxAmount.toFixed(2)} TL\n`

      content += this.printLine(32) + "\n"
      content += "GÜN SONU RAPORU\n"
      content += "Kasa kapatılmıştır.\n"
      content += this.printLine(32) + "\n"
      content += "\n\n\n"

      if (this.printerConnected) {
        return await this.sendToPrinter(content)
      } else {
        // Raporu dosyaya kaydet
        const reportsDir = path.join(app.getPath("userData"), "reports")
        if (!fs.existsSync(reportsDir)) {
          fs.mkdirSync(reportsDir, { recursive: true })
        }

        const filename = `z_report_${reportData.date.replace(/[/:]/g, "-")}.txt`
        const filepath = path.join(reportsDir, filename)

        fs.writeFileSync(filepath, content)

        return {
          success: true,
          message: "Z raporu dosyaya kaydedildi",
          filepath: filepath,
        }
      }
    } catch (error) {
      console.error("Print Z report error:", error)
      return {
        success: false,
        error: "Z raporu yazdırılamadı: " + error.message,
      }
    }
  }

  // Şirket bilgilerini güncelle
  updateCompanyInfo(companyData) {
    this.companyInfo = {
      ...this.companyInfo,
      ...companyData,
    }
  }

  // Yazıcı durumunu kontrol et
  checkPrinterStatus() {
    return {
      connected: this.printerConnected,
      printerName: this.printerName,
    }
  }
}

module.exports = ReceiptService
