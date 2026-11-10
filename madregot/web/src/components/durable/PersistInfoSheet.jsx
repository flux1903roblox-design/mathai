// "מתי דפדפן מוחק נתונים" (DURABLE-3): the info button beside "שמירה קבועה בדפדפן" opens it. What a browser may delete,
// when, and the safe way. The backup code joins the last line when it exists (DURABLE-5); today the file is the backup.
import { Button, Sheet } from '@/components/ui.jsx';

export const PERSIST_INFO = [
  'דפדפנים מוחקים לפעמים נתונים של אתרים כשהמכשיר מתמלא.',
  'בספארי באייפון, נתונים של אתר שלא נפתח במשך שבעה ימים של שימוש בספארי עלולים להימחק. אפליקציה שהוספתם למסך הבית לא נמחקת כך.',
  'הדרך הבטוחה ביותר היא לשמור קובץ גיבוי.',
];

export default function PersistInfoSheet({ open, onOpenChange }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="מתי דפדפן מוחק נתונים">
      <div className="persist-info">
        {PERSIST_INFO.map((line) => <p key={line}>{line}</p>)}
        <Button className="btn-block" onClick={() => onOpenChange(false)}>הבנתי</Button>
      </div>
    </Sheet>
  );
}
