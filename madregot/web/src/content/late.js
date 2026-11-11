// The rules of the objects that load after the first screen: content/manip.js asks for this file as soon as it loads,
// and this file asks for the grid shapes' rules (content/grid.js) and for the drawings (components/Figure.jsx). The
// nets', the solids' and the circle's rules (content/net.js, which brings content/roll.js) travel inside the
// drawings' file: every screen that can show them already loads the drawings (the lesson preloads them), so they add
// no file to the first download's list. Each registers its rules with content/manip.js.
import('./grid.js');
import('@/components/Figure.jsx');
