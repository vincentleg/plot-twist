# PLOT TWIST — demo

**Open the app and click Run demo.**

http://127.0.0.1:5173 (local, after `npm run dev`).

The guided demo lasts about 2 minutes and runs by itself. Use Pause/Resume and ↺ Restart demo as needed. **Download result** becomes available at the end.

Step 6 (EV resolution) **pauses for a real human decision**: click *Accept limited use* or *Decline*. The demo never decides for you. Only after the server answers ACTIVE does the Gateway open and **Download approved PDF** appear. Otherwise only a PDF marked DRAFT is offered.

Notes for presenters:
- "Recorded analysis • Live permission checks": the demo replays the recorded results of real TokenRouter analyses and real Keenable research. It never calls TokenRouter or Keenable again.
- Every permit change comes from live server calls:
  - creating an experiment copy;
  - masking an excerpt in that copy;
  - finalizing the experiment, which is refused;
  - resetting it;
  - finalizing the original EV mission, which the server refuses with its reason;
  - exporting the Work-from-home result.
- The recorded missions it uses: EV `0a1afcf5-f6d5-484d-b880-1e3eeaa7ba4e` and Work from home `e984e024-2d3c-4509-ac49-b17afffd6132`. Their reports are in `data/reports/`, which Git ignores.
- Everything else (import, analysis, research, human review, masking, editing) lives under **Advanced**.
