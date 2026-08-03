import { useEffect } from 'react'
import { useProtocolBuilderStore } from '@/lib/office/features/protocols/builder/protocol-builder-store'
import { validateDAG } from '@/lib/office/features/protocols/builder/validators/dag-validator'

export function useCanvasValidation() {
  const nodes = useProtocolBuilderStore((s) => s.nodes)
  const edges = useProtocolBuilderStore((s) => s.edges)
  const setValidation = useProtocolBuilderStore((s) => s.setValidation)

  useEffect(() => {
    const { errors, warnings } = validateDAG(nodes, edges)
    setValidation(errors, warnings)
  }, [nodes, edges, setValidation])
}
