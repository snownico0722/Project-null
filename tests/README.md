# Local regression suite

Run the complete offline suite from the repository root:

```bash
npm install
npm test
```

The suite covers identity and avatar replacement, decorations, signatures, hidden topics,
title cleaning, quotes, notifications, reply references, boost bubbles, user-card reuse,
pure mode, topic/time identity scopes, expiry resets, native alias mentions, settings writes,
dynamic DOM rebuilds, restoration, and bounded DOM-query/style-read/root-coalescing tests.

Every `*-test.html` page can also be opened directly in a browser. A page passes when its
JSON output contains `"failures":false`.
