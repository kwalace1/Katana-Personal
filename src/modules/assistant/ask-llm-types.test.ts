import { describe, expect, it } from 'vitest'
import { ASK_TOOL_DEFINITIONS, ASK_TOOL_NAMES } from './ask-llm-types'
import {
  ASK_TOOL_DEFINITIONS as ApiTools,
  ASK_TOOL_NAMES as ApiNames,
} from '../../../api/ask-llm-core'

describe('Ask LLM shared types', () => {
  it('keeps API and client tool definitions identical', () => {
    expect(ApiNames).toEqual(ASK_TOOL_NAMES)
    expect(ApiTools.map((t) => t.function.name)).toEqual(ASK_TOOL_DEFINITIONS.map((t) => t.function.name))
  })
})
