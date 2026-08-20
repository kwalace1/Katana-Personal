import { describe, expect, it } from 'vitest'
import { nestFeedComments, type FeedComment } from './feed-engagement'

function comment(partial: Partial<FeedComment> & Pick<FeedComment, 'id'>): FeedComment {
  return {
    postId: 'p1',
    authorId: 'u1',
    text: partial.id,
    createdAt: '2026-08-19T00:00:00.000Z',
    parentId: null,
    likeCount: 0,
    likedByMe: false,
    ...partial,
  }
}

describe('nestFeedComments', () => {
  it('keeps top-level comments as roots and groups replies', () => {
    const nested = nestFeedComments([
      comment({ id: 'a' }),
      comment({ id: 'b', parentId: 'a' }),
      comment({ id: 'c' }),
      comment({ id: 'd', parentId: 'a' }),
    ])
    expect(nested.roots.map((c) => c.id)).toEqual(['a', 'c'])
    expect(nested.repliesByParent.a?.map((c) => c.id)).toEqual(['b', 'd'])
    expect(nested.repliesByParent.c).toBeUndefined()
  })

  it('flattens replies-to-replies onto the root comment', () => {
    const nested = nestFeedComments([
      comment({ id: 'root' }),
      comment({ id: 'reply', parentId: 'root' }),
      comment({ id: 'nested', parentId: 'reply' }),
    ])
    expect(nested.roots.map((c) => c.id)).toEqual(['root'])
    expect(nested.repliesByParent.root?.map((c) => c.id)).toEqual(['reply', 'nested'])
  })
})
