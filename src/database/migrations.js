// Veritabanı migration sistemi
const fs = require("fs")
const path = require("path")

class MigrationManager {
  constructor(dbManager) {
    this.dbManager = dbManager
    this.migrationsPath = path.join(__dirname, "migrations")
  }

  async initialize() {
    // Migrations tablosunu oluştur
    await this.dbManager.runQuery(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
  }

  async runMigrations() {
    try {
      await this.initialize()

      // Migration dosyalarını oku
      if (!fs.existsSync(this.migrationsPath)) {
        fs.mkdirSync(this.migrationsPath, { recursive: true })
        return
      }

      const migrationFiles = fs
        .readdirSync(this.migrationsPath)
        .filter((file) => file.endsWith(".sql"))
        .sort()

      for (const filename of migrationFiles) {
        const executed = await this.dbManager.getQuery("SELECT id FROM migrations WHERE filename = ?", [filename])

        if (!executed) {
          console.log(`Running migration: ${filename}`)

          const migrationSQL = fs.readFileSync(path.join(this.migrationsPath, filename), "utf8")

          // Migration'ı çalıştır
          const statements = migrationSQL.split(";").filter((stmt) => stmt.trim())

          for (const statement of statements) {
            if (statement.trim()) {
              await this.dbManager.runQuery(statement)
            }
          }

          // Migration'ı kaydet
          await this.dbManager.runQuery("INSERT INTO migrations (filename) VALUES (?)", [filename])

          console.log(`Migration completed: ${filename}`)
        }
      }
    } catch (error) {
      console.error("Migration error:", error)
      throw error
    }
  }

  async createMigration(name) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
    const filename = `${timestamp}_${name}.sql`
    const filepath = path.join(this.migrationsPath, filename)

    const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your SQL statements here
-- Example:
-- ALTER TABLE products ADD COLUMN new_field TEXT;

-- Remember to end each statement with semicolon
`

    fs.writeFileSync(filepath, template)
    console.log(`Migration created: ${filename}`)
    return filename
  }
}

module.exports = MigrationManager
