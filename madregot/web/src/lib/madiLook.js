// Madi's look in the student's own app (STUDENT-3). The student routes are wrapped in <MadiLookProvider>, which reads
// the saved look from the store; every <Mascot> inside draws it, so none of the 32 places that show Madi change.
// Outside it (the teacher's screens, the parents' area, the welcome screen) Madi has the default look.
import { createContext, createElement, lazy, useContext, useEffect, useMemo, useState } from 'react';
import { useApp } from './store.js';
import { DEFAULT_LOOK, cleanLook, ownedLook, newUnlocks, orderUnlocks } from './wardrobe.js';
import { topicsFor } from '@/content/topics.js';

/** { color, head, face, neck, body, classColor }: classColor is the colour of the class scarf (the grade's first unit). */
const MadiLook = createContext({ ...DEFAULT_LOOK, classColor: 'sky' });

export const useMadiLook = () => useContext(MadiLook);

export function MadiLookProvider({ children }) {
  const look = useApp((s) => s.look);
  const grade = useApp((s) => s.profile?.grade);
  const value = useMemo(() => ({ ...cleanLook(look), classColor: topicsFor(grade || '7')[0]?.color || 'sky' }), [look, grade]);
  return createElement(MadiLook.Provider, { value }, children);
}

const loadUnlockStage = () => import('@/components/learn/UnlockStage.jsx');
/** The unlock moment (components/learn/UnlockStage.jsx), loaded on demand: most results bring nothing new. */
export const UnlockStage = lazy(loadUnlockStage);

/**
 * The pieces a result brings to show (STUDENT-3): what the student owns and has not been shown, worked out once as the
 * result opens (so it stays put after markEarned), the result's own unit first. [] when there is nothing new. When
 * there is something, the moment's code starts loading at once, so it is there by the time the student goes on.
 */
export function useNewUnlocks(topic) {
  const [ids] = useState(() => {
    const { path, classGoals, profile, look } = useApp.getState();
    return orderUnlocks(newUnlocks(ownedLook({ path, classGoals, grade: profile?.grade, earned: look?.earned }), look?.seen), topic);
  });
  useEffect(() => { if (ids.length) loadUnlockStage(); }, [ids]);
  return ids;
}
