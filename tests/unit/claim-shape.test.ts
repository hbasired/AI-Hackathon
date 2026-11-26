import { describe, expect, it } from 'vitest';
import { looksLikeQuestion } from '@/core/claims/shape';

describe('a question typed where a claim belongs', () => {
  it('is recognised, so the page can point to Ask', () => {
    for (const q of [
      'Audit of what is done in this particular paper and how is it relevant to auditing of AI models',
      'Does working from home improve productivity?',
      'How did remote work affect performance',
      'Explain the main findings of this paper',
      'Give me three studies on sleep and memory',
    ]) expect(looksLikeQuestion(q), q).toBe(true);
  });
  it('leaves claims alone', () => {
    for (const c of [
      'Home working led to a 13% performance increase.',
      'Remote work increased productivity by 13%.',
      'Deep learning allows computational models to learn representations of data.',
      'Retracted papers are still cited years after their retraction.',
    ]) expect(looksLikeQuestion(c), c).toBe(false);
  });
});
