// Uso: node scripts-set-admin.mjs tu-email@ejemplo.com
import 'dotenv/config'
import { createClerkClient } from '@clerk/express'

const email = process.argv[2]
if (!email) { console.error('Uso: node scripts-set-admin.mjs <email>'); process.exit(1) }

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
const { data: users } = await clerk.users.getUserList({ emailAddress: [email] })
if (!users.length) { console.error('No se encontró usuario con ese email. ¿Ya te registraste en el sitio?'); process.exit(1) }

const u = users[0]
await clerk.users.updateUserMetadata(u.id, { publicMetadata: { role: 'admin' } })
console.log(`✓ ${email} (${u.id}) ahora es ADMIN`)
