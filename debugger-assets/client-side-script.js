// Note - this is my standard 'one function Javascript Framework' ... I handwrite it every time though, I should really standardise it.  (From Natalie Carey)
//
// Add handlers here, for example myExampleBehaviour($elem, config) would be triggered with:
//
// <p data-dom-widget="myExampleBehaviour"></p>
// <a href="#" data-dom-widget="myExampleBehaviour" data-extra-param="something"></a>
// <h1 data-dom-widget="myExampleBehaviour"></h1>
//
// In the above examples the calls would be (matching the order above)
//
// $elem = (that paragraph), config = {}
// $elem = (that link), config = {extraParams="something"}
// $elem = (that h1), config = {}
//
// Note the conversion from 'data-extra-param' to 'config.extraParam'
//
// (Natalie just wrote a comment in code -  it must be important)

const domWidgets = {
  showHideToggle: ($elem, config) => {
    if (!config.toggleElementId) {
      console.log('No data-toggle-element-id', $elem)
      return
    }
    const $toggleElem = document.getElementById(config.toggleElementId)
    if (!$toggleElem) {
      console.log('No element with ID', config.toggleElementId)
      return
    }
    $elem.addEventListener('click', (e) => {
      e.preventDefault()
      const currentDisplay = $toggleElem.style.display
      $toggleElem.style.display = currentDisplay === 'none' ? 'block' : 'none'
    })
  },
  tabs: ($elem, config) => {
    const {
      tabClass,
      contentClass,
      contentIdAttribute
    } = config
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
  }
}


document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-dom-widget]').forEach(($elem) => {
    const widgetName = $elem.getAttribute('data-dom-widget')
    const dataAttrs = $elem.getAttributeNames().filter(x => x.startsWith('data-') && x !== 'data-dom-widget')
    const handler = domWidgets[widgetName]
    if (handler) {
      const config = dataAttrs.reduce((accumulator, attrName) => {
        const keyName = attrName
          .split('-')
          .slice(1)
          .map((value, index) => index === 0 ? value : value.at(0).toUpperCase() + value.substring(1))
          .join('')
        return Object.assign({}, accumulator, {[keyName]: $elem.getAttribute(attrName)})
      }, {})
      handler($elem, config)
    } else {
      console.error('No handler found for widget type', widgetName)
    }
  })
})
