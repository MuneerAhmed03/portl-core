const DB_NAME = 'portl'
const STORE_NAME = 'storage'
const DB_VERSION = 1

interface StorageRecord {
  key: string
  value: unknown
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

export class BrowserStorage {
  private dbPromise: Promise<IDBDatabase> | null = null

  private getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'key' })
          }
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
      })
    }
    return this.dbPromise
  }

  async set(key: string, value: unknown): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    store.put({ key, value } satisfies StorageRecord)
    await transactionToPromise(tx)
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const db = await this.getDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const result = await requestToPromise<StorageRecord | undefined>(store.get(key))
    await transactionToPromise(tx)
    return result ? (result.value as T) : null
  }

  async delete(key: string): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(key)
    await transactionToPromise(tx)
  }

  async clear(): Promise<void> {
    const db = await this.getDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    await transactionToPromise(tx)
  }

  async keys(): Promise<string[]> {
    const db = await this.getDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const keys = await requestToPromise<IDBValidKey[]>(tx.objectStore(STORE_NAME).getAllKeys())
    await transactionToPromise(tx)
    return keys.map((key) => String(key))
  }
}

