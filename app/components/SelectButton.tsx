import type { Stage } from "~/stages";
import { PageTransitionLink } from "~/components/PageTransitionLink";

export type SelectButtonProps = {
  stageNumber: number;
  className?: string;
};

export function SelectButton({
  stageNumber,
  className = "",
}: SelectButtonProps) {
  const targetUrl = `/play/${stageNumber}`;

  return (
    <PageTransitionLink
      to={targetUrl}
      transition="blur"
      className={`flex items-center justify-center aspect-square w-full bg-[#616161] hover:bg-[#525252] active:bg-[#3d3d3d] text-white text-5xl font-serif select-none transition-all duration-150 hover:scale-110 active:scale-90 ${className}`}
    >
      {stageNumber}
    </PageTransitionLink>
  );
}
