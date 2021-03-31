<template>
  <div class="command-code">
    <div class="command-code__icon">></div>
    <div class="command-code__command">
      <slot></slot>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.command-code {
  display: inline-flex;
  align-items: center;
  border: 1px solid $blue-2;
  background-color: $dark;
  margin: 1rem 0;
  margin-right: 0.5rem;

  &__icon {
    color: $red;
    font-size: 2rem;
    background-color: $dark;
    width: 2rem;
    height: 2rem;
    text-align: center;
  }

  &__command {
    font-size: 1.5rem;
    margin: 0 0.5rem;
    font-weight: 600;
  }
}
</style>