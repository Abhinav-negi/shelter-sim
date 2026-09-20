// apps/web/components/meta/locale/aggregator.ts
//
// T-52(d): "The locale switch aggregates each component's own messages.ts
// into lib/i18n.ts's registry; you own only the aggregator, never another
// component's message file."
//
// lib/i18n.ts (T-36, off this task's allow-list) is a REGISTRY: `t(key)`
// just reads from it. A component's own messages.ts populates it as an
// IMPORT SIDE EFFECT (`registerMessages(...)` runs at module load), so
// nothing renders translated until every such module has actually been
// imported somewhere. This file is that "somewhere" -- the one place that
// guarantees registration happened before `<LocaleSwitch>` (or anything
// else in components/meta) ever calls `t()`.
//
// As of T-52, this component's own `../messages` is the ONLY messages.ts
// anywhere under apps/web/components (verified: `find apps/web/components
// -iname messages.ts` returns only this task's own file) -- no other
// component registers translated strings yet, so Hindi cannot currently
// change labels outside components/meta (see this task's Evidence block,
// reported upward per LOG.md rule 16, not silently routed around). When a
// future component adds its own `messages.ts`, this is the file its side-
// effect import belongs in -- add one line here, never edit that
// component's own file (this task's allow-list is components/meta/** only).

import '../messages';
import '../../inputs/messages';
import '../../kpis/messages';

export {};
