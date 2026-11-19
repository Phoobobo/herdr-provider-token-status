import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, focused, theme, run, window, keys, hc, exec, appHome, props } from "herdr";

// Providers expose quota differently, if at all. Only surface an explicitly
// labelled weekly/subscription limit; context-window and per-turn token counts
// are intentionally not treated as a weekly allowance.
function weeklyLimit(screen) {
  const line = screen.split("\n").reverse().find((s) => /(?:weekly|subscription|\(auto\))/i.test(s)) ?? "";
  const named = line.match(/weekly(?:\s+(?:limit|usage))?\s*[:·]?\s*([\d.]+%)\s*(left|used|remaining)?/i);
  return named ? `weekly ${named[1]} ${named[2] ?? ""}`.trim() : "not reported";
}

// Agent CLIs can share one account quota. This mapping deliberately names the
// billing/model provider, so two Codex sessions are one OpenAI card, not two.
const PROVIDERS = {
  codex: { id: "openai", name: "OpenAI" },
  // Add only verified agent-CLI → provider quota mappings here.
};
const providerOf = (agent) => PROVIDERS[agent.app] ?? null;

export default class ProviderTokenStatus extends View {
  init(_props, cx) {
    this.values = {};
    this.refresh(cx);
    // Fallback only: focus and live agent changes refresh immediately below.
    cx.timer.every(12 * 60 * 1000, (cx) => this.refresh(cx));
  }

  refresh(cx) {
    if (this.refreshing) return;
    this.refreshing = true;
    // Pi is an agent host, not a provider; it has no provider quota card.
    const active = agents().filter(providerOf);
    const providers = new Map(active.map((a) => [providerOf(a).id, a]));
    cx.spawn(async (cx) => {
      // Codex's terminal shows context usage, not subscription quota. Its local
      // app-server has the authoritative account/rateLimits/read endpoint.
      let codexWeekly = null;
      if ([...providers.values()].some((a) => a.app === "codex" && !a.address.includes("/"))) {
        try {
          const result = await exec("python3", [`${appHome()}/mods/provider-token-status/codex_rate_limits.py`], { timeout: 10000 });
          const snapshot = JSON.parse(result.stdout);
          const buckets = Object.values(snapshot.rateLimitsByLimitId ?? { default: snapshot.rateLimits ?? {} });
          const windows = buckets.flatMap((bucket) => [bucket.primary, bucket.secondary]).filter(Boolean);
          const weekly = windows.sort((a, b) => (b.windowDurationMins ?? 0) - (a.windowDurationMins ?? 0))[0];
          if (weekly?.usedPercent != null && (weekly.windowDurationMins ?? 0) >= 6 * 24 * 60) codexWeekly = `weekly ${weekly.usedPercent}% used`;
        } catch { /* The provider may be offline or not use a ChatGPT subscription. */ }
      }
      const samples = await Promise.all([...providers].map(async ([provider, a]) => {
        if (provider === "openai" && !a.address.includes("/")) return [provider, codexWeekly ?? "not reported"];
        try {
          const result = await hc(["read", a.address, "--lines", "6"]);
          return [provider, weeklyLimit(result.stdout)];
        } catch { return [provider, "not reported"]; }
      }));
      const next = Object.fromEntries(samples);
      if (JSON.stringify(next) !== JSON.stringify(this.values)) {
        this.values = next;
        cx.notify();
      }
      this.refreshing = false;
    });
  }

  hint() {
    const mac = window()?.platform === "macos";
    const mod = { cmd: mac ? "⌘" : "Ctrl+", ctrl: mac ? "⌃" : "Ctrl+", shift: mac ? "⇧" : "Shift+", alt: mac ? "⌥" : "Alt+", option: mac ? "⌥" : "Alt+" };
    const binding = keys().find((k) => k.section === "global" && k.action === "app.palette");
    const parts = binding && binding.keys.endsWith("--") ? [...binding.keys.slice(0, -2).split("-"), "-"] : binding?.keys.split("-");
    const key = parts?.map((p) => mod[p.toLowerCase()] ?? p.toUpperCase()).join("");
    return key ? `${key}  commands` : "commands";
  }

  render(cx) {
    const t = theme();
    const space = spaces().find((s) => s.active);
    const list = agents();
    // Herdr re-renders this mod after focus and model changes. A newly viewed
    // agent therefore refreshes quota immediately, while the timer is only a
    // 12-minute fallback. The API has no hook for commands that change no live
    // state (for example opening and closing the palette).
    const f = focused();
    const event = `${f?.terminal ?? ""}|${f?.space ?? ""}|${f?.tab ?? ""}|${list.map((a) => `${a.address}:${a.status}:${a.seq}`).join(",")}`;
    if (this.event && this.event !== event) this.refresh(cx);
    this.event = event;
    const active = list.filter(providerOf);
    const providers = [...new Map(active.map((a) => [providerOf(a).id, a])).entries()];
    const needs = list.filter((a) => a.status === "blocked").length;
    const label = (icon, text) => h_flex().gap(6).items_center().child(svg(`mods/workspace-chrome/${icon}.svg`).size(13)).child(text);
    const token = ([provider, a]) => h_flex().id(`usage-${provider}`).h(20).px(7).gap(5).items_center().rounded(5).bg(t.raised).flex_none()
      .child(div().size(6).rounded(3).bg(t[a.status] ?? t.dim))
      .child(div().text_color(t.foreground).font_semibold().child(providerOf(a).name))
      .child(div().text_color(t.muted).child(this.values[provider] ?? "…"));

    return h_flex().size_full().px(14).gap(16).items_center().bg(t.chrome).when(!props()?.island, (el) => el.border_t(1).border_color(t.border)).text_size(11.2).text_color(t.muted)
      .child(label(space?.machine ? "server" : "monitor", space?.machine ?? "This computer"))
      .when(Boolean(space?.branch), (el) => el.child(label("branch", space.branch)))
      .child(h_flex().gap(6).items_center().child(div().size(6).rounded(3).bg(t.dim)).child(`${list.length} agents`)
        .when(needs > 0, (el) => el.child(div().text_color(t.blocked).child(`· ${needs} needs you`))))
      .child(h_flex().flex_1().min_w(0).gap(7).items_center().overflow_x_scrollbar()
        .when(providers.length > 0, (el) => el.children(providers.map(token)))
        .when(providers.length === 0, (el) => el.child(div().text_color(t.dim).child("No provider quotas reported"))))
      .child(div().id("palette").flex_none().text_color(t.dim).on_click(() => run("app.palette")).child(this.hint()));
  }
}
