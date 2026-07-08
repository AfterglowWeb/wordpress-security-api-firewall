import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-top': () =>
        h('div', { class: 'vp-custom-banner' }, [
          h('p', {
            innerHTML:
              '🚧 Currently in alpha — stable release and Pro licensing coming in 2026. '
              + '<a href="https://github.com/AfterglowWeb/wordpress-security-api-firewall" target="_blank" rel="noopener">Star the repo</a>'
              + ' to follow progress.',
          }),
        ]),
    })
  },
}
