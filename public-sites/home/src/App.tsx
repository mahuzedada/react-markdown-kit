import type { ReactNode } from 'react'
import { Shell } from '../../shared/Shell'
import Landing from './Landing'

export default function App(): ReactNode {
  return (
    <Shell site="home">
      <Landing />
    </Shell>
  )
}
