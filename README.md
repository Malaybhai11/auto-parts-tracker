# Auto Parts Tracker PWA

A mobile-first Progressive Web App (PWA) for tracking automotive workshop parts usage. Built with Next.js 16, Supabase, and ZXing.

## Features
- **Create Repair Orders (RO)**: Manual entry of RO numbers.
- **Barcode Scanning**: Use mobile camera to scan part barcodes.
- **Offline Support**: Caches scans locally if offline and syncs when back online.
- **Finalization**: Locks ROs and creates an immutable snapshot for billing.
- **Export**: Download finalized ROs as CSV.

## Setup Instructions

### 1. Database Setup (Supabase)
1. Create a new Supabase project.
2. Go to the **SQL Editor**.
3. Copy the contents of `schema.sql` from this repository.
4. Paste and run the SQL script to create tables and the finalization RPC function.

### 2. Environment Variables
1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Fill in your Supabase credentials:
   - `NEXT_PUBLIC_SUPABASE_URL`: Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public Anon Key
   - `SUPABASE_SERVICE_ROLE_KEY`: Service Role Key (Keep secret! Used for server-side mutations)

### 3. Run Locally
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` (or your local IP on mobile for camera testing).

### 4. Deploy to Vercel
1. Push code to GitHub.
2. Import project in Vercel.
3. Add the Environment Variables from step 2.
4. Deploy.

## Testing (QA Script)

### Mobile / PWA Test
1. **Open App**: Navigate to the deployed URL on your mobile.
2. **Install PWA**: Tap "Share" -> "Add to Home Screen" (iOS) or "Install App" (Android).
3. **Create RO**:
   - Enter a new RO number (e.g., "RO-999").
   - Tap "Start RO".
4. **Scan Parts**:
   - Tap "Scan Barcode".
   - Point camera at a barcode (e.g., a product box or generated QR code).
   - Verify part appears in the list.
   - Scan same barcode again to increment quantity.
5. **Edit/Delete**:
   - Tap the "Edit" (pencil) icon to change quantity manually.
   - Tap "Delete" (trash) icon to remove a part.
6. **Offline Test**:
   - Turn off Wi-Fi/Data (Airplane Mode).
   - Scan a barcode.
   - Verify "Offline scans pending" banner appears.
   - Turn Wi-Fi back on.
   - Tap "Sync" button.
   - Verify scans are synced to server.
7. **Finalize**:
   - Tap "Finalize RO".
   - Confirm dialog.
   - Verify redirected to Dashboard.
   - Verify RO status is "FINAL".
8. **Export**:
   - Go to "Finals" page.
   - Find your RO.
   - Tap the Download icon.
   - Verify CSV contains correct data.

## Folder Structure
- `app/`: Next.js App Router pages.
- `components/`: React components (Scanner, Dashboard, etc.).
- `actions/`: Server Actions for backend logic.
- `utils/`: Supabase helpers.
- `public/`: Static assets and manifest.
