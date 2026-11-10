// The teacher's screens, one chunk loaded on demand (App.jsx): the board, the class settings, the lessons library, the
// teacher's assistant and the frame of the student view. No student route imports this file.
export { default as Teacher } from '../Teacher.jsx';
export { default as ClassSettings } from './Settings.jsx';
export { default as TeacherLibrary } from './Library.jsx';
export { default as TeacherAssistant } from './TeacherAssistant.jsx';
export { default as PreviewFrame } from '../../components/teacher/PreviewFrame.jsx';
