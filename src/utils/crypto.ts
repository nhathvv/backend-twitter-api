
import { createHash } from 'node:crypto'
import { envConfig } from '~/constants/config'
function sha256(content: string) {
  return createHash('sha256').update(content).digest('hex')
}
export const hashPassword = (password: string) => {
  return sha256(password + envConfig.passwordSecret)
}
