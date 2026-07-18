// UI screenshot capture: real app, real session, content pane only, 2x DPR.
// Run from pangochain-frontend/ so playwright resolves from its node_modules.
import { chromium } from 'playwright'

const OUT = process.env.OUT_DIR || '../ui_retake_seed/captures'
const APP = 'http://localhost:3000'

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
})
const page = await ctx.newPage()

// Login as the regulator (M. Karim) — the audit/ledger viewer role
await page.goto(`${APP}/login`)
await page.fill('input[type="email"]', 'm.karim@regulator.example')
await page.fill('input[type="password"]', 'Demo2026#Secure')
await page.click('button[type="submit"]')
await page.waitForURL('**/dashboard**', { timeout: 30000 }).catch(() => {})
await page.waitForTimeout(1500)

// ── Ledger explorer: chain-status chips + block-grouped view ────────────────
await page.goto(`${APP}/ledger`)
await page.waitForSelector('text=Ledger Explorer', { timeout: 20000 })
await page.waitForSelector('text=Block ', { timeout: 20000 })
await page.waitForTimeout(1200)

const main = page.locator('main')
const box = await main.boundingBox()
// The sticky topbar carries the app breadcrumb (codename) — measure its
// bottom edge and crop strictly below it in every capture.
const crumb = page.locator('main').locator('text=LEDGER').first()
const crumbBox = await crumb.boundingBox()
const topbarBottom = Math.ceil((crumbBox?.y ?? 0) + (crumbBox?.height ?? 0)) + 14

await page.screenshot({
  path: `${OUT}/ui_ledger_explorer.png`,
  clip: { x: box.x, y: topbarBottom, width: box.width, height: 900 - topbarBottom },
})
console.log(`captured ui_ledger_explorer.png (cropped below y=${topbarBottom})`)

// ── Audit log: event table with one row expanded ────────────────────────────
const firstRow = page.locator('tbody tr.cursor-pointer').first()
await firstRow.scrollIntoViewIfNeeded()
await firstRow.click()
await page.waitForTimeout(600)
// Position the expanded row just below the topbar, then crop below the bar.
await firstRow.evaluate((el) => el.scrollIntoView({ block: 'start' }))
await page.evaluate((dy) => {
  document.querySelector('main')?.scrollBy(0, -dy)
}, topbarBottom + 8)
await page.waitForTimeout(400)
await page.screenshot({
  path: `${OUT}/ui_audit_log.png`,
  clip: { x: box.x, y: topbarBottom, width: box.width, height: 900 - topbarBottom },
})
console.log(`captured ui_audit_log.png (cropped below y=${topbarBottom})`)

await browser.close()
