import type { Page } from 'playwright'
import type { BrowserProvider, BrowserProviderOptions, ProviderSpecificOptions } from '../../types/browser'
import { ensurePackageInstalled } from '../pkg'
import type { WorkspaceProject } from '../workspace'
import type { Awaitable } from '../../types'

export const playwrightBrowsers = ['firefox', 'webkit', 'chromium'] as const
export type PlaywrightBrowser = typeof playwrightBrowsers[number]

export interface PlaywrightProviderOptions extends BrowserProviderOptions {
  browser: PlaywrightBrowser
  options: ProviderSpecificOptions
}

export class PlaywrightBrowserProvider implements BrowserProvider {
  public name = 'playwright'

  private cachedBrowser: Page | null = null
  private browser!: PlaywrightBrowser
  private options!: any
  private ctx!: WorkspaceProject

  getSupportedBrowsers() {
    return playwrightBrowsers
  }

  async initialize(ctx: WorkspaceProject, { browser, options }: PlaywrightProviderOptions) {
    this.ctx = ctx
    this.browser = browser
    this.options = options?.playwright

    const root = this.ctx.config.root

    if (!await ensurePackageInstalled('playwright', root))
      throw new Error('Cannot find "playwright" package. Please install it manually.')
  }

  async openBrowser() {
    if (this.cachedBrowser)
      return this.cachedBrowser

    const options = this.ctx.config.browser

    const playwright = await import('playwright')

    const playwrightInstance = await playwright[this.browser].launch({ ...this.options, headless: options.headless })
    this.cachedBrowser = await playwrightInstance.newPage()

    this.cachedBrowser.on('close', () => {
      playwrightInstance.close()
    })

    return this.cachedBrowser
  }

  catchError(cb: (error: Error) => Awaitable<void>) {
    this.cachedBrowser?.on('pageerror', cb)
    return () => {
      this.cachedBrowser?.off('pageerror', cb)
    }
  }

  async openPage(url: string) {
    const browserInstance = await this.openBrowser()
    await browserInstance.goto(url)
  }

  async close() {
    await this.cachedBrowser?.close()
    // TODO: right now process can only exit with timeout, if we use browser
    // needs investigating
    process.exit()
  }
}
