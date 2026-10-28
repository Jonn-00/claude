import { useMemo, useSyncExternalStore } from "react";

/*
  next/navigation for the single-file build. A hosted artifact keeps only a
  plain #name in its address, so each page is a hash (#channels) and any
  query (?lead=…) or in-page anchor lives in memory instead.
*/

type Loc = { path: string; search: string };
const toPath = (hash: string) => {
  const name = hash.replace(/^#/, "");
  return !name || name === "today" ? "/" : "/" + name;
};
let loc: Loc = { path: typeof location === "undefined" ? "/" : toPath(location.hash), search: "" };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    const path = toPath(location.hash);
    if (path !== loc.path) {
      loc = { path, search: "" };
      emit();
    }
  });
}

export function navigate(href: string) {
  const [rest, anchor] = href.split("#");
  const [path, search = ""] = rest.split("?");
  const name = path === "/" ? "today" : path.replace(/^\//, "");
  const changed = loc.path !== (path || "/");
  loc = { path: path || "/", search };
  if (location.hash.replace(/^#/, "") !== name) {
    try {
      history.pushState(null, "", "#" + name);
    } catch {
      location.hash = name;
    }
  }
  emit();
  requestAnimationFrame(() => {
    if (anchor) document.getElementById(anchor)?.scrollIntoView({ block: "start" });
    else if (changed) window.scrollTo(0, 0);
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function usePathname() {
  return useSyncExternalStore(subscribe, () => loc.path, () => "/");
}

export function useSearchParams() {
  const search = useSyncExternalStore(subscribe, () => loc.search, () => "");
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function useRouter() {
  return { push: navigate, replace: navigate, back: () => history.back(), refresh: () => {}, prefetch: () => {} };
}
