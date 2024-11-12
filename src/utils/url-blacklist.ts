import { bloomFilterData } from "../bloom-data";

export interface BloomFilterMetadata {
    createdAt: string;
    domainsProcessed: number;
    uniqueDomains: number;
    duplicatesSkipped: number;
    invalidSkipped: number;
    hashFunctions: number;
    falsePositiveRate: number;
    sizeInBytes: number;
    originalSize: number;
    fillRate: number;
}

class BloomFilter {
    private bitArray: Uint8Array;
    private hashFunctions: number;

    constructor(base64Data: string, hashFunctions: number) {
        // Decode base64 to Uint8Array
        const binaryString = atob(base64Data);
        this.bitArray = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            this.bitArray[i] = binaryString.charCodeAt(i);
        }
        this.hashFunctions = hashFunctions;
    }

    private getBit(index: number): boolean {
        const byteIndex = Math.floor(index / 8);
        const bitIndex = index % 8;
        return (this.bitArray[byteIndex] & (1 << bitIndex)) !== 0;
    }

    private hash(domain: string, seed: number): number {
        let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
        for (let i = 0; i < domain.length; i++) {
            const ch = domain.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
        h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
        h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        
        return Math.abs(4294967296 * (2097151 & h2) + (h1 >>> 0)) % (this.bitArray.length * 8);
    }

    test(domain: string): boolean {
        for (let i = 0; i < this.hashFunctions; i++) {
            const hash = this.hash(domain, i);
            if (!this.getBit(hash)) {
                return false;
            }
        }
        return true;
    }
}

export class UrlChecker {
    private static instance: UrlChecker;
    private isInitialized: boolean = false;
    private bloomFilter: BloomFilter | null = null;
    private metadata: BloomFilterMetadata | null = null;

    private constructor() {}

    public static getInstance(): UrlChecker {
        if (!UrlChecker.instance) {
            UrlChecker.instance = new UrlChecker();
        }
        return UrlChecker.instance;
    }

    public initialize(): void {
        if (this.isInitialized) return;

        try {
            this.bloomFilter = new BloomFilter(
                bloomFilterData.buffer,
                bloomFilterData.hashFunctions
            );
            this.metadata = bloomFilterData.metadata;
            this.isInitialized = true;
        } catch (error) {
            this.isInitialized = false;
            throw new Error(`Failed to initialize UrlChecker: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
    }

    public isSafe(urlOrDomain: string): boolean {
        if (!this.isInitialized || !this.bloomFilter) {
            throw new Error('UrlChecker not initialized. Call initialize() first.');
        }

        try {
            const domain = this.extractDomain(urlOrDomain);
            return !this.bloomFilter.test(domain);
        } catch (error) {
            console.error('Error checking domain:', error);
            return true; // Fail safe
        }
    }

    public isUnsafe(urlOrDomain: string): boolean {
        return !this.isSafe(urlOrDomain);
    }

    public getMetadata(): BloomFilterMetadata | null {
        return this.metadata;
    }

    private extractDomain(urlOrDomain: string): string {
        try {
            if (!urlOrDomain || typeof urlOrDomain !== 'string') {
                throw new Error('Invalid input');
            }

            let domain = urlOrDomain.trim().toLowerCase();
            if (domain.includes('://')) {
                const url = new URL(domain);
                domain = url.hostname;
            } else {
                try {
                    const url = new URL(`http://${domain}`);
                    domain = url.hostname;
                } catch {
                    // If parsing fails, use as is
                }
            }

            domain = domain.replace(/^www\./, '');

            const domainRegex = /^[a-z0-9][a-z0-9-_.]+[a-z0-9]$/;
            if (!domainRegex.test(domain)) {
                throw new Error('Invalid domain format');
            }

            return domain;
        } catch (error) {
            throw new Error(`Failed to extract domain: ${error instanceof Error ? error.message : 'invalid input'}`);
        }
    }
}

export function createUrlChecker(): UrlChecker {
    const checker = UrlChecker.getInstance();
    checker.initialize();
    return checker;
}