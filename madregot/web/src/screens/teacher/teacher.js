// The teacher's screens, one chunk loaded on demand (App.jsx): the board, the class settings, the lessons library, the
// teacher's assistant, the class exam (its builder and its printable sheet), the class report, the pilot kit, the frame
// of the student view and the demo class's banner. No student route imports this file.
export { default as Teacher } from '../Teacher.jsx';
export { default as ClassSettings } from './Settings.jsx';
export { default as TeacherLibrary } from './Library.jsx';
export { default as TeacherAssistant } from './TeacherAssistant.jsx';
export { default as TeacherExamNew } from './ExamNew.jsx';
export { default as TeacherExamSheet } from './ExamSheet.jsx';
export { default as ClassReport } from './Report.jsx';
export { default as TeacherGuide } from './Guide.jsx';
export { default as PreviewFrame } from '../../components/teacher/PreviewFrame.jsx';
export { default as DemoBanner } from '../../components/teacher/DemoBanner.jsx';
