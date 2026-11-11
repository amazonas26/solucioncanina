// Markdown en línia mínim per a textos curts del frontmatter (respostes de FAQ):
// només **negreta** i [text](url). Tota la resta s'escapa.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const BOLD_RE = /\*\*(.+?)\*\*/g;

export function inlineMarkdownToHtml(text: string): string {
  return escapeHtml(text)
    .replace(LINK_RE, (_, label: string, href: string) => `<a href="${href}">${label}</a>`)
    .replace(BOLD_RE, '<strong>$1</strong>');
}

export function stripInlineMarkdown(text: string): string {
  return text.replace(LINK_RE, '$1').replace(BOLD_RE, '$1');
}
