# PvP duel (P0)

- Host-authoritative over room.session; the guest sends input only. Rules: ../../../docs/TZ-STEPPE-RAIDERS.md §5–6.
- Rooms open INSIDE the lobby (module.ts openRooms): the host menu's feature window is not closed when a room starts and would cover the game.
- Edge actions travel as counters (dn/qn/rn), so loss/duplication on the unordered "fast" channel cannot drop or repeat a dash.
- No reconnect and no host migration in P0: a confirmed leave ends the match (technical win / aborted).
- Any gameplay number change bumps RULES_VERSION (sim/config.ts).
