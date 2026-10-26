import { createApp } from 'vue'
import { createVuetify } from 'vuetify'
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

import PlaygroundApp from './App.vue'

const vuetify = createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#4f46e5',
          secondary: '#0ea5e9',
          surface: '#ffffff',
          background: '#eef1f6',
        },
      },
    },
  },
})

createApp(PlaygroundApp).use(vuetify).mount('#app')
