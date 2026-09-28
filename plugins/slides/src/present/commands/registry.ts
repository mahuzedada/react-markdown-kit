/** Every deck command. A new command is a new spec listed here; its keys and help entry come with it. */
import type { CommandContext, DeckCommandSpec } from './command.js'
import { firstCommand, lastCommand, nextCommand, previousCommand } from './navigation.js'
import { notesLargerCommand, notesSmallerCommand, resetTimerCommand } from './presenter.js'
import { clearDrawingCommand, drawCommand, laserCommand } from './tools.js'
import {
  blackoutCommand,
  cloneCommand,
  exitCommand,
  fullscreenCommand,
  helpCommand,
  overviewCommand,
  presentCommand,
  presenterCommand,
} from './views.js'

export const DECK_COMMANDS = [
  nextCommand,
  previousCommand,
  firstCommand,
  lastCommand,
  presentCommand,
  presenterCommand,
  overviewCommand,
  fullscreenCommand,
  blackoutCommand,
  drawCommand,
  laserCommand,
  clearDrawingCommand,
  resetTimerCommand,
  notesLargerCommand,
  notesSmallerCommand,
  cloneCommand,
  helpCommand,
  exitCommand,
] as const

export type DeckCommand = (typeof DECK_COMMANDS)[number]['id']

const BY_ID = new Map<string, DeckCommandSpec>(DECK_COMMANDS.map((spec) => [spec.id, spec]))
const BY_KEY = new Map<string, DeckCommand>(DECK_COMMANDS.flatMap((spec) => spec.keys.map((key) => [key, spec.id] as const)))

export function commandSpec(id: DeckCommand): DeckCommandSpec {
  return BY_ID.get(id)!
}

export function commandForKey(key: string): DeckCommand | undefined {
  return BY_KEY.get(key)
}

export function isAvailable(id: DeckCommand, context: CommandContext): boolean {
  return commandSpec(id).available?.(context) ?? true
}

/** Runs the command when it is on offer; returns whether it ran. */
export function runCommand(id: DeckCommand, context: CommandContext): boolean {
  if (!isAvailable(id, context)) return false
  commandSpec(id).run(context)
  return true
}
