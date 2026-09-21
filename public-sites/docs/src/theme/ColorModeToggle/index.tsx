/*
 * Swizzled colour-mode toggle: a two-way switch.
 *
 * The site still follows the system on first visit (`colorMode.respectPrefersColorScheme`),
 * but the button only flips between light and dark instead of cycling
 * through system as a third stop. When no explicit choice has been made yet
 * (`value` is null) the flip starts from whatever mode the system resolved to.
 */
import type { ReactNode } from 'react'
import useIsBrowser from '@docusaurus/useIsBrowser'
import { translate } from '@docusaurus/Translate'
import IconLightMode from '@theme/Icon/LightMode'
import IconDarkMode from '@theme/Icon/DarkMode'
import type { Props } from '@theme/ColorModeToggle'
import styles from './styles.module.css'

type ColorMode = 'light' | 'dark'

function resolvedColorMode(value: Props['value']): ColorMode {
  if (value === 'light' || value === 'dark') return value
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

export default function ColorModeToggle({ className, buttonClassName, value, onChange }: Props): ReactNode {
  const isBrowser = useIsBrowser()
  const classes = [styles.toggle, className].filter(Boolean).join(' ')
  const buttonClasses = ['clean-btn', styles.toggleButton, !isBrowser && styles.toggleButtonDisabled, buttonClassName]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={classes}>
      <button
        className={buttonClasses}
        type="button"
        onClick={() => onChange(resolvedColorMode(value) === 'dark' ? 'light' : 'dark')}
        disabled={!isBrowser}
        title={translate({
          message: 'Switch between dark and light mode',
          id: 'theme.colorToggle.ariaLabel.twoWay',
          description: 'The label for the two-way colour mode toggle',
        })}
        aria-label={translate({
          message: 'Switch between dark and light mode',
          id: 'theme.colorToggle.ariaLabel.twoWay',
          description: 'The label for the two-way colour mode toggle',
        })}
      >
        {/* Both icons render; `html[data-theme]` picks one, so it is right before hydration too. */}
        <IconLightMode aria-hidden className={`${styles.toggleIcon} ${styles.lightToggleIcon}`} />
        <IconDarkMode aria-hidden className={`${styles.toggleIcon} ${styles.darkToggleIcon}`} />
      </button>
    </div>
  )
}
