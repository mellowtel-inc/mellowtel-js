export class UrlChecker {
    private static instance: UrlChecker;
    private isInitialized: boolean = false;

    private constructor() {}

    public static getInstance(): UrlChecker {
        if (!UrlChecker.instance) {
            UrlChecker.instance = new UrlChecker();
        }
        return UrlChecker.instance;
    }

    private async openDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('blacklist', 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('domains')) {
                    db.createObjectStore('domains', { keyPath: 'domain' });
                }
            };
        });
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            const db = await this.openDB();
            
            // Check if we already have data
            const isEmpty = await new Promise<boolean>(resolve => {
                const transaction = db.transaction('domains', 'readonly');
                const store = transaction.objectStore('domains');
                const request = store.count();
                request.onsuccess = () => resolve(request.result === 0);
            });

            if (isEmpty) {
                const response = await fetch('https://github.com/fabriziosalmi/blacklists/releases/download/latest/blacklist.txt');
                if (!response.ok) throw new Error('Failed to fetch blacklist');

                const text = await response.text();
                const domains = text
                    .split('\n')
                    .filter(line => line && !line.startsWith('#'))
                    .map(domain => ({ domain: domain.toLowerCase().trim() }));

                const transaction = db.transaction('domains', 'readwrite');
                const store = transaction.objectStore('domains');
                
                for (const domain of domains) {
                    store.put(domain);
                }

                await new Promise<void>((resolve, reject) => {
                    transaction.oncomplete = () => resolve();
                    transaction.onerror = () => reject(transaction.error);
                });
            }

            this.isInitialized = true;
            db.close();
        } catch (error) {
            console.error('Failed to initialize blacklist:', error);
            this.isInitialized = true;
        }
    }

    async isSafe(urlOrDomain: string): Promise<boolean> {
        try {
            // Extract and normalize domain
            const domain = this.extractDomain(urlOrDomain);
            const db = await this.openDB();

            // Check if domain exists in database
            const exists = await new Promise<boolean>(resolve => {
                const transaction = db.transaction('domains', 'readonly');
                const store = transaction.objectStore('domains');
                const request = store.get(domain);
                request.onsuccess = () => resolve(!!request.result);
            });

            db.close();
            return !exists;
        } catch (error) {
            console.error('Error checking domain:', error);
            return true; // Fail safe
        }
    }

    private extractDomain(urlOrDomain: string): string {
        try {
            const url = new URL(urlOrDomain.startsWith('http') ? urlOrDomain : `http://${urlOrDomain}`);
            return url.hostname.toLowerCase().replace(/^www\./, '');
        } catch {
            return urlOrDomain.toLowerCase().replace(/^www\./, '');
        }
    }
}