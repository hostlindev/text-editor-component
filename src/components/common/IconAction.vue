<script setup lang="ts">
import { VBtn, VIcon, VTooltip } from 'vuetify/components'

withDefaults(
  defineProps<{
    icon: string
    /** Accessible name of the button. */
    label: string
    /** Tooltip copy; defaults to the accessible name. */
    hint?: string
    disabled?: boolean
    color?: string
    size?: 'x-small' | 'small' | 'default'
    density?: 'default' | 'comfortable'
  }>(),
  { size: 'small', density: 'default', disabled: false },
)

defineEmits<{
  (event: 'click', payload: MouseEvent): void
}>()
</script>

<template>
  <VTooltip :text="hint ?? label" location="bottom" open-delay="400">
    <template #activator="{ props: tooltipProps }">
      <!--
        The activator is a span, not the button: a disabled Vuetify button does
        not receive pointer events, and its tooltip explaining the option still
        has to appear.
      -->
      <span v-bind="tooltipProps" class="icon-action">
        <VBtn
          :icon="icon"
          :size="size"
          :density="density"
          :color="color"
          :disabled="disabled"
          :aria-label="label"
          variant="text"
          @click="$emit('click', $event)"
        >
          <!--
            The glyph is rendered here on purpose: VBtn drops its own `icon`
            output as soon as it receives a default slot, and this component
            always passes one so callers can overlay a swatch. Without this
            every icon-only action would render an empty button.
          -->
          <VIcon :icon="icon" />
          <slot />
        </VBtn>
      </span>
    </template>
  </VTooltip>
</template>

<style scoped>
.icon-action {
  display: inline-flex;
}
</style>
