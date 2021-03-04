<template>
  <div class="card">
    <div class="card__header">
      <slot name="header"></slot>
    </div>
    <div class="card__content">
      <slot></slot>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";

export default defineComponent({});
</script>

<style lang="scss" scoped>
.card {
  box-shadow: 0px -1px 15px 0px rgba($dark, 0.5);
  width: 40%;

  &__header {
    padding: 1rem 0.5rem;
    font-size: 2rem;
    border-bottom: 1px solid #ccc;
  }
}
</style>