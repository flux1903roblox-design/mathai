const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };


export const FREE_ACTIONS = 5;

export function isPro(user) {
  return !!user?.subscription_plan && user.subscription_plan !== 'none' && user.subscription_plan !== 'free';
}

export function getActions(user) {
  if (!user) return 0;
  if (isPro(user)) return Infinity;
  return user.actions_remaining ?? FREE_ACTIONS;
}

export function actionsDisplay(user) {
  const a = getActions(user);
  if (a === Infinity) return '∞';
  return a;
}

export async function setProfile({ grade, track }) {
  return db.auth.updateMe({ grade, track: track || null, actions_remaining: FREE_ACTIONS });
}

export async function consumeAction(user) {
  if (isPro(user)) return Infinity;
  const cur = user?.actions_remaining ?? FREE_ACTIONS;
  const next = Math.max(0, cur - 1);
  await db.auth.updateMe({ actions_remaining: next });
  return next;
}

export async function grantActions(n) {
  const me = await db.auth.me();
  if (isPro(me)) return Infinity;
  const cur = me.actions_remaining ?? 0;
  await db.auth.updateMe({ actions_remaining: cur + n });
  return cur + n;
}

export async function activateSubscription(plan) {
  await db.auth.updateMe({ subscription_plan: plan });
}