import { Link, type LinkProps } from "react-router";

type PageTransitionDetail = {
  to: string;
  replace?: boolean;
};

export function PageTransitionLink({
  to,
  replace,
  onClick,
  ...props
}: LinkProps) {
  return (
    <Link
      {...props}
      to={to}
      replace={replace}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }

        event.preventDefault();
        window.dispatchEvent(
          new CustomEvent<PageTransitionDetail>("page-transition:navigate", {
            detail: {
              to: typeof to === "string" ? to : to.pathname ?? "",
              replace,
            },
          }),
        );
      }}
    />
  );
}
