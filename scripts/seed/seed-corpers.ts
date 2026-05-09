import * as fs from 'fs'
import * as path from 'path'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../convex/_generated/api'

function loadDotEnv(filePath: string) {
    if (!fs.existsSync(filePath)) return
    const envContents = fs.readFileSync(filePath, 'utf-8')
    for (const rawLine of envContents.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#') || !line.includes('=')) continue
        const [key, ...rest] = line.split('=')
        const value = rest.join('=').trim().replace(/^\"|\"$/g, '')
        if (process.env[key] === undefined) {
            process.env[key] = value
        }
    }
}

loadDotEnv(path.resolve(process.cwd(), '.env.local'))
loadDotEnv(path.resolve(process.cwd(), '.env'))

type SeedCorper = {
    callUpNumber: string
    stateCode: string
    status: string
    fullName: string
    batch: string
    deploymentUnit: string
    createdAt: number
}

function parseCsv(csvText: string, forceActive = false): SeedCorper[] {
    const lines = csvText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

    if (lines.length < 3) {
        throw new Error('CSV file does not contain enough rows.')
    }

    const dataLines = lines.slice(2)
    return dataLines
        .map((line) => line.split(',').map((cell) => cell.trim()))
        .filter((cells) => cells.length >= 8 && cells[1].length > 0)
        .map((cells) => ({
            fullName: cells[0],
            callUpNumber: cells[1].toUpperCase(),
            stateCode: cells[2].toUpperCase(),
            batch: cells[4],
            deploymentUnit: cells[6],
            // Preserve the CSV status exactly, because this is the service/batch status.
            status: forceActive ? 'ACTIVE' : (cells[7] || 'ACTIVE').toUpperCase(),
            createdAt: Date.now(),
        }))
}

function getCsvPathFromArgs(): string {
    const providedPath = process.argv[2]
    if (!providedPath) {
        throw new Error('Usage: pnpm tsx scripts/seed/seed-corpers.ts <path-to-csv>')
    }
    return path.resolve(process.cwd(), providedPath)
}

async function main() {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL
    if (!convexUrl) {
        throw new Error('Set NEXT_PUBLIC_CONVEX_URL or CONVEX_URL before running this script.')
    }

    const csvPath = getCsvPathFromArgs()
    if (!fs.existsSync(csvPath)) {
        throw new Error(`Could not find mock data CSV at ${csvPath}`)
    } 

    const csvText = fs.readFileSync(csvPath, 'utf-8')
    const forceActive = process.argv.includes('--force-active') || process.argv.includes('--active')
    const corpers = parseCsv(csvText, forceActive)

    if (forceActive) {
        console.log('Seeding corpers with status=ACTIVE (force active mode).')
        console.log('WARNING: this overrides the CSV status field, which is usually the batch/service status.')
    }

    if (corpers.length === 0) {
        console.log('No corper rows were parsed from the CSV.')
        return
    }

    const client = new ConvexHttpClient(convexUrl)
    const batchSizeRaw = process.env.SEED_BATCH_SIZE
    // Keep this small by default so we don't hit Convex transaction read/write limits.
    const batchSize = Math.max(1, Number.parseInt(batchSizeRaw ?? '50', 10) || 50)
    console.log(`Seeding ${corpers.length} corpers in batches of ${batchSize}...`)

    for (let i = 0; i < corpers.length; i += batchSize) {
        const batch = corpers.slice(i, i + batchSize)
        const result = await client.mutation(api.corpers.seedCorpers, { corpers: batch })
        console.log(
            `Seeded ${Math.min(i + batch.length, corpers.length)}/${corpers.length} corpers`,
            result
        )
    }

}

main().catch((error) => {
    console.error('Seed script failed:', error)
    process.exit(1)
})
