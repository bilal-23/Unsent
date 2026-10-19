import { Link } from 'react-router'
import { t } from '../i18n'
import { Icon } from './Icon'

/** Opens the search across everything. */
export function SearchButton() {
  return (
    <Link to="/search" className="btn-ghost px-2.5" aria-label={t('Search everything')} title={t('Search everything')}>
      <Icon name="search" />
    </Link>
  )
}
