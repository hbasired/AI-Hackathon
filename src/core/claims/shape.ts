/**
 * Whether the text in the claim box reads like a question or a task rather than a claim. Only a gentle hint:
 * it never changes a label and never blocks a check. A claim is a sentence the student wants to write.
 */
const OPENERS = /^(what|how|why|which|who|whom|whose|when|where|whether|does|do|did|is|are|was|were|can|could|should|would|will|has|have|explain|describe|summari[sz]e|compare|discuss|list|give me|tell me|find|show me|check|audit of)\b/i;
const ASKING = /\b(what|how|why|which)\s+(is|are|was|were|does|do|did|can|could|it|they|this|these)\b/i;

export function looksLikeQuestion(text: string): boolean {
  const t = text.trim();
  if (t.split(/\s+/).length < 3) return false;
  if (/\?\s*$/.test(t)) return true;
  if (OPENERS.test(t)) return true;
  return ASKING.test(t);
}
