// Step factories shared by all lessons.
//
// A step is: { kind: 'explore' | 'check', title, text (markdown + $math$), widget, config, init,
//              ready(v), check(v) → true | { msg }, solve(v) → v, hint, explain }
// 'explore' = free play, continue once touched. 'check' = must be answered (feedback + retry).
import Choice from '@/components/learn/Choice';
import NumberAnswer from '@/components/learn/NumberAnswer';
import { parseNum } from '@/lib/answers';

export function choice({ title, text, options, answer, feedback = {}, explain, hint }) {
  return {
    kind: 'check',
    title,
    text,
    widget: Choice,
    config: { options, answer },
    init: { selected: null },
    ready: (v) => v.selected != null,
    check: (v) => (v.selected === answer ? true : { msg: feedback[v.selected] || 'זו לא התשובה הנכונה. חשוב שוב ונסה עוד פעם!' }),
    solve: () => ({ selected: answer }),
    explain,
    hint,
  };
}

export function numberQ({ title, text, answer, tol = 1e-6, suffix, prefix, explain, hint, feedback }) {
  return {
    kind: 'check',
    title,
    text,
    widget: NumberAnswer,
    config: { suffix, prefix },
    init: { text: '' },
    ready: (v) => v.text.trim() !== '',
    check: (v) => {
      const n = parseNum(v.text);
      if (n == null) return { msg: 'הקלד מספר — למשל $4$, $-2.5$ או $1/2$.' };
      if (Math.abs(n - answer) <= tol) return true;
      return { msg: feedback?.(n) || 'לא בדיוק. בדוק את החישוב ונסה שוב.' };
    },
    solve: () => ({ text: String(answer) }),
    explain,
    hint,
  };
}
