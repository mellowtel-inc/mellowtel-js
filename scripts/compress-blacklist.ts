// scripts/compress-blacklist.ts
import fs from 'fs';
import path from 'path';
import readline from 'readline';

class BloomFilter {
    private bitArray: Buffer;
    private hashFunctions: number;

    constructor(sizeInBytes: number, hashFunctions: number) {
        this.bitArray = Buffer.alloc(sizeInBytes, 0);
        this.hashFunctions = hashFunctions;
    }

    private getBit(index: number): boolean {
        const byteIndex = Math.floor(index / 8);
        const bitIndex = index % 8;
        return (this.bitArray[byteIndex] & (1 << bitIndex)) !== 0;
    }

    private setBit(index: number): void {
        const byteIndex = Math.floor(index / 8);
        const bitIndex = index % 8;
        this.bitArray[byteIndex] |= 1 << bitIndex;
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

    add(domain: string): void {
        for (let i = 0; i < this.hashFunctions; i++) {
            const hash = this.hash(domain, i);
            this.setBit(hash);
        }
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

    toBase64(): string {
        return this.bitArray.toString('base64');
    }

    getFillRate(): number {
        let setBits = 0;
        for (let i = 0; i < this.bitArray.length * 8; i++) {
            if (this.getBit(i)) setBits++;
        }
        return setBits / (this.bitArray.length * 8);
    }
}

async function validateAndNormalizeDomain(domain: string): Promise<string | null> {
    domain = domain.trim().toLowerCase();
    
    if (!domain || domain.startsWith('#')) {
        return null;
    }

    try {
        if (domain.includes('://')) {
            const url = new URL(domain);
            domain = url.hostname;
        }
    } catch {
        // Continue with original domain if URL parsing fails
    }

    domain = domain.replace(/^www\./, '');
    
    // Basic domain validation
    const domainRegex = /^[a-z0-9][a-z0-9-_.]+[a-z0-9]$/;
    return domainRegex.test(domain) ? domain : null;
}

async function countValidDomains(filePath: string): Promise<number> {
    let count = 0;
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        if (await validateAndNormalizeDomain(line)) {
            count++;
        }
    }

    return count;
}

async function compressBlacklist(
    inputPath: string = 'blacklist.txt',
    targetFalsePositiveRate: number = 0.001
): Promise<void> {
    console.log('Starting blacklist compression...');
    const startTime = Date.now();

    // Resolve paths relative to project root
    const rootDir = process.cwd();
    const absoluteInputPath = path.resolve(rootDir, inputPath);

    // Check input file
    if (!fs.existsSync(absoluteInputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
    }

    // Count valid domains for optimal sizing
    console.log('Counting valid domains...');
    const validDomains = await countValidDomains(absoluteInputPath);
    console.log(`Found ${validDomains.toLocaleString()} valid domains`);

    // Calculate optimal parameters
    const bitsNeeded = Math.ceil(-(validDomains * Math.log(targetFalsePositiveRate)) / (Math.log(2) ** 2));
    const bytesNeeded = Math.ceil(bitsNeeded / 8);
    const hashFunctions = Math.max(1, Math.round((bitsNeeded / validDomains) * Math.log(2)));

    console.log('\nBloom Filter Parameters:');
    console.log(`Size: ${(bytesNeeded / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Hash Functions: ${hashFunctions}`);
    console.log(`False Positive Rate: ${(targetFalsePositiveRate * 100).toFixed(3)}%`);

    // Create bloom filter
    const filter = new BloomFilter(bytesNeeded, hashFunctions);
    const seenDomains = new Set<string>();
    let processed = 0;
    let skipped = 0;
    let duplicates = 0;

    // Process domains
    console.log('\nProcessing domains...');
    const fileStream = fs.createReadStream(absoluteInputPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        const domain = await validateAndNormalizeDomain(line);
        if (domain) {
            if (seenDomains.has(domain)) {
                duplicates++;
                continue;
            }
            seenDomains.add(domain);
            filter.add(domain);
            processed++;
            
            if (processed % 10000 === 0) {
                process.stdout.write(`\rProcessed: ${processed.toLocaleString()} domains`);
            }
        } else {
            skipped++;
        }
    }

    // Convert to base64
    const base64Data = filter.toBase64();

    // Prepare metadata
    const metadata = {
        createdAt: new Date().toISOString(),
        domainsProcessed: processed,
        uniqueDomains: seenDomains.size,
        duplicatesSkipped: duplicates,
        invalidSkipped: skipped,
        hashFunctions,
        falsePositiveRate: targetFalsePositiveRate,
        sizeInBytes: bytesNeeded,
        originalSize: fs.statSync(absoluteInputPath).size,
        fillRate: filter.getFillRate()
    };

    // Create src directory if it doesn't exist
    const srcDir = path.join(rootDir, 'src');
    if (!fs.existsSync(srcDir)) {
        fs.mkdirSync(srcDir, { recursive: true });
    }

    // Generate bloom-data.ts
    const outputPath = path.join(srcDir, 'bloom-data.ts');
    const fileContent = `// Auto-generated by compress-blacklist.ts
export const bloomFilterData = {
    buffer: "${base64Data}",
    hashFunctions: ${hashFunctions},
    metadata: ${JSON.stringify(metadata, null, 2)}
};`;

    fs.writeFileSync(outputPath, fileContent);

    // Print summary
    const endTime = Date.now();
    const originalSizeMB = metadata.originalSize / 1024 / 1024;
    const compressedSizeMB = base64Data.length / 1024 / 1024;
    const compressionRatio = (originalSizeMB / compressedSizeMB).toFixed(2);

    console.log('\nCompression Summary:');
    console.log(`Total lines processed: ${(processed + skipped).toLocaleString()}`);
    console.log(`Valid domains: ${processed.toLocaleString()}`);
    console.log(`Unique domains: ${seenDomains.size.toLocaleString()}`);
    console.log(`Duplicates skipped: ${duplicates.toLocaleString()}`);
    console.log(`Invalid entries skipped: ${skipped.toLocaleString()}`);
    console.log(`Original size: ${originalSizeMB.toFixed(2)} MB`);
    console.log(`Compressed size: ${compressedSizeMB.toFixed(2)} MB`);
    console.log(`Compression ratio: ${compressionRatio}x`);
    console.log(`Base64 size: ${(base64Data.length / 1024).toFixed(2)} KB`);
    console.log(`Filter fill rate: ${(filter.getFillRate() * 100).toFixed(1)}%`);
    console.log(`Processing time: ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
    
    console.log('\nFile created:');
    console.log(`- ${outputPath}`);
}

// Run compression with error handling
try {
    const args = process.argv.slice(2);
    const inputPath = args[0] || 'blacklist.txt';
    const falsePositiveRate = args[1] ? parseFloat(args[1]) : 0.001;

    if (isNaN(falsePositiveRate) || falsePositiveRate <= 0 || falsePositiveRate >= 1) {
        throw new Error('False positive rate must be between 0 and 1');
    }

    compressBlacklist(inputPath, falsePositiveRate).catch(error => {
        console.error('Compression failed:', error);
        process.exit(1);
    });
} catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    console.log('\nUsage: npm run compress [inputFile] [falsePositiveRate]');
    console.log('Example: npm run compress blacklist.txt 0.001');
    process.exit(1);
}