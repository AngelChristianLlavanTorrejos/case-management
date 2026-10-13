import { supabase } from '@/lib/supabase'

export type AdminPasswordMemberScope = 'community' | 'lupon'

function rpcError(message: string) {
  return new Error(message.replace(/^.*ERROR:\s*/i, ''))
}

export async function superAdminSetMemberPassword(
  actorUserId: number,
  targetUserId: number,
  newPassword: string,
  scope: AdminPasswordMemberScope,
): Promise<void> {
  const { error } = await supabase.rpc('super_admin_set_user_password', {
    p_actor_user_id: actorUserId,
    p_target_user_id: targetUserId,
    p_new_password: newPassword,
    p_member_scope: scope,
  })
  if (error) throw rpcError(error.message)
}
