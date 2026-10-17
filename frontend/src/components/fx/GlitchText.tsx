import type { ElementType } from "react";

export function GlitchText({
  text,
  as: Tag = "span",
  className = "",
}: {
  text: string;
  as?: ElementType;
  className?: string;
}) {
  return (
    <Tag className={`glitch ${className}`} data-text={text}>
      {text}
    </Tag>
  );
}
