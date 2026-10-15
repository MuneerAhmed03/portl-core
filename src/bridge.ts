declare global {
  interface Window {
    AndroidBridge:
      | {
          storageGet(key: string): string
          storageSet(key: string, value: string): string
          storageDelete(key: string): string
          storageClear(): string
          storageKeys(): string
          dbQuery(sql: string, paramsJson: string | null): string
          dbQueryRaw(sql: string, paramsJson: string | null, method: string): string
        }
      | undefined
  }
}

export function isAndroid(): boolean {
  return typeof window !== 'undefined' && typeof window.AndroidBridge !== 'undefined'
}

export function getBridge() {
  return window.AndroidBridge!
}
