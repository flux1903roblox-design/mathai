// motion's animation features (COUNCIL2-14), loaded after the first screen by App.jsx's LazyMotion. Every screen
// draws with m.* components, which carry none of this until it arrives.
import { domAnimation } from 'motion/react';

export default domAnimation;
