import type { User } from '../types/user.types'

export const canUseOceanEngineBatchAdCreate = (user?: User | null): boolean => {
  if (!user) return false
  if (user.role === 'admin' || user.role === 'manager') return true
  return user.role === 'user' && user.parent_user_id != null
}
