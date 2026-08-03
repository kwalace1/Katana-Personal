export interface ScoringCriterion {
  name: string
  weight: number
  evaluator: 'contains' | 'regex' | 'tool_used' | 'llm_judge'
  expected: string
}

export type EvalSuite = 'core' | 'swe-bench-lite' | 'gaia-l1' | 'tool-use' | 'code-action'

export interface EvalScenario {
  id: string
  name: string
  category: 'coding' | 'research' | 'companionship' | 'multi-step' | 'memory' | 'planning' | 'tool-usage' | 'long-lived'
  description: string
  userMessage: string
  expectedBehaviors: string[]
  scoringCriteria: ScoringCriterion[]
  timeoutMs: number
  tools: string[]
  fixtures?: EvalScenarioFixture[]
  /** Optional suite tag. Scenarios without a suite belong to the 'core' suite. */
  suite?: EvalSuite
}

export interface EvalScenarioFixture {
  path: string
  content: string
  mode?: number
}

export type EvalEnvironmentStatus = 'ready' | 'warning' | 'blocked'
export type EvalEnvironmentCheckLevel = 'info' | 'warn' | 'error'

export interface EvalEnvironmentCheck {
  code: string
  level: EvalEnvironmentCheckLevel
  message: string
  detail?: string
  hint?: string
}

export interface EvalEnvironmentTarget {
  kind: 'local' | 'gateway'
  provider: string
  model: string
  label: string
  gatewayProfileId?: string | null
  environmentId?: string | null
  environmentLabel?: string | null
  environmentStatus?: string | null
  capabilities?: string[]
  refreshedAt?: number | null
}

export interface EvalEnvironmentGeneratedFile {
  path: string
  kind: 'readme' | 'manifest' | 'env' | 'fixture'
  required: boolean
}

export interface EvalEnvironmentPlan {
  generatedAt: number
  status: EvalEnvironmentStatus
  agentId: string
  agentName: string
  scenarioIds: string[]
  suite?: string | null
  target: EvalEnvironmentTarget | null
  checks: EvalEnvironmentCheck[]
  requiredTools: string[]
  missingTools: string[]
  maxScore: number
  timeoutMs: number
  generatedFiles: EvalEnvironmentGeneratedFile[]
  envHints: Array<{ key: string; value: string; description?: string }>
}

export interface EvalRun {
  id: string
  scenarioId: string
  agentId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt: number
  endedAt?: number
  score: number
  maxScore: number
  details: EvalCriterionResult[]
  sessionId?: string
  environment?: EvalEnvironmentPlan
  error?: string
}

export interface EvalCriterionResult {
  criterion: string
  score: number
  maxScore: number
  evidence?: string
}

export interface EvalSuiteResult {
  agentId: string
  totalScore: number
  maxScore: number
  percentage: number
  runs: EvalRun[]
  completedAt: number
}

export type EvalGateScopeType = 'scenario' | 'suite'

export interface EvalGateScope {
  type: EvalGateScopeType
  id: string
  label: string
  scenarioIds: string[]
}

export interface EvalBaseline {
  id: string
  agentId: string
  scope: EvalGateScope
  baselineScore: number
  baselineMaxScore: number
  baselinePercent: number
  minPercent: number
  maxRegressionPoints: number
  runIds: string[]
  label?: string | null
  notes?: string | null
  createdAt: number
  updatedAt: number
}

export type EvalGateStatus = 'pass' | 'warn' | 'fail'

export interface EvalGateCheck {
  code: string
  status: EvalGateStatus
  message: string
  detail?: string
}

export interface EvalGateResult {
  agentId: string
  scope: EvalGateScope
  status: EvalGateStatus
  generatedAt: number
  baseline: EvalBaseline | null
  latestRuns: EvalRun[]
  currentScore: number
  currentMaxScore: number
  currentPercent: number | null
  regressionPoints: number | null
  minPercent: number
  maxRegressionPoints: number
  checks: EvalGateCheck[]
}
