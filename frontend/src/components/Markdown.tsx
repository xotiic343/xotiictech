import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Safe markdown: raw HTML is not rendered (react-markdown default), links open safely. */
export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`prose-x ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const external = href?.startsWith("http");
            return (
              <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {children}
              </a>
            );
          },
          // eslint-disable-next-line @next/next/no-img-element
          img: ({ src, alt }) => <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
