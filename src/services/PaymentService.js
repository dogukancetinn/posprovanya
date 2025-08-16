// Ödeme işleme servisi
const { spawn } = require("child_process")
const path = require("path")

class PaymentService {
  constructor() {
    this.posDevice = null
    this.isConnected = false
    this.lastTransactionId = null
    this.supportedMethods = ["cash", "card", "mixed"]
  }

  // POS cihazı bağlantısını başlat
  async initializePOSDevice() {
    try {
      // Beko 300TR POS cihazı için COM port tarama
      const availablePorts = await this.scanCOMPorts()

      for (const port of availablePorts) {
        try {
          const connected = await this.connectToPOS(port)
          if (connected) {
            this.isConnected = true
            console.log(`POS device connected on ${port}`)
            return { success: true, port: port }
          }
        } catch (error) {
          console.log(`Failed to connect to ${port}:`, error.message)
        }
      }

      return {
        success: false,
        error: "POS cihazı bulunamadı",
      }
    } catch (error) {
      console.error("POS initialization error:", error)
      return {
        success: false,
        error: "POS cihazı başlatılamadı: " + error.message,
      }
    }
  }

  // COM portlarını tara
  async scanCOMPorts() {
    return new Promise((resolve) => {
      // Windows COM portları
      const ports = []
      for (let i = 1; i <= 20; i++) {
        ports.push(`COM${i}`)
      }
      resolve(ports)
    })
  }

  // POS cihazına bağlan
  async connectToPOS(port) {
    return new Promise((resolve, reject) => {
      // Mock POS connection - gerçek implementasyonda serial port kullanılacak
      setTimeout(() => {
        // %80 başarı oranı simülasyonu
        if (Math.random() > 0.2) {
          this.posDevice = { port: port, connected: true }
          resolve(true)
        } else {
          reject(new Error("Connection failed"))
        }
      }, 1000)
    })
  }

  // Nakit ödeme işlemi
  async processCashPayment(amount, receivedAmount = null) {
    try {
      if (amount <= 0) {
        return {
          success: false,
          error: "Geçersiz ödeme tutarı",
        }
      }

      const transactionId = this.generateTransactionId()
      const change = receivedAmount ? Math.max(0, receivedAmount - amount) : 0

      const transaction = {
        id: transactionId,
        method: "cash",
        amount: amount,
        receivedAmount: receivedAmount || amount,
        change: change,
        status: "completed",
        timestamp: new Date().toISOString(),
      }

      this.lastTransactionId = transactionId

      return {
        success: true,
        transaction: transaction,
      }
    } catch (error) {
      console.error("Cash payment error:", error)
      return {
        success: false,
        error: "Nakit ödeme hatası: " + error.message,
      }
    }
  }

  // Kart ödeme işlemi
  async processCardPayment(amount, installments = 1) {
    try {
      if (!this.isConnected) {
        return {
          success: false,
          error: "POS cihazı bağlı değil",
        }
      }

      if (amount <= 0) {
        return {
          success: false,
          error: "Geçersiz ödeme tutarı",
        }
      }

      const transactionId = this.generateTransactionId()

      // POS cihazına ödeme talebi gönder
      const posResponse = await this.sendPaymentRequestToPOS(amount, installments)

      if (posResponse.success) {
        const transaction = {
          id: transactionId,
          method: "card",
          amount: amount,
          installments: installments,
          cardType: posResponse.cardType,
          cardNumber: posResponse.maskedCardNumber,
          approvalCode: posResponse.approvalCode,
          referenceNumber: posResponse.referenceNumber,
          status: "completed",
          timestamp: new Date().toISOString(),
          posResponse: posResponse,
        }

        this.lastTransactionId = transactionId

        return {
          success: true,
          transaction: transaction,
        }
      } else {
        return {
          success: false,
          error: posResponse.error || "Kart ödeme reddedildi",
          posResponse: posResponse,
        }
      }
    } catch (error) {
      console.error("Card payment error:", error)
      return {
        success: false,
        error: "Kart ödeme hatası: " + error.message,
      }
    }
  }

  // POS cihazına ödeme talebi gönder
  async sendPaymentRequestToPOS(amount, installments) {
    return new Promise((resolve) => {
      // Mock POS response - gerçek implementasyonda Beko 300TR protokolü kullanılacak
      setTimeout(() => {
        // %90 başarı oranı simülasyonu
        if (Math.random() > 0.1) {
          resolve({
            success: true,
            cardType: "VISA",
            maskedCardNumber: "**** **** **** 1234",
            approvalCode: "123456",
            referenceNumber: "REF" + Date.now(),
            batchNumber: "001",
            terminalId: "12345678",
            merchantId: "123456789012345",
            responseCode: "00",
            responseMessage: "ONAYLANDI",
          })
        } else {
          resolve({
            success: false,
            error: "Kart reddedildi",
            responseCode: "05",
            responseMessage: "REDDEDILDI",
          })
        }
      }, 3000) // 3 saniye bekleme simülasyonu
    })
  }

  // Karma ödeme işlemi
  async processMixedPayment(totalAmount, cashAmount, cardAmount) {
    try {
      if (totalAmount !== cashAmount + cardAmount) {
        return {
          success: false,
          error: "Ödeme tutarları eşleşmiyor",
        }
      }

      const transactions = []

      // Nakit kısmı
      if (cashAmount > 0) {
        const cashResult = await this.processCashPayment(cashAmount)
        if (!cashResult.success) {
          return cashResult
        }
        transactions.push(cashResult.transaction)
      }

      // Kart kısmı
      if (cardAmount > 0) {
        const cardResult = await this.processCardPayment(cardAmount)
        if (!cardResult.success) {
          return cardResult
        }
        transactions.push(cardResult.transaction)
      }

      const mixedTransactionId = this.generateTransactionId()

      return {
        success: true,
        transaction: {
          id: mixedTransactionId,
          method: "mixed",
          amount: totalAmount,
          cashAmount: cashAmount,
          cardAmount: cardAmount,
          transactions: transactions,
          status: "completed",
          timestamp: new Date().toISOString(),
        },
      }
    } catch (error) {
      console.error("Mixed payment error:", error)
      return {
        success: false,
        error: "Karma ödeme hatası: " + error.message,
      }
    }
  }

  // İade işlemi
  async processRefund(originalTransactionId, amount) {
    try {
      if (!this.isConnected) {
        return {
          success: false,
          error: "POS cihazı bağlı değil",
        }
      }

      const refundTransactionId = this.generateTransactionId()

      // POS cihazına iade talebi gönder
      const posResponse = await this.sendRefundRequestToPOS(originalTransactionId, amount)

      if (posResponse.success) {
        return {
          success: true,
          transaction: {
            id: refundTransactionId,
            method: "refund",
            amount: amount,
            originalTransactionId: originalTransactionId,
            status: "completed",
            timestamp: new Date().toISOString(),
            posResponse: posResponse,
          },
        }
      } else {
        return {
          success: false,
          error: posResponse.error || "İade işlemi reddedildi",
        }
      }
    } catch (error) {
      console.error("Refund error:", error)
      return {
        success: false,
        error: "İade hatası: " + error.message,
      }
    }
  }

  // POS cihazına iade talebi gönder
  async sendRefundRequestToPOS(originalTransactionId, amount) {
    return new Promise((resolve) => {
      // Mock refund response
      setTimeout(() => {
        if (Math.random() > 0.05) {
          // %95 başarı oranı
          resolve({
            success: true,
            refundId: "REF" + Date.now(),
            approvalCode: "654321",
            responseCode: "00",
            responseMessage: "İADE ONAYLANDI",
          })
        } else {
          resolve({
            success: false,
            error: "İade reddedildi",
            responseCode: "12",
            responseMessage: "İADE REDDEDİLDİ",
          })
        }
      }, 2000)
    })
  }

  // Transaction ID oluştur
  generateTransactionId() {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")
    return `TXN${timestamp}${random}`
  }

  // POS cihazı durumunu kontrol et
  async checkPOSStatus() {
    if (!this.isConnected) {
      return {
        connected: false,
        error: "POS cihazı bağlı değil",
      }
    }

    try {
      // Mock status check
      return {
        connected: true,
        deviceModel: "Beko 300TR",
        terminalId: "12345678",
        merchantId: "123456789012345",
        batchNumber: "001",
        lastTransaction: this.lastTransactionId,
      }
    } catch (error) {
      return {
        connected: false,
        error: "POS durumu kontrol edilemedi: " + error.message,
      }
    }
  }

  // Gün sonu raporu
  async generateEndOfDayReport() {
    try {
      if (!this.isConnected) {
        return {
          success: false,
          error: "POS cihazı bağlı değil",
        }
      }

      // Mock end of day report
      const report = {
        date: new Date().toISOString().split("T")[0],
        totalTransactions: 45,
        totalAmount: 1250.75,
        cashTransactions: 20,
        cashAmount: 450.25,
        cardTransactions: 25,
        cardAmount: 800.5,
        refunds: 2,
        refundAmount: 35.0,
        batchNumber: "001",
        terminalId: "12345678",
        generatedAt: new Date().toISOString(),
      }

      return {
        success: true,
        report: report,
      }
    } catch (error) {
      console.error("End of day report error:", error)
      return {
        success: false,
        error: "Gün sonu raporu oluşturulamadı: " + error.message,
      }
    }
  }

  // POS bağlantısını kapat
  disconnect() {
    this.isConnected = false
    this.posDevice = null
    console.log("POS device disconnected")
  }
}

module.exports = PaymentService
