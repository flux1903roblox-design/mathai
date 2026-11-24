// The cards that can stand above the home path (PRODUCT2-40, the council's painful moment #2: the install banner and
// the repair card pushed the path below the fold). At most one stands there, the most important one; the others wait
// where they also live:
//   repair   the streak's repair for a missed school day (RepairCard); its button goes to the plan's next step
//   work     the teacher's work due within 3 days (the chip to the missions tab, which lists it with a dot)
//   next     the plan's next step when it is not a stop of the map (NextBanner; the missions tab leads with it too)
//   install  the iPhone Home Screen guide (durable InstallCard); when another card wins it sits under the path
// The daily reminder is offered at the end of a lesson (LessonDone), never on the home screen, so it is not here.
// Status lines are not cards and are not ranked: no internet (OfflineChip) and a browser that cannot save
// (StorageBanner) always say so.

export const HOME_CARDS = ['repair', 'work', 'next', 'install'];

/** The one card above the path: the first of HOME_CARDS that is up (`on[name]` truthy), or null. */
export const homeCard = (on) => HOME_CARDS.find((name) => !!on?.[name]) ?? null;
