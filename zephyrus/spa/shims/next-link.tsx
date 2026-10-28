import { navigate } from "./next-navigation";

/** next/link for the single-file build: a real link to #name that routes in place. */
export default function Link({ href, onClick, ...rest }: { href: string } & React.ComponentProps<"a">) {
  const path = href.split(/[?#]/)[0];
  const name = path === "/" ? "today" : path.replace(/^\//, "");
  return (
    <a
      href={"#" + name}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(href);
      }}
      {...rest}
    />
  );
}
