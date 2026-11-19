# Provider Token Status

A compact status-bar mod that shows one quota card for each model/billing provider represented by the agents in Herdr's left drawer. Pi is intentionally omitted because it is an agent host rather than a provider. The status bar keeps the current machine and agent count on the same line as provider quota cards.

## What you see

At the bottom of the workspace, the existing machine name and total agent count remain on the left. To their right is a horizontally scrollable row of small cards. Each card has a status-colored dot, a provider name, and its weekly quota status. It follows the active Herdr theme. In an Islands layout the card has no top divider.

Known mappings are OpenAI for Codex and ByteDance for Trae CLI. Multiple agents using the same provider produce one card. Pi produces no card. A provider whose CLI does not expose a weekly quota says `not reported`.

## How it behaves

The mod starts with a quota refresh, refreshes whenever Herdr re-renders it after agent/focus data changes (including viewing an agent's terminal), and uses a 12-minute fallback timer. A working, blocked, done, or idle representative agent colors the provider dot. The palette shortcut stays at the far right and opens the command palette when clicked.

For a local Codex agent, the mod launches a short-lived local Codex app server and reads `account/rateLimits/read`; it chooses the longest rate-limit window of at least six days and displays its used percentage as the OpenAI weekly limit. This query uses the signed-in Codex account and contacts ChatGPT through Codex. Other providers are read from the last six lines of a representative agent terminal, but only explicitly labelled `weekly` or `subscription` values are displayed.

## Built from

- `main.js`: GPUI `View` using `spaces()`, `agents()`, `focused()`, `theme()`, `keys()`, `hc()`, `exec()`, `appHome()`, and `props()` from `herdr`.
- `codex_rate_limits.py`: starts `codex app-server --listen stdio://`, sends JSON-RPC `initialize` and `account/rateLimits/read`, then prints the response JSON.
- `mod.json`: `place: none`; place the mod in a layout status block.
- The layout can pass `{ "island": true }` as props to suppress the standard top border.

## Watch out

- This is trusted code. It reads visible agent terminal text with `hc read` and runs `python3` plus `codex app-server`. Codex's app server makes an authenticated network request to ChatGPT. Do not install it if that is not acceptable.
- Herdr does not expose a generic callback for every command that makes no observable state change, so opening and closing an unchanged popup cannot force a refresh. Focus, agent state, space, and tab changes do.
- The provider mapping is intentionally explicit; add a mapping only when its quota belongs to a known billing/model provider. Do not infer a provider from arbitrary terminal output.
- The app regenerates `gpui-kit.d.ts` and `jsconfig.json`; do not distribute them.

## Done when

1. `herdr-app check ~/.config/herdr-app/mods/provider-token-status` passes.
2. With two local Codex agents, the status row shows one OpenAI card, not two.
3. Focusing an agent terminal causes a fresh quota query; no periodic query runs more frequently than every 12 minutes.
4. With `{ "island": true }`, the status card has no top divider.
