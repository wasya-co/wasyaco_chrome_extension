
import react, { useState } from 'react'

import './Widget.scss'

/**
 * SearchWidget
**/
const SearchWidget = ({ children, ...props }) => {
  // logg(props, 'SearchWidget')
  const {
    name,
    targetBlank = true,
    url,
  } = props

  const [ q, setQ ] = useState('')

  const handleSubmit = (ev) => {
    ev.preventDefault()
    if (targetBlank) {
      window.open(url(q), "_blank")
    } else {
      window.location = url(q)
    }
  }

  return <div className='SearchWidget WidgetW'>
    <form onSubmit={handleSubmit} >
      <label>Search {name}</label><br />
      <input type='text' value={q} onChange={(ev) => setQ(ev.target.value) } />
      <button type='submit' className='Btn btn-primary'>Search</button>
    </form>
  </div>
}

export default SearchWidget
