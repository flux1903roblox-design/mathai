// A part of a screen that may fail without taking the screen with it: code loaded on demand that cannot load (offline,
// before the service worker has a copy of it). It shows `fallback` (nothing by default) instead, and calls onError once.
// Used for מדי's accessories (he is drawn without them) and the unlock moment (the result goes on; the pieces stay
// new, so the next result shows them).
import { Component } from 'react';

export default class QuietBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError?.(); }
  render() { return this.state.failed ? (this.props.fallback ?? null) : this.props.children; }
}
