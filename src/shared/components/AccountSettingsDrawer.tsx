import { ModalShell } from './ModalShell'
import { AccountSettings } from './AccountSettings'

interface AccountSettingsDrawerProps {
  onDone: () => void
}

export function AccountSettingsDrawer({ onDone }: AccountSettingsDrawerProps) {
  return (
    <ModalShell onDismiss={onDone} title="Account settings">
      <AccountSettings onSignOut={onDone} />
    </ModalShell>
  )
}
