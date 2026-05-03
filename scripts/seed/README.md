# Seed corpers from CSV

This folder contains a simple seed script that reads `NYSC_Corper_Registry_MockData.csv` and inserts rows into the Convex `corpers` table.

## How it works

- `scripts/seed/seed-corpers.ts` reads the CSV file from the repository root.
- It parses the CSV rows and maps them to the Convex `corpers` schema.
- All imported mock records are inserted with `status: 'active'` so they can sign in through the portal.
- The script calls the Convex mutation `corpers.seedCorpers` defined in `convex/corpers.ts`.

## Usage

1. Ensure your Convex URL is available in the environment or in `.env.local`:

```bash
setx NEXT_PUBLIC_CONVEX_URL "https://your-convex-url"
```

or in PowerShell:

```powershell
$env:NEXT_PUBLIC_CONVEX_URL = "https://your-convex-url"
```

If you have a `.env.local` file at the project root, the script now loads it automatically.

2. Run the seed script with a CSV file path:

```bash
pnpm tsx scripts/seed/seed-corpers.ts NYSC_Corper_Registry_MockData.csv
```

or with an explicit path:

```bash
pnpm tsx scripts/seed/seed-corpers.ts path/to/your-file.csv
```

3. Verify inserted corpers in the Convex dashboard or via your app.

## Notes

- The script currently sets every imported item to `status: 'active'`.
- If you rerun the script, duplicate rows may be inserted; you can clear the `corpers` table first or extend the mutation to skip duplicates.
- The script expects the CSV file structure used in `NYSC_Corper_Registry_MockData.csv`.
