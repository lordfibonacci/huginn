import { useTranslation } from 'react-i18next'
import { ModalShell } from './ModalShell'
import { AccountSettings } from './AccountSettings'

interface AccountSettingsDrawerProps {
  onDone: () => void
}

export function AccountSettingsDrawer({ onDone }: AccountSettingsDrawerProps) {
  const { t } = useTranslation()
  return (
    <ModalShell onDismiss={onDone} title={t('settings.account.title')}>
      <AccountSettings onSignOut={onDone} />
    </ModalShell>
  )
}
