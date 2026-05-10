export interface PayloadDoc {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  bio?: string;
  content?: string;
  role?: string;
  status?: string;
  [key: string]: any;
}

/**
 * Extract and flatten all relevant text from a Payload document
 * Returns full text without char limit (chunking happens in the RAG layer)
 */
export function extractDocumentText(
  doc: PayloadDoc,
  collection: string
): string[] {
  const textParts: string[] = [];

  // Collection-specific extraction
  switch (collection) {
    case "projects":
      if (doc.title) textParts.push(`Project: ${doc.title}`);
      if (doc.description) textParts.push(`Description: ${doc.description}`);
      // if (doc.status) textParts.push(`Status: ${doc.status}`);
      // if (doc.priority) textParts.push(`Priority: ${doc.priority}`);
      // Extract collaborator names if populated
      if (doc.collaborators && Array.isArray(doc.collaborators)) {
        const names = doc.collaborators
          .map((c: any) => c.name || c)
          .join(", ");
        if (names) textParts.push(`Team: ${names}`);
      }
      break;

    case "team":
      if (doc.name) textParts.push(`Team Member: ${doc.name}`);
      if (doc.role) textParts.push(`Role: ${doc.role}`);
      if (doc.bio) textParts.push(`Bio: ${doc.bio}`);
      if (doc.skills && Array.isArray(doc.skills)) {
        const skillNames = doc.skills
          .map((s: any) => s.skill || s)
          .join(", ");
        if (skillNames) textParts.push(`Skills: ${skillNames}`);
      }
      if (doc.projects && Array.isArray(doc.projects)) {
        const projectNames = doc.projects
          .map((p: any) => p.title || p)
          .filter((p: any) => typeof p === "string")
          .join(", ");
        if (projectNames) textParts.push(`Projects: ${projectNames}`);
      }
      if (doc.email) textParts.push(`Email: ${doc.email}`);
      break;

    // case "blogs":
    //   if (doc.title) textParts.push(`Blog Title: ${doc.title}`);
    //   // Extract text from richText content
    //   if (doc.content) {
    //     const plainText = extractRichTextContent(doc.content);
    //     if (plainText) textParts.push(`Content: ${plainText}`);
    //   }
    //   // Categories
    //   if (doc.categories && Array.isArray(doc.categories)) {
    //     const catNames = doc.categories
    //       .map((c: any) => c.title || c.name || c)
    //       .join(", ");
    //     if (catNames) textParts.push(`Categories: ${catNames}`);
    //   }
    //   break;

    // case "pages":
    //   if (doc.title) textParts.push(`Page: ${doc.title}`);
    //   if (doc.content) {
    //     const plainText = extractRichTextContent(doc.content);
    //     if (plainText) textParts.push(`Content: ${plainText}`);
    //   }
    //   break;

    default:
      // // Generic extraction for unknown collections
      // if (doc.title) textParts.push(doc.title);
      // if (doc.name) textParts.push(doc.name);
      // if (doc.description) textParts.push(doc.description);
      // if (doc.content) textParts.push(doc.content);
      break;
  }

  return textParts.filter((t) => t.length > 0);
}

/**
 * Extract plain text from Payload's richText (Lexical) structure
 */
function extractRichTextContent(content: any): string {
  if (typeof content === "string") return content.substring(0, 1000);

  if (content?.root?.children) {
    const texts: string[] = [];
    const traverse = (nodes: any[]) => {
      nodes.forEach((node: any) => {
        if (node.text) texts.push(node.text);
        if (node.children) traverse(node.children);
      });
    };
    traverse(content.root.children);
    return texts.join(" ").substring(0, 1000);
  }

  return "";
}

/**
 * Split text into chunks (max ~300 chars to respect token limits)
 * This keeps semantic meaning while respecting embedding API limits
 */
export function chunkText(text: string, chunkSize: number = 300): string[] {
  if (text.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    // Don't cut in the middle of a sentence
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf(".", end);
      const lastNewline = text.lastIndexOf("\n", end);
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > start) {
        end = breakPoint + 1;
      }
    }

    chunks.push(text.substring(start, end).trim());
    start = end;
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

// Add this at the very end of the file
export default { extractDocumentText, chunkText };