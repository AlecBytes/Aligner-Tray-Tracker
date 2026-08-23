export async function signOutWithLocalScope(auth: {
  signOut(options: { scope: 'local' }): Promise<{ error: unknown | null }>;
}) {
  return auth.signOut({ scope: 'local' });
}
