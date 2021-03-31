<template>
  <button :class="{ active: active }"><slot></slot></button>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({
  props: {
    active: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  setup() {},
});
</script>


<style lang="scss" scoped>
button {
  outline: none;
  font-size: 1.5rem;
  font-weight: 300;
  color: $white;
  padding: 0.5rem 1rem;
  background-color: $dark;
  margin: 0rem 0.5rem;
  border: none;
  cursor: pointer;

  &:hover {
    background-color: $blue;
  }
}

.active {
  background-color: $blue;

  &:hover {
    background-color: $dark;
  }
}
</style>