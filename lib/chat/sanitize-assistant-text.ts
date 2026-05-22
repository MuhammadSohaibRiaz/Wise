/** Remove model-hallucinated tool-call markup from visible chat text. */
export function stripPseudoToolCalls(text: string): string {
  return text
    .replace(/<function\s*\(\s*updateProfile\s*\)\s*\{[\s\S]*?\}\s*(?:<\/function>)?/gi, "")
    .replace(/<function\s*\(\s*\w+\s*\)\s*\{[\s\S]*?\}\s*(?:<\/function>)?/gi, "")
    .replace(/<function[\s\S]*?<\/function>/gi, "")
    .replace(/<function[^>]*\/>/gi, "")
    .replace(/^\s*<function[^]*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
