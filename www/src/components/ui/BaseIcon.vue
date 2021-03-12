<template>
  <svg
    xmlns:xlink="http://www.w3.org/1999/xlink"
    :height="height"
    :width="width"
    :fill="fill"
  >
    <use :xlink:href="require('@/assets/sprite.svg') + `#icon-${icon}`"></use>
  </svg>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  props: {
    width: String,
    height: String,
    icon: String,
    fill: {
      type: String,
      required: false,
      default: null,
    },
  },
  setup(props) {
    return {
      width: props.width,
      height: props.height,
      icon: props.icon,
      fill: props.fill,
    };
  },
});
</script>