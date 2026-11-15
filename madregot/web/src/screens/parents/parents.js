// The parents' area, loaded as one chunk on demand (App.jsx).
import '@/styles/lazy/shared.css'; // the rules this screen shares with other screens loaded on demand, out of the first load (COUNCIL2-20)
export { default as Parents } from './Parents.jsx';
export { default as ParentHandoff } from './ParentHandoff.jsx';
export { default as Legal } from './Legal.jsx';
export { default as SharedReport } from './SharedReport.jsx';
