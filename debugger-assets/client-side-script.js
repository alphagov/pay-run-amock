  ;[...document.querySelectorAll('[data-dom-widget="showHideToggle"]')].forEach($elem => {
    if (!$elem.data('data-toggle-element-id')) {
      console.log('No data-toggle-element-id', $elem)
      return
    }
    const $toggleElem = document.getElementById($elem.data('data-toggle-element-id'))
    if (!$toggleElem) {
      console.log('No element with ID', $elem.data('data-toggle-element-id'))
      return
    }
    $elem.addEventListener('click', (e) => {
      e.preventDefault()
      const currentDisplay = $toggleElem.style.display
      $toggleElem.style.display = currentDisplay === 'none' ? 'block' : 'none'
    })
  })

  ;[...document.querySelectorAll('[data-dom-widget="tabs"]')].forEach($elem => {
    const tabClass = $elem.getAttribute('data-tab-class')
    const contentClass = $elem.getAttribute('data-content-class')
    const contentIdAttribute = $elem.getAttribute('data-content-id-attribute')
    const tabSelector = '.' + tabClass
    const $allTabs = [...$elem.querySelectorAll(tabSelector)]
    const $allContents = [...$elem.querySelectorAll('.' + contentClass)]
    $allContents.forEach(($contentElem) => {
      $contentElem.style.display = 'none'
    })
    $allTabs.forEach(($tabElem, index) => {
      const clickHandler = () => {
        const $matchingContents = $allContents.find($ => $.id === $tabElem.getAttribute(contentIdAttribute))
        if (!$matchingContents) {
          console.error('No matching contents for tab', $tabElem)
          return
        }
        $allContents.forEach(($contentElem) => {
          $contentElem.style.display = 'none'
        })
        $matchingContents.style.display = 'block'
        $allTabs.forEach(($tabElem) => {
          $tabElem.classList.remove('current')
        })
        $tabElem.classList.add('current')
      }
      if (index === 0 || window.location.hash === $tabElem.getAttribute('href')) {
        clickHandler()
      }
      $tabElem.addEventListener('click', clickHandler)
    })
  })
