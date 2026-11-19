# Provider Token Status for Herdr

One compact status-bar card per model/billing provider, rather than one per agent CLI.

## What it does

- Groups local Codex sessions under **OpenAI**; add verified provider mappings as needed.
- Excludes Pi because Pi is an agent host, not a provider.
- Queries the local Codex app server for the longest available weekly rate-limit window.
- Refreshes when Herdr focus or agent data changes, with a 12-minute fallback refresh.
- Supports Islands layouts with `props: { "island": true }` to remove the top divider.

## Install

Copy this repository's files into:

```text
~/.config/herdr-app/mods/provider-token-status/
```

Then set a layout status block to:

```json
{
  "id": "status",
  "type": "block",
  "content": {
    "mod": "provider-token-status",
    "props": { "island": true }
  },
  "size": { "px": 28 }
}
```

Omit `props.island` for a regular status bar.

Validate with:

```sh
herdr-app check ~/.config/herdr-app/mods/provider-token-status
```

## Privacy and permissions

This is trusted local code. It reads visible agent terminal text using `hc read`. For a local Codex agent, it runs `python3` and `codex app-server`; Codex then makes an authenticated request to ChatGPT to obtain account rate limits. Do not install it if that access is not acceptable.

## Development

The full build specification is in [RECIPE.md](RECIPE.md). Herdr generates `gpui-kit.d.ts` and `jsconfig.json` locally, so they are intentionally excluded from this repository.
