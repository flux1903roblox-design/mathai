import clsx from 'clsx';

/**
 * The top of a tab's own screen: the screen's name, large, and one line about what it is for. White, like the
 * rest of the screen; no colour block and no illustration (round 17). tone, scene and mood are accepted and
 * ignored, so the screens that pass them keep working.
 */
// eslint-disable-next-line no-unused-vars
export default function PageHero({ tone, title, sub, scene, mood, children, id }) {
  return (
    <header className={clsx('page-hero')} data-region="header">
      <div className="page-hero-text">
        <h1 id={id} className="page-hero-title">{title}</h1>
        {sub && <p className="page-hero-sub">{sub}</p>}
        {children}
      </div>
    </header>
  );
}
