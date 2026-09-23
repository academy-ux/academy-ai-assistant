// Import specific Drive docs by ID for a user (e.g. meetings a past bug skipped).
// Usage: npx tsx --env-file=.env.local scripts/import-drive-files.ts <email> <file-with-ids>
import { google } from 'googleapis'
import { readFileSync } from 'fs'
import { supabase } from '@/lib/supabase'
import { decryptToken } from '@/lib/crypto'
import { exchangeRefreshToken } from '@/lib/auth'
import { importDriveFile } from '@/lib/drive-polling'

async function main() {
  const [email, idsPath] = process.argv.slice(2)
  if (!email || !idsPath) throw new Error('Usage: import-drive-files.ts <email> <file-with-ids>')
  const ids = readFileSync(idsPath, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)

  const { data, error } = await supabase
    .from('user_settings')
    .select('encrypted_refresh_token')
    .eq('user_email', email)
    .single()
  if (error || !data?.encrypted_refresh_token) throw new Error(`No token for ${email}`)

  const { accessToken } = await exchangeRefreshToken(decryptToken(data.encrypted_refresh_token))
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  const drive = google.drive({ version: 'v3', auth })

  for (const id of ids) {
    const { data: file } = await drive.files.get({ fileId: id, fields: 'id, name, createdTime, modifiedTime' })
    const result = await importDriveFile(drive, file, email)
    console.log(`${result.padEnd(8)} ${file.createdTime?.slice(0, 10)}  ${file.name}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
