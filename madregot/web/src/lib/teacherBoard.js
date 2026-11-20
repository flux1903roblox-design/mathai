// The board's last dashboard of each class, in memory for this visit only (nothing is written to the device): the class
// report opens a student's page from a name with it (TEACHER-8), since the report itself carries no student ids. When
// the report is opened first (a reload, a link), it asks for the dashboard once.
import { useCallback, useEffect, useState } from 'react';
import { teacherApi } from './teacher.js';

const boards = new Map();
/** The board keeps its newest dashboard here. */
export const rememberBoard = (code, data) => { if (code && data) boards.set(code, data); };
/** The class's last dashboard this visit, or null. */
export const boardOf = (code) => boards.get(code) || null;
/** A student's name → id (a name is unique in its class: joining with a name already there is that same student). */
export const idsByName = (board) => Object.fromEntries((board?.students || []).map((s) => [s.name, s.id]));

/** The class's dashboard: the one the board kept, else fetched once. { board, reload }. */
export function useBoard(cls) {
  const [board, setBoard] = useState(() => boardOf(cls.code));
  const reload = useCallback(async () => {
    try { const d = await teacherApi('/api/teacher/dashboard', {}, cls); rememberBoard(cls.code, d); setBoard(d); } catch { /* the names stay plain text */ }
  }, [cls]);
  useEffect(() => { const kept = boardOf(cls.code); if (kept) setBoard(kept); else reload(); }, [cls.code]); // eslint-disable-line react-hooks/exhaustive-deps
  return { board, reload };
}
